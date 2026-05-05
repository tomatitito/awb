import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AgentRunState } from '../../src/agent/types'
import { AgentsView } from '../../src/web/workspace'

function makeUnticketedRun(): AgentRunState {
  return {
    id: 'run-chat-1',
    context: {
      kind: 'unticketed',
      title: 'Refine the release checklist and add a new ticket',
    },
    status: 'running',
    createdAt: 1000,
    startedAt: 1001,
    updatedAt: 1002,
    transcript: {
      runId: 'run-chat-1',
      initialPrompt: 'Refine the release checklist and add a new ticket',
      entries: [
        {
          id: 'run-chat-1:user:initial',
          role: 'user',
          text: 'Refine the release checklist and add a new ticket',
          timestamp: 1000,
        },
      ],
      toolActivity: [],
      updatedAt: 1002,
    },
    queuedSteeringCount: 0,
    queuedFollowUpCount: 0,
    worktree: {
      mode: 'shared-project',
      status: 'not-requested',
    },
  }
}

describe('AgentsView unticketed runs', () => {
  test('renders a new agent chat composer and unticketed run labels without fake ticket ids', () => {
    const html = renderToStaticMarkup(
      <AgentsView
        runs={[makeUnticketedRun()]}
        selectedRunId="run-chat-1"
        onSelectRun={() => {}}
        onBack={() => {}}
        onSendPrompt={async () => {}}
        onAbortRun={async () => {}}
        onOpenWorktree={async () => {}}
        onCleanupWorktree={async () => {}}
        onCreateUnticketedRun={async () => makeUnticketedRun()}
        viewportMode="desktop"
      />,
    )

    expect(html).toContain('New agent chat')
    expect(html).toContain('Unticketed agent chat')
    expect(html).toContain('Refine the release checklist and add a new ticket')
    expect(html).not.toContain('ticketId')
    expect(html).not.toContain('undefined —')
  })

  test('still shows the new agent chat action when no runs exist yet', () => {
    const html = renderToStaticMarkup(
      <AgentsView
        runs={[]}
        onSelectRun={() => {}}
        onBack={() => {}}
        onSendPrompt={async () => {}}
        onAbortRun={async () => {}}
        onOpenWorktree={async () => {}}
        onCleanupWorktree={async () => {}}
        onCreateUnticketedRun={async () => makeUnticketedRun()}
        viewportMode="desktop"
      />,
    )

    expect(html).toContain('New agent chat')
    expect(html).toContain('No agent runs yet.')
    expect(html).toContain('Start a new unticketed agent conversation')
  })
})
