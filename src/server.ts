import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { Server, ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AuthStorage, ModelRegistry } from '@mariozechner/pi-coding-agent'
import express from 'express'
import { AgentController, toLegacyPanelEvent } from './agent/AgentController.js'
import { createPiSession } from './agent/createPiSession.js'
import { LoginController } from './agent/LoginController.js'
import type { AgentRunEvent, SelectedTicketContext } from './agent/types.js'
import { GitWorktreeManager } from './agent/worktree.js'
import { loadAwbSettings } from './config.js'
import { loadTickets } from './core/loadTickets.js'
import { discoverSelectableProjects } from './projects.js'
import { ProjectRuntimeManager } from './server/projectRuntime.js'

export type StartServerOptions = {
  projectDir: string
  ticketsDir: string
  port: number
  dev?: boolean
  editorCommand?: string
  worktreeIsolationEnabled?: boolean
  projectDiscoveryConfigDir?: string
}

export async function startServer(options: StartServerOptions): Promise<{ server: Server; url: string }> {
  const app = express()
  app.use(express.json())

  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const webDir = path.resolve(currentDir, '../dist/web')
  const liveReloadClients = new Set<ServerResponse>()
  const legacyAgentClients = new Set<ServerResponse>()
  const allRunClients = new Set<ServerResponse>()
  const runClients = new Map<string, Set<ServerResponse>>()
  const authStorage = AuthStorage.create()
  const modelRegistry = ModelRegistry.create(authStorage)
  const now = () => Date.now()
  let runtime: ProjectRuntimeManager

  function writeSseEvent(response: ServerResponse, event: string, payload: unknown) {
    response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
  }

  function notifyClients(event: 'reload' | 'reload-error', payload: Record<string, unknown>) {
    const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
    for (const client of liveReloadClients) {
      client.write(body)
    }
  }

  function closeRunDetailClients() {
    for (const clients of runClients.values()) {
      for (const client of clients) {
        client.end()
      }
    }
    runClients.clear()
  }

  function broadcastAgentStateReset() {
    const controllerState = runtime.agentController.getState()
    for (const client of allRunClients) {
      writeSseEvent(client, 'ready', { type: 'ready', runs: runtime.agentController.listRuns() })
    }
    for (const client of legacyAgentClients) {
      writeSseEvent(client, 'ready', { type: 'ready', state: controllerState })
    }
  }

  function broadcastRunEvent(event: AgentRunEvent) {
    for (const client of allRunClients) {
      writeSseEvent(client, event.type, event)
    }
    if ('runId' in event) {
      for (const client of runClients.get(event.runId) ?? []) {
        writeSseEvent(client, event.type, event)
      }
    }
    if ('run' in event) {
      for (const client of runClients.get(event.run.id) ?? []) {
        writeSseEvent(client, event.type, event)
      }
    }

    const legacyEvent = toLegacyPanelEvent(event)
    if (legacyEvent) {
      for (const client of legacyAgentClients) {
        writeSseEvent(client, legacyEvent.type, legacyEvent)
      }
    }
  }

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
      onReload: (payload) => notifyClients('reload', payload),
      onReloadError: (payload) => notifyClients('reload-error', payload),
      onAgentEvent: broadcastRunEvent,
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
      closeRunDetailClients()
      broadcastAgentStateReset()
      notifyClients('reload', reloadPayload)
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
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.flushHeaders()
    response.write(`event: ready\ndata: ${JSON.stringify({ ticketsDir: runtime.data.ticketsDir })}\n\n`)

    liveReloadClients.add(response)
    _request.on('close', () => {
      liveReloadClients.delete(response)
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

  app.get('/api/agent/runs/events', (_request, response) => {
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.flushHeaders()
    writeSseEvent(response, 'ready', { type: 'ready', runs: runtime.agentController.listRuns() })

    allRunClients.add(response)
    _request.on('close', () => {
      allRunClients.delete(response)
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

    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.flushHeaders()
    writeSseEvent(response, 'ready', { type: 'ready', run })

    let clients = runClients.get(run.id)
    if (!clients) {
      clients = new Set()
      runClients.set(run.id, clients)
    }
    clients.add(response)

    request.on('close', () => {
      clients?.delete(response)
      if (clients && clients.size === 0) {
        runClients.delete(run.id)
      }
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
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.flushHeaders()
    writeSseEvent(response, 'ready', { type: 'ready', state: runtime.agentController.getState() })

    legacyAgentClients.add(response)
    _request.on('close', () => {
      legacyAgentClients.delete(response)
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
    closeRunDetailClients()
    if (closeWebDevServer) {
      void closeWebDevServer()
    }
    for (const client of liveReloadClients) client.end()
    for (const client of legacyAgentClients) client.end()
    for (const client of allRunClients) client.end()
    liveReloadClients.clear()
    legacyAgentClients.clear()
    allRunClients.clear()
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : options.port
  return { server, url: `http://127.0.0.1:${port}` }
}
