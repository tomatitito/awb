import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentPanelEvent, AgentPanelState, SelectedTicketContext } from '../agent/types'
import { abortAgentRun, fetchAgentState, sendAgentPrompt, setAgentSelectedTicketContext } from './agentApi'

export type AgentTranscriptEntry =
  | {
      id: string
      kind: 'assistant'
      text: string
      isStreaming: boolean
      timestamp: number
      errorMessage?: string
    }
  | {
      id: string
      kind: 'error'
      text: string
      timestamp: number
    }

export type ToolActivityEntry = {
  toolCallId: string
  toolName: string
  startedAt: number
  completedAt?: number
  isError?: boolean
  preview?: string
}

const INITIAL_STATE: AgentPanelState = {
  status: 'idle',
  isStreaming: false,
  queuedSteeringCount: 0,
  queuedFollowUpCount: 0,
}

function stringifyPreview(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string') return value
  try {
    const result = JSON.stringify(value)
    return result.length > 180 ? `${result.slice(0, 177)}…` : result
  } catch {
    return String(value)
  }
}

export function useAgentPanel() {
  const [state, setState] = useState<AgentPanelState>(INITIAL_STATE)
  const [transcript, setTranscript] = useState<AgentTranscriptEntry[]>([])
  const [toolActivity, setToolActivity] = useState<ToolActivityEntry[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  const refreshState = useCallback(async () => {
    const nextState = await fetchAgentState()
    setState(nextState)
  }, [])

  useEffect(() => {
    let disposed = false

    const loadState = async () => {
      try {
        const nextState = await fetchAgentState()
        if (!disposed) setState(nextState)
      } catch (error) {
        if (!disposed) {
          setState((current) => ({
            ...current,
            status: 'error',
            lastError: error instanceof Error ? error.message : String(error),
          }))
        }
      }
    }

    const parseEvent = (event: MessageEvent<string>) => {
      try {
        return JSON.parse(event.data) as AgentPanelEvent
      } catch {
        return undefined
      }
    }

    const applyEvent = (event: AgentPanelEvent) => {
      switch (event.type) {
        case 'ready':
        case 'agent-state':
          setState(event.state)
          return
        case 'assistant-text-delta':
          setTranscript((current) => {
            const last = current[current.length - 1]
            if (last?.kind === 'assistant' && last.isStreaming) {
              return [...current.slice(0, -1), { ...last, text: `${last.text}${event.delta}`, timestamp: event.timestamp }]
            }

            return [
              ...current,
              {
                id: `assistant-${event.timestamp}`,
                kind: 'assistant',
                text: event.delta,
                isStreaming: true,
                timestamp: event.timestamp,
              },
            ]
          })
          return
        case 'assistant-message-complete':
          setTranscript((current) => {
            const last = current[current.length - 1]
            if (last?.kind === 'assistant' && last.isStreaming) {
              return [
                ...current.slice(0, -1),
                {
                  ...last,
                  text: event.text || last.text,
                  isStreaming: false,
                  timestamp: event.timestamp,
                  errorMessage: event.errorMessage,
                },
              ]
            }

            return [
              ...current,
              {
                id: `assistant-${event.timestamp}`,
                kind: 'assistant',
                text: event.text,
                isStreaming: false,
                timestamp: event.timestamp,
                errorMessage: event.errorMessage,
              },
            ]
          })
          return
        case 'tool-start':
          setToolActivity((current) => [
            ...current,
            {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              startedAt: Date.now(),
              preview: stringifyPreview(event.args),
            },
          ])
          return
        case 'tool-end':
          setToolActivity((current) =>
            current.map((entry) =>
              entry.toolCallId === event.toolCallId
                ? {
                    ...entry,
                    completedAt: Date.now(),
                    isError: event.isError,
                    preview: stringifyPreview(event.result) ?? entry.preview,
                  }
                : entry,
            ),
          )
          return
        case 'queue-update':
          setState((current) => ({
            ...current,
            queuedSteeringCount: event.steeringCount,
            queuedFollowUpCount: event.followUpCount,
          }))
          return
        case 'error':
          setTranscript((current) => [
            ...current,
            {
              id: `error-${Date.now()}`,
              kind: 'error',
              text: event.message,
              timestamp: Date.now(),
            },
          ])
          setState((current) => ({ ...current, status: 'error', lastError: event.message }))
      }
    }

    void loadState()

    const eventSource = new EventSource('/api/agent/events')
    eventSourceRef.current = eventSource

    const handleEvent = (event: MessageEvent<string>) => {
      const payload = parseEvent(event)
      if (payload) applyEvent(payload)
    }

    const eventNames: AgentPanelEvent['type'][] = ['ready', 'agent-state', 'assistant-text-delta', 'assistant-message-complete', 'tool-start', 'tool-end', 'queue-update', 'error']

    for (const eventName of eventNames) {
      eventSource.addEventListener(eventName, handleEvent as EventListener)
    }

    eventSource.onerror = () => {
      if (!disposed) {
        setState((current) => ({
          ...current,
          status: current.status === 'running' ? current.status : 'error',
          lastError: current.lastError || 'Lost connection to the agent event stream.',
        }))
      }
    }

    return () => {
      disposed = true
      for (const eventName of eventNames) {
        eventSource.removeEventListener(eventName, handleEvent as EventListener)
      }
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [])

  const setSelectedTicketContext = useCallback(async (ticket: SelectedTicketContext | undefined) => {
    await setAgentSelectedTicketContext(ticket)
  }, [])

  const sendPrompt = useCallback(async (text: string) => {
    await sendAgentPrompt(text)
  }, [])

  const abort = useCallback(async () => {
    await abortAgentRun()
  }, [])

  return {
    state,
    transcript,
    toolActivity,
    sendPrompt,
    abort,
    setSelectedTicketContext,
    refreshState,
  }
}
