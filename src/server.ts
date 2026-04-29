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
import { loadTickets } from './core/loadTickets.js'

export type StartServerOptions = {
  projectDir: string
  ticketsDir: string
  port: number
  dev?: boolean
  editorCommand?: string
  worktreeIsolationEnabled?: boolean
}

export async function startServer(options: StartServerOptions): Promise<{ server: Server; url: string }> {
  const app = express()
  app.use(express.json())

  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const webDir = path.resolve(currentDir, '../dist/web')
  const absoluteTicketsDir = path.resolve(options.projectDir, options.ticketsDir)
  let data = await loadTickets(options.projectDir, options.ticketsDir)
  const liveReloadClients = new Set<ServerResponse>()
  const legacyAgentClients = new Set<ServerResponse>()
  const allRunClients = new Set<ServerResponse>()
  const runClients = new Map<string, Set<ServerResponse>>()
  const authStorage = AuthStorage.create()
  const modelRegistry = ModelRegistry.create(authStorage)
  const now = () => Date.now()
  const worktreeManager = new GitWorktreeManager(options.projectDir, {
    enabled: Boolean(options.worktreeIsolationEnabled),
    now,
  })
  const agentController = new AgentController(options.projectDir, {
    createSession: createPiSession,
    createRunId: () => crypto.randomUUID(),
    now,
    loginController: new LoginController({ authStorage, modelRegistry, now }),
    credentialProvider: authStorage,
    modelRegistry,
    worktreeManager,
    editorCommand: options.editorCommand,
  })
  await agentController.ensureStarted()
  let reloadTimer: ReturnType<typeof setTimeout> | undefined

  const notifyClients = (event: 'reload' | 'reload-error', payload: Record<string, unknown>) => {
    const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
    for (const client of liveReloadClients) {
      client.write(body)
    }
  }

  const reloadTickets = async () => {
    try {
      data = await loadTickets(options.projectDir, options.ticketsDir)
      notifyClients('reload', {
        ticketCount: data.tickets.length,
        ticketsDir: data.ticketsDir,
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`awb: failed to reload tickets from ${absoluteTicketsDir}: ${message}`)
      notifyClients('reload-error', {
        message,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  const scheduleReload = () => {
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => {
      void reloadTickets()
    }, 100)
  }

  const watcher = fs.watch(absoluteTicketsDir, (_eventType, filename) => {
    if (!filename || filename.toString().endsWith('.md')) {
      scheduleReload()
    }
  })

  const writeSseEvent = (response: ServerResponse, event: string, payload: unknown) => {
    response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
  }

  const broadcastRunEvent = (event: AgentRunEvent) => {
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

  const unsubscribeAgent = agentController.subscribe((event) => {
    broadcastRunEvent(event)
  })

  const getTicketContext = (ticketId: string) => {
    const ticket = data.tickets.find((entry) => entry.id === ticketId)
    if (!ticket) return undefined
    return {
      ticketId: ticket.id,
      title: ticket.title,
      body: ticket.body,
      filePath: ticket.filePath,
    }
  }

  app.get('/api/tickets', (_request, response) => {
    response.json(data)
  })

  app.get('/api/events', (_request, response) => {
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.flushHeaders()
    response.write(`event: ready\ndata: ${JSON.stringify({ ticketsDir: data.ticketsDir })}\n\n`)

    liveReloadClients.add(response)
    _request.on('close', () => {
      liveReloadClients.delete(response)
    })
  })

  app.get('/api/agent/runs', (_request, response) => {
    response.json({ runs: agentController.listRuns() })
  })

  app.post('/api/agent/runs', async (request, response) => {
    const ticketId = typeof request.body?.ticketId === 'string' ? request.body.ticketId.trim() : ''
    if (!ticketId) {
      response.status(400).json({ message: 'ticketId is required.' })
      return
    }

    const ticket = getTicketContext(ticketId)
    if (!ticket) {
      response.status(404).json({ message: `Ticket ${ticketId} was not found.` })
      return
    }

    const run = await agentController.createRun(ticket)
    response.status(201).json({ run })
  })

  app.get('/api/agent/runs/events', (_request, response) => {
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.flushHeaders()
    writeSseEvent(response, 'ready', { type: 'ready', runs: agentController.listRuns() })

    allRunClients.add(response)
    _request.on('close', () => {
      allRunClients.delete(response)
    })
  })

  app.get('/api/agent/runs/:runId', (request, response) => {
    const run = agentController.getRun(request.params.runId)
    if (!run) {
      response.status(404).json({ message: `Run ${request.params.runId} was not found.` })
      return
    }

    response.json({ run })
  })

  app.get('/api/agent/runs/:runId/events', (request, response) => {
    const run = agentController.getRun(request.params.runId)
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
      await agentController.promptRun(request.params.runId, text)
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = message.includes('not found') ? 404 : 409
      response.status(status).json({ message })
    }
  })

  app.post('/api/agent/runs/:runId/abort', async (request, response) => {
    try {
      await agentController.abortRun(request.params.runId)
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = message.includes('not found') ? 404 : 409
      response.status(status).json({ message })
    }
  })

  app.post('/api/agent/runs/:runId/worktree/open', async (request, response) => {
    try {
      await agentController.openRunWorktreeInEditor(request.params.runId)
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = message.includes('not found') ? 404 : 409
      response.status(status).json({ message })
    }
  })

  app.post('/api/agent/runs/:runId/worktree/cleanup', async (request, response) => {
    try {
      const run = await agentController.cleanupRunWorktree(request.params.runId)
      response.status(202).json({ run })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = message.includes('not found') ? 404 : 409
      response.status(status).json({ message })
    }
  })

  app.get('/api/agent/state', async (_request, response) => {
    await agentController.ensureStarted()
    response.json(agentController.getState())
  })

  app.get('/api/agent/events', (_request, response) => {
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.flushHeaders()
    writeSseEvent(response, 'ready', { type: 'ready', state: agentController.getState() })

    legacyAgentClients.add(response)
    _request.on('close', () => {
      legacyAgentClients.delete(response)
    })
  })

  app.post('/api/agent/context', (request, response) => {
    const ticket = request.body as SelectedTicketContext | undefined
    if (!ticket || !ticket.ticketId || !ticket.title || !ticket.filePath) {
      agentController.setSelectedTicket(undefined)
      response.status(204).end()
      return
    }

    agentController.setSelectedTicket({
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
      await agentController.prompt(text)
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      response.status(409).json({ message })
    }
  })

  app.post('/api/agent/abort', async (_request, response) => {
    try {
      await agentController.abort()
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      response.status(500).json({ message })
    }
  })

  app.get('/api/agent/auth/providers', async (_request, response) => {
    await agentController.ensureStarted()
    response.json({ providers: agentController.getAuthProviders() })
  })

  app.post('/api/agent/auth/login', async (request, response) => {
    const providerId = typeof request.body?.providerId === 'string' ? request.body.providerId.trim() : ''
    if (!providerId) {
      response.status(400).json({ message: 'providerId is required.' })
      return
    }

    try {
      const flow = await agentController.startLogin(providerId)
      response.status(202).json({ flow })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      response.status(409).json({ message })
    }
  })

  app.get('/api/agent/auth/login', (_request, response) => {
    response.json({ flow: agentController.getLoginFlow() })
  })

  app.post('/api/agent/auth/login/input', async (request, response) => {
    const value = typeof request.body?.value === 'string' ? request.body.value : ''

    try {
      await agentController.submitLoginInput(value)
      response.status(202).json({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      response.status(409).json({ message })
    }
  })

  app.post('/api/agent/auth/login/cancel', async (_request, response) => {
    await agentController.cancelLogin()
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
    if (reloadTimer) clearTimeout(reloadTimer)
    watcher.close()
    unsubscribeAgent()
    agentController.dispose()
    if (closeWebDevServer) {
      void closeWebDevServer()
    }
    for (const client of liveReloadClients) {
      client.end()
    }
    for (const client of legacyAgentClients) {
      client.end()
    }
    for (const client of allRunClients) {
      client.end()
    }
    for (const clients of runClients.values()) {
      for (const client of clients) {
        client.end()
      }
    }
    liveReloadClients.clear()
    legacyAgentClients.clear()
    allRunClients.clear()
    runClients.clear()
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : options.port
  return { server, url: `http://127.0.0.1:${port}` }
}
