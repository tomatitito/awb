import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AgentRunResumeHealth, AgentRunState } from '../../src/agent/types'
import { AgentsView } from '../../src/web/workspace'

function makeUnticketedRun(status: AgentRunState['status'] = 'running', resume?: AgentRunResumeHealth): AgentRunState {
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
    closedAt: status === 'closed' ? 1003 : undefined,
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
    resume,
  }
}

function makeTicketRun(status: AgentRunState['status'] = 'completed'): AgentRunState {
  return {
    ...makeUnticketedRun(status),
    id: 'run-ticket-1',
    context: {
      kind: 'ticket',
      ticketId: 'awb-ticket-1',
      title: 'Implement ticket-backed behavior',
      body: 'Do the ticket work.',
      filePath: '/tickets/awb-ticket-1.md',
    },
    transcript: {
      ...makeUnticketedRun(status).transcript,
      runId: 'run-ticket-1',
      initialPrompt: 'Use red/green TDD to implement this ticket.',
    },
  }
}

function renderAgentsView(run: AgentRunState, viewportMode: 'desktop' | 'mobile' = 'desktop'): string {
  return renderToStaticMarkup(
    <AgentsView
      runs={[run]}
      selectedRunId="run-chat-1"
      onSelectRun={() => {}}
      onBack={() => {}}
      onSendPrompt={async () => {}}
      onAbortRun={async () => {}}
      onCloseUnticketedRun={async () => makeUnticketedRun('closed')}
      onOpenWorktree={async () => {}}
      onCleanupWorktree={async () => {}}
      onCreateUnticketedRun={async () => makeUnticketedRun()}
      viewportMode={viewportMode}
    />,
  )
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
        onCloseUnticketedRun={async () => makeUnticketedRun('closed')}
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
        onCloseUnticketedRun={async () => makeUnticketedRun('closed')}
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
        onCloseUnticketedRun={async () => makeUnticketedRun('closed')}
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

  test('shows close chat controls for waiting unticketed chats without showing stop', () => {
    const html = renderAgentsView(makeUnticketedRun('waiting'))

    expect(html).toContain('Chat controls')
    expect(html).toContain('Close chat')
    expect(html).toContain('Close this chat and keep its history for later resume.')
    expect(html).toContain('Follow-up prompt')
    expect(html).not.toContain('>Stop<')
  })

  test('distinguishes stop from close while an unticketed chat is running', () => {
    const html = renderAgentsView(makeUnticketedRun('running'))

    expect(html).toContain('Close chat')
    expect(html).toContain('Stop the current response and close this chat.')
    expect(html).toContain('>Stop<')
    expect(html).toContain('Stop only the current response. Use Close chat to end the chat.')
  })

  test('does not show close chat controls for ticket-backed runs', () => {
    const html = renderAgentsView(makeTicketRun('completed'))

    expect(html).toContain('awb-ticket-1')
    expect(html).toContain('Continue / resume conversation')
    expect(html).not.toContain('Chat controls')
    expect(html).not.toContain('Close chat')
  })

  test('keeps closed unticketed chats read-only without close or stop controls', () => {
    const html = renderAgentsView(makeUnticketedRun('closed'))

    expect(html).toContain('This chat is closed and read-only.')
    expect(html).not.toContain('Follow-up prompt')
    expect(html).not.toContain('Close chat')
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
        onCloseUnticketedRun={async () => makeUnticketedRun('closed')}
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
        onCloseUnticketedRun={async () => makeUnticketedRun('closed')}
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
    const html = renderAgentsView(makeUnticketedRun('completed'), 'mobile')

    expect(html).toContain('Back')
    expect(html).toContain('Continue / resume conversation')
    expect(html).toContain('Continue conversation')
  })

  test('shows close chat controls in the mobile detail view', () => {
    const html = renderAgentsView(makeUnticketedRun('waiting'), 'mobile')

    expect(html).toContain('Back')
    expect(html).toContain('Close chat')
    expect(html).toContain('Close this chat and keep its history for later resume.')
  })

  test('shows available persisted resume health with a reopen affordance', () => {
    const html = renderAgentsView(
      makeUnticketedRun('completed', {
        state: 'available',
        lastCheckedAt: 2000,
        error: null,
      }),
    )

    expect(html).toContain('Resume available')
    expect(html).toContain('This persisted conversation can be reopened by sending a follow-up prompt.')
    expect(html).toContain('Continue / resume conversation')
    expect(html).toContain('Continue conversation')
  })

  test.each([
    ['not-started', 'Resume not started', 'This run never created a pi session file, so the persisted conversation cannot be resumed.', 'No pi session file was recorded.'],
    ['missing-session-file', 'Session file missing', 'The recorded pi session file is missing.', '/tmp/missing-session.jsonl does not exist.'],
    ['invalid-session-file', 'Session file invalid', 'The recorded pi session file could not be opened.', 'invalid session contents'],
    ['cwd-mismatch', 'Session cwd mismatch', 'The recorded session cwd does not match this run cwd.', 'session cwd /tmp/old does not match /tmp/new'],
    ['worktree-missing', 'Worktree missing', 'The retained worktree for this run is missing.', '/tmp/worktree is gone'],
    ['worktree-cleaned', 'Worktree cleaned', 'The retained worktree for this run was cleaned.', 'Worktree for run run-chat-1 was cleaned.'],
  ] as const)('renders %s resume health as read-only with stored error copy', (state, rowSummary, detailCopy, error) => {
    const html = renderAgentsView(
      makeUnticketedRun('completed', {
        state,
        lastCheckedAt: 2000,
        error,
      }),
    )

    expect(html).toContain(rowSummary)
    expect(html).toContain(detailCopy)
    expect(html).toContain(error)
    expect(html).not.toContain('Continue / resume conversation')
    expect(html).not.toContain('Continue conversation')
  })

  test('shows unavailable persisted resume health as read-only in the mobile detail view', () => {
    const html = renderAgentsView(
      makeUnticketedRun('completed', {
        state: 'worktree-cleaned',
        lastCheckedAt: 2000,
        error: 'Worktree for run run-chat-1 was cleaned.',
      }),
      'mobile',
    )

    expect(html).toContain('Back')
    expect(html).toContain('The retained worktree for this run was cleaned.')
    expect(html).not.toContain('Continue / resume conversation')
    expect(html).not.toContain('Continue conversation')
  })
})
