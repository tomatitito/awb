import express from 'express'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import type { ServerResponse } from 'node:http'
import type { Server } from 'node:http'
import { fileURLToPath } from 'node:url'
import { loadTickets } from './core/loadTickets.js'

export type StartServerOptions = {
  projectDir: string
  ticketsDir: string
  port: number
  dev?: boolean
}

export async function startServer(options: StartServerOptions): Promise<{ server: Server; url: string }> {
  const app = express()
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const webDir = path.resolve(currentDir, '../dist/web')
  const absoluteTicketsDir = path.resolve(options.projectDir, options.ticketsDir)
  let data = await loadTickets(options.projectDir, options.ticketsDir)
  const liveReloadClients = new Set<ServerResponse>()
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
    app.get('*', async (request, response, next) => {
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
    app.get('*', (_request, response) => {
      response.sendFile(path.join(webDir, 'index.html'))
    })
  }

  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(options.port, '127.0.0.1', () => resolve(started))
  })

  server.on('close', () => {
    if (reloadTimer) clearTimeout(reloadTimer)
    watcher.close()
    if (closeWebDevServer) {
      void closeWebDevServer()
    }
    for (const client of liveReloadClients) {
      client.end()
    }
    liveReloadClients.clear()
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : options.port
  return { server, url: `http://127.0.0.1:${port}` }
}
