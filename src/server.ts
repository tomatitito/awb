import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { Server } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AuthStorage, ModelRegistry } from '@mariozechner/pi-coding-agent'
import express from 'express'
import { AgentController } from './agent/AgentController.js'
import { createPiSession } from './agent/createPiSession.js'
import { LoginController } from './agent/LoginController.js'
import type { SelectedTicketContext } from './agent/types.js'
import { GitWorktreeManager } from './agent/worktree.js'
import { loadAwbSettings } from './config.js'
import { loadTickets } from './core/loadTickets.js'
import { embeddedWebAssets as generatedEmbeddedWebAssets } from './generated/embeddedWebAssets.js'
import { discoverSelectableProjects } from './projects.js'
import { ProjectRuntimeManager } from './server/projectRuntime.js'
import { AgentEventsHub, TicketEventsHub } from './server/sse.js'
import { decodeEmbeddedWebAsset, type EmbeddedWebAssetsManifest, hasEmbeddedWebAssets, resolveEmbeddedWebAsset } from './webAssets.js'

export type StartServerOptions = {
  projectDir: string
  ticketsDir: string
  port: number
  dev?: boolean
  editorCommand?: string
  worktreeIsolationEnabled?: boolean
  projectDiscoveryConfigDir?: string
  embeddedWebAssets?: EmbeddedWebAssetsManifest
}

export async function startServer(options: StartServerOptions): Promise<{ server: Server; url: string }> {
  const app = express()
  app.use(express.json())

  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const webDir = path.resolve(currentDir, '../dist/web')
  const embeddedWebAssets = options.embeddedWebAssets ?? generatedEmbeddedWebAssets
  const ticketEvents = new TicketEventsHub()
  const agentEvents = new AgentEventsHub()
  const authStorage = AuthStorage.create()
  const modelRegistry = ModelRegistry.create(authStorage)
  const now = () => Date.now()
  let runtime: ProjectRuntimeManager

  runtime = await ProjectRuntimeManager.create(
    {
      projectDir: options.projectDir,
      ticketsDir: options.ticketsDir,
      editorCommand: options.editorCommand,
    },
    {
      loadTickets,
      loadAwbSettings,
      watch: fs.watch,
      createAgentController: (projectDir, controllerOptions) => new AgentController(projectDir, controllerOptions),
      createWorktreeManager: (projectDir, worktreeOptions) => new GitWorktreeManager(projectDir, worktreeOptions),
      createLoginController: (loginOptions) => new LoginController(loginOptions),
      createSession: createPiSession,
      createRunId: () => crypto.randomUUID(),
      now,
      toIsoString: () => new Date().toISOString(),
      authStorage,
      modelRegistry,
      onReload: (payload) => ticketEvents.notify('reload', payload),
      onReloadError: (payload) => ticketEvents.notify('reload-error', payload),
      onAgentEvent: (event) => agentEvents.broadcastRunEvent(event),
      onReloadFailure: (absoluteTicketsDir, message) => {
        console.error(`awb: failed to reload tickets from ${absoluteTicketsDir}: ${message}`)
      },
    },
  )

  app.get('/api/tickets', (_request, response) => {
    response.json(runtime.data)
  })

  app.get('/api/projects', async (_request, response) => {
    const discovery = await discoverSelectableProjects({ configDir: options.projectDiscoveryConfigDir })
    response.json({
      ...discovery,
      activeProjectRoot: runtime.projectDir,
      activeTicketsDir: runtime.ticketsDir,
    })
  })

  app.post('/api/projects/switch', async (request, response) => {
    const root = typeof request.body?.root === 'string' ? request.body.root.trim() : ''
    if (!root) {
      response.status(400).json({ message: 'root is required.' })
      return
    }

    const discovery = await discoverSelectableProjects({ configDir: options.projectDiscoveryConfigDir })
    const project = discovery.projects.find((entry) => entry.root === path.resolve(root))
    if (!project) {
      response.status(404).json({ message: `Project ${root} is not in the AWB project allowlist.` })
      return
    }

    try {
      const reloadPayload = await runtime.switchProject(project.root)
      agentEvents.closeRunDetailClients()
      agentEvents.broadcastStateReset(runtime.agentController.listRuns(), runtime.agentController.getState())
      ticketEvents.notify('reload', reloadPayload)
      response.status(202).json({
        ok: true,
        projectDir: runtime.data.projectDir,
        ticketsDir: runtime.data.ticketsDir,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      response.status(409).json({ message })
    }
  })

  app.get('/api/events', (_request, response) => {
    ticketEvents.addClient(response, { ticketsDir: runtime.data.ticketsDir })
    _request.on('close', () => {
      ticketEvents.removeClient(response)
    })
  })

  app.get('/api/agent/runs', (_request, response) => {
    response.json({ runs: runtime.agentController.listRuns() })
  })

  app.post('/api/agent/runs', async (request, response) => {
    const ticketId = typeof request.body?.ticketId === 'string' ? request.body.ticketId.trim() : ''
    if (!ticketId) {
      response.status(400).json({ message: 'ticketId is required.' })
      return
    }

    const ticket = runtime.getTicketContext(ticketId)
    if (!ticket) {
      response.status(404).json({ message: `Ticket ${ticketId} was not found.` })
      return
    }

    const run = await runtime.agentController.createRun(ticket)
    response.status(201).json({ run })
  })

  app.post('/api/agent/runs/chat', async (request, response) => {
    const text = typeof request.body?.text === 'string' ? request.body.text.trim() : ''
    if (!text) {
      response.status(400).json({ message: 'Prompt text is required.' })
      return
    }

    const run = await runtime.agentController.createUnticketedRun(text)
    response.status(201).json({ run })
  })

  app.get('/api/agent/runs/events', (_request, response) => {
    agentEvents.addAllRunsClient(response, runtime.agentController.listRuns())
    _request.on('close', () => {
      agentEvents.removeAllRunsClient(response)
    })
  })

  app.get('/api/agent/runs/:runId', (request, response) => {
    const run = runtime.agentController.getRun(request.params.runId)
    if (!run) {
      response.status(404).json({ message: `Run ${request.params.runId} was not found.` })
      return
    }

    response.json({ run })
  })

  app.get('/api/agent/runs/:runId/events', (request, response) => {
    const run = runtime.agentController.getRun(request.params.runId)
    if (!run) {
      response.status(404).json({ message: `Run ${request.params.runId} was not found.` })
      return
    }

    agentEvents.addRunDetailClient(response, run)
    request.on('close', () => {
      agentEvents.removeRunDetailClient(run.id, response)
    })
  })

  app.post('/api/agent/runs/:runId/prompt', async (request, response) => {
    const text = typeof request.body?.text === 'string' ? request.body.text.trim() : ''
    if (!text) {
      response.status(400).json({ message: 'Prompt text is required.' })
      return
    }

    try {
      await runtime.agentController.promptRun(request.params.runId, text)
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = message.includes('not found') ? 404 : 409
      response.status(status).json({ message })
    }
  })

  app.post('/api/agent/runs/:runId/abort', async (request, response) => {
    try {
      await runtime.agentController.abortRun(request.params.runId)
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = message.includes('not found') ? 404 : 409
      response.status(status).json({ message })
    }
  })

  app.post('/api/agent/runs/:runId/close', async (request, response) => {
    try {
      const run = await runtime.agentController.closeUnticketedRun(request.params.runId)
      response.status(202).json({ run })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = message.includes('not found') ? 404 : 409
      response.status(status).json({ message })
    }
  })

  app.post('/api/agent/runs/:runId/worktree/open', async (request, response) => {
    try {
      await runtime.agentController.openRunWorktreeInEditor(request.params.runId)
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = message.includes('not found') ? 404 : 409
      response.status(status).json({ message })
    }
  })

  app.post('/api/agent/runs/:runId/worktree/cleanup', async (request, response) => {
    try {
      const run = await runtime.agentController.cleanupRunWorktree(request.params.runId)
      response.status(202).json({ run })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = message.includes('not found') ? 404 : 409
      response.status(status).json({ message })
    }
  })

  app.get('/api/agent/state', async (_request, response) => {
    await runtime.agentController.ensureStarted()
    response.json(runtime.agentController.getState())
  })

  app.get('/api/agent/events', (_request, response) => {
    agentEvents.addLegacyClient(response, runtime.agentController.getState())
    _request.on('close', () => {
      agentEvents.removeLegacyClient(response)
    })
  })

  app.post('/api/agent/context', (request, response) => {
    const ticket = request.body as SelectedTicketContext | undefined
    if (!ticket?.ticketId || !ticket.title || !ticket.filePath) {
      runtime.agentController.setSelectedTicket(undefined)
      response.status(204).end()
      return
    }

    runtime.agentController.setSelectedTicket({
      ticketId: ticket.ticketId,
      title: ticket.title,
      body: ticket.body || '',
      filePath: ticket.filePath,
    })
    response.status(204).end()
  })

  app.post('/api/agent/prompt', async (request, response) => {
    const text = typeof request.body?.text === 'string' ? request.body.text.trim() : ''
    if (!text) {
      response.status(400).json({ message: 'Prompt text is required.' })
      return
    }

    try {
      await runtime.agentController.prompt(text)
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      response.status(409).json({ message })
    }
  })

  app.post('/api/agent/abort', async (_request, response) => {
    try {
      await runtime.agentController.abort()
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      response.status(500).json({ message })
    }
  })

  app.get('/api/agent/auth/providers', async (_request, response) => {
    await runtime.agentController.ensureStarted()
    response.json({ providers: runtime.agentController.getAuthProviders() })
  })

  app.post('/api/agent/auth/login', async (request, response) => {
    const providerId = typeof request.body?.providerId === 'string' ? request.body.providerId.trim() : ''
    if (!providerId) {
      response.status(400).json({ message: 'providerId is required.' })
      return
    }

    try {
      const flow = await runtime.agentController.startLogin(providerId)
      response.status(202).json({ flow })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      response.status(409).json({ message })
    }
  })

  app.get('/api/agent/auth/login', (_request, response) => {
    response.json({ flow: runtime.agentController.getLoginFlow() })
  })

  app.post('/api/agent/auth/login/input', async (request, response) => {
    const value = typeof request.body?.value === 'string' ? request.body.value : ''

    try {
      await runtime.agentController.submitLoginInput(value)
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      response.status(409).json({ message })
    }
  })

  app.post('/api/agent/auth/login/cancel', async (_request, response) => {
    await runtime.agentController.cancelLogin()
    response.status(202).json({ ok: true })
  })

  let closeWebDevServer: (() => Promise<void>) | undefined

  if (options.dev) {
    const { createServer: createViteServer } = await import('vite')
    const webRoot = path.resolve(currentDir, 'web')
    const vite = await createViteServer({
      root: webRoot,
      server: { middlewareMode: true },
      appType: 'custom',
    })
    closeWebDevServer = () => vite.close()

    app.use(vite.middlewares)
    app.get('/{*splat}', async (request, response, next) => {
      try {
        const indexPath = path.join(webRoot, 'index.html')
        const template = await fsp.readFile(indexPath, 'utf8')
        const html = await vite.transformIndexHtml(request.originalUrl, template)
        response.status(200).set({ 'Content-Type': 'text/html' }).end(html)
      } catch (error) {
        vite.ssrFixStacktrace(error as Error)
        next(error)
      }
    })
  } else if (hasEmbeddedWebAssets(embeddedWebAssets)) {
    app.get('/{*splat}', (request, response) => {
      const asset = resolveEmbeddedWebAsset(embeddedWebAssets, request.path)
      if (!asset) {
        response.status(404).end()
        return
      }

      response.status(200).type(asset.contentType).send(decodeEmbeddedWebAsset(asset))
    })
  } else {
    app.use(express.static(webDir))
    app.get('/{*splat}', (_request, response) => {
      response.sendFile(path.join(webDir, 'index.html'))
    })
  }

  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(options.port, '127.0.0.1', () => resolve(started))
  })

  server.on('close', () => {
    runtime.dispose()
    if (closeWebDevServer) {
      void closeWebDevServer()
    }
    ticketEvents.closeAll()
    agentEvents.closeAll()
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : options.port
  return { server, url: `http://127.0.0.1:${port}` }
}
