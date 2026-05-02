import type { ServerResponse } from 'node:http'
import { toLegacyPanelEvent } from '../agent/AgentController.js'
import type { AgentPanelState, AgentRunEvent, AgentRunState } from '../agent/types.js'

export function writeSseEvent(response: ServerResponse, event: string, payload: unknown) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
}

export function prepareSseResponse(response: ServerResponse) {
  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.flushHeaders()
}

export class TicketEventsHub {
  private readonly clients = new Set<ServerResponse>()

  addClient(response: ServerResponse, readyPayload: unknown) {
    prepareSseResponse(response)
    writeSseEvent(response, 'ready', readyPayload)
    this.clients.add(response)
  }

  removeClient(response: ServerResponse) {
    this.clients.delete(response)
  }

  notify(event: 'reload' | 'reload-error', payload: Record<string, unknown>) {
    for (const client of this.clients) {
      writeSseEvent(client, event, payload)
    }
  }

  closeAll() {
    for (const client of this.clients) client.end()
    this.clients.clear()
  }
}

export class AgentEventsHub {
  private readonly legacyClients = new Set<ServerResponse>()
  private readonly allRunClients = new Set<ServerResponse>()
  private readonly runClients = new Map<string, Set<ServerResponse>>()

  addAllRunsClient(response: ServerResponse, runs: AgentRunState[]) {
    prepareSseResponse(response)
    writeSseEvent(response, 'ready', { type: 'ready', runs })
    this.allRunClients.add(response)
  }

  removeAllRunsClient(response: ServerResponse) {
    this.allRunClients.delete(response)
  }

  addRunDetailClient(response: ServerResponse, run: AgentRunState) {
    prepareSseResponse(response)
    writeSseEvent(response, 'ready', { type: 'ready', run })

    let clients = this.runClients.get(run.id)
    if (!clients) {
      clients = new Set()
      this.runClients.set(run.id, clients)
    }
    clients.add(response)
  }

  removeRunDetailClient(runId: string, response: ServerResponse) {
    const clients = this.runClients.get(runId)
    clients?.delete(response)
    if (clients?.size === 0) {
      this.runClients.delete(runId)
    }
  }

  addLegacyClient(response: ServerResponse, state: AgentPanelState) {
    prepareSseResponse(response)
    writeSseEvent(response, 'ready', { type: 'ready', state })
    this.legacyClients.add(response)
  }

  removeLegacyClient(response: ServerResponse) {
    this.legacyClients.delete(response)
  }

  broadcastStateReset(runs: AgentRunState[], state: AgentPanelState) {
    for (const client of this.allRunClients) {
      writeSseEvent(client, 'ready', { type: 'ready', runs })
    }
    for (const client of this.legacyClients) {
      writeSseEvent(client, 'ready', { type: 'ready', state })
    }
  }

  broadcastRunEvent(event: AgentRunEvent) {
    for (const client of this.allRunClients) {
      writeSseEvent(client, event.type, event)
    }
    if ('runId' in event) {
      for (const client of this.runClients.get(event.runId) ?? []) {
        writeSseEvent(client, event.type, event)
      }
    }
    if ('run' in event) {
      for (const client of this.runClients.get(event.run.id) ?? []) {
        writeSseEvent(client, event.type, event)
      }
    }

    const legacyEvent = toLegacyPanelEvent(event)
    if (legacyEvent) {
      for (const client of this.legacyClients) {
        writeSseEvent(client, legacyEvent.type, legacyEvent)
      }
    }
  }

  closeRunDetailClients() {
    for (const clients of this.runClients.values()) {
      for (const client of clients) {
        client.end()
      }
    }
    this.runClients.clear()
  }

  closeAll() {
    this.closeRunDetailClients()
    for (const client of this.legacyClients) client.end()
    for (const client of this.allRunClients) client.end()
    this.legacyClients.clear()
    this.allRunClients.clear()
  }
}
