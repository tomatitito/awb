import type { AgentPanelState, SelectedTicketContext } from '../agent/types'

async function postJson(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: `Request failed: ${response.status}` }))
    throw new Error(typeof payload.message === 'string' ? payload.message : `Request failed: ${response.status}`)
  }

  return response
}

export async function fetchAgentState(): Promise<AgentPanelState> {
  const response = await fetch('/api/agent/state')
  if (!response.ok) {
    throw new Error(`Failed to load agent state: ${response.status}`)
  }
  return response.json()
}

export async function sendAgentPrompt(text: string): Promise<void> {
  await postJson('/api/agent/prompt', { text })
}

export async function abortAgentRun(): Promise<void> {
  await postJson('/api/agent/abort', {})
}

export async function setAgentSelectedTicketContext(ticket: SelectedTicketContext | undefined): Promise<void> {
  await postJson('/api/agent/context', ticket ? ticket : {})
}
