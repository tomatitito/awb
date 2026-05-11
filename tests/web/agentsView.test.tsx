import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AgentRunState } from '../../src/agent/types'
import { AgentsView } from '../../src/web/workspace'

function makeUnticketedRun(status: AgentRunState['status'] = 'running'): AgentRunState {
  return {
    id: 'run-chat-1',
    context: {
      kind: 'unticketed',
      title: 'Refine the release checklist and add a new ticket',
    },
    status,
    createdAt: 1000,
    startedAt: 1001,
    completedAt: status === 'completed' || status === 'failed' || status === 'aborted' ? 1003 : undefined,
    abortedAt: status === 'aborted' ? 1003 : undefined,
    updatedAt: 1002,
    lastError: status === 'failed' ? 'Agent runtime rejected the run.' : undefined,
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

  test('shows a continue composer for completed runs', () => {
    const html = renderToStaticMarkup(
      <AgentsView
        runs={[makeUnticketedRun('completed')]}
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

    expect(html).toContain('Continue / resume conversation')
    expect(html).toContain('Send a follow-up prompt to continue this completed conversation.')
    expect(html).toContain('Continue conversation')
    expect(html).not.toContain('This run is read-only because it is no longer active.')
    expect(html).not.toContain('>Stop<')
  })

  test('keeps failed and aborted runs read-only with explanatory copy', () => {
    const failedHtml = renderToStaticMarkup(
      <AgentsView
        runs={[makeUnticketedRun('failed')]}
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
    const abortedHtml = renderToStaticMarkup(
      <AgentsView
        runs={[makeUnticketedRun('aborted')]}
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

    expect(failedHtml).toContain('This run failed and is read-only.')
    expect(failedHtml).toContain('Agent runtime rejected the run.')
    expect(failedHtml).not.toContain('Continue / resume conversation')
    expect(abortedHtml).toContain('This run was stopped before completion and is read-only.')
    expect(abortedHtml).not.toContain('Continue / resume conversation')
  })

  test('shows the completed-run continue affordance in the mobile detail view', () => {
    const html = renderToStaticMarkup(
      <AgentsView
        runs={[makeUnticketedRun('completed')]}
        selectedRunId="run-chat-1"
        onSelectRun={() => {}}
        onBack={() => {}}
        onSendPrompt={async () => {}}
        onAbortRun={async () => {}}
        onOpenWorktree={async () => {}}
        onCleanupWorktree={async () => {}}
        onCreateUnticketedRun={async () => makeUnticketedRun()}
        viewportMode="mobile"
      />,
    )

    expect(html).toContain('Back')
    expect(html).toContain('Continue / resume conversation')
    expect(html).toContain('Continue conversation')
  })
})
