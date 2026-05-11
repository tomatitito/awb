import fs from 'node:fs'
import path from 'node:path'
import type { AgentRunResumeHealth, AgentRunState, AgentRunWorktreeState } from './types.js'

const STORAGE_VERSION = 1
const STALE_RUN_ERROR = 'AWB stopped before this run completed.'

type PersistedAgentRunFile = {
  storageVersion?: number
  projectDir?: string
  run?: Partial<AgentRunState>
  resume?: AgentRunResumeHealth
}

export type AgentRunStorageLoadResult = {
  runs: AgentRunState[]
  warnings: string[]
}

export class AgentRunStorage {
  private readonly runsDir: string

  constructor(
    private readonly projectDir: string,
    private readonly now: () => number,
  ) {
    this.runsDir = path.join(projectDir, '.awb', 'agent-runs')
  }

  load(): AgentRunStorageLoadResult {
    const warnings: string[] = []
    if (!fs.existsSync(this.runsDir)) return { runs: [], warnings }

    const runs: AgentRunState[] = []
    for (const entry of fs.readdirSync(this.runsDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.json')) continue

      const filePath = path.join(this.runsDir, entry.name)
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as PersistedAgentRunFile
        runs.push(this.normalizeRunFile(parsed, filePath))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        warnings.push(`Ignoring persisted agent run ${filePath}: ${message}`)
      }
    }

    runs.sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt || b.id.localeCompare(a.id))
    return { runs, warnings }
  }

  save(run: AgentRunState): void {
    fs.mkdirSync(this.runsDir, { recursive: true })
    const filePath = this.runFilePath(run.id)
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const resume = this.computeResume(run)
    run.resume = resume
    const snapshot = {
      storageVersion: STORAGE_VERSION,
      projectDir: this.projectDir,
      run: {
        ...run,
        worktree: run.worktree ?? defaultWorktree(),
        resume: undefined,
      },
      resume,
    }

    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
    fs.renameSync(tempPath, filePath)
  }

  private normalizeRunFile(file: PersistedAgentRunFile, filePath: string): AgentRunState {
    const run = file.run
    if (!run || typeof run.id !== 'string' || !run.context || !run.transcript) {
      throw new Error('run snapshot is missing required fields')
    }

    const timestamp = this.now()
    const normalized: AgentRunState = {
      ...run,
      id: run.id,
      context: run.context,
      status: run.status ?? 'failed',
      createdAt: numberOr(run.createdAt, timestamp),
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      abortedAt: run.abortedAt,
      closedAt: run.closedAt,
      updatedAt: numberOr(run.updatedAt, numberOr(run.transcript.updatedAt, timestamp)),
      transcript: {
        runId: run.transcript.runId ?? run.id,
        initialPrompt: run.transcript.initialPrompt ?? '',
        entries: Array.isArray(run.transcript.entries) ? run.transcript.entries : [],
        toolActivity: Array.isArray(run.transcript.toolActivity) ? run.transcript.toolActivity : [],
        updatedAt: numberOr(run.transcript.updatedAt, numberOr(run.updatedAt, timestamp)),
      },
      queuedSteeringCount: numberOr(run.queuedSteeringCount, 0),
      queuedFollowUpCount: numberOr(run.queuedFollowUpCount, 0),
      sessionId: run.sessionId,
      sessionFile: run.sessionFile,
      model: run.model,
      lastError: run.lastError,
      worktree: run.worktree ?? defaultWorktree(),
    }

    if (normalized.status === 'queued' || normalized.status === 'starting' || normalized.status === 'running') {
      normalized.status = 'failed'
      normalized.lastError = STALE_RUN_ERROR
      normalized.completedAt = timestamp
      normalized.updatedAt = Math.max(normalized.updatedAt, timestamp)
      normalized.transcript.updatedAt = Math.max(normalized.transcript.updatedAt, timestamp)
    }

    normalized.resume = file.resume ?? this.computeResume(normalized)
    normalized.resume = this.normalizeResume(normalized, normalized.resume)

    if (path.basename(filePath) !== `${normalized.id}.json`) {
      throw new Error(`run id ${normalized.id} does not match file name`)
    }

    return normalized
  }

  private normalizeResume(run: AgentRunState, resume: AgentRunResumeHealth): AgentRunResumeHealth {
    const computed = this.computeResume(run)
    return {
      state: resume.state ?? computed.state,
      lastCheckedAt: numberOr(resume.lastCheckedAt, computed.lastCheckedAt),
      error: resume.error ?? computed.error ?? null,
    }
  }

  private computeResume(run: AgentRunState): AgentRunResumeHealth {
    const checkedAt = this.now()
    if (run.worktree?.mode === 'git-worktree') {
      if (run.worktree.status === 'cleaned') {
        return { state: 'worktree-cleaned', lastCheckedAt: checkedAt, error: null }
      }
      if (run.worktree.path && !fs.existsSync(run.worktree.path)) {
        return { state: 'worktree-missing', lastCheckedAt: checkedAt, error: `Worktree path ${run.worktree.path} does not exist.` }
      }
    }

    if (!run.sessionFile) return { state: 'not-started', lastCheckedAt: checkedAt, error: null }
    if (!fs.existsSync(run.sessionFile)) {
      return { state: 'missing-session-file', lastCheckedAt: checkedAt, error: `Session file ${run.sessionFile} does not exist.` }
    }
    if (run.resume?.state === 'invalid-session-file' || run.resume?.state === 'cwd-mismatch') {
      return {
        ...run.resume,
        lastCheckedAt: checkedAt,
      }
    }
    return { state: 'available', lastCheckedAt: checkedAt, error: null }
  }

  private runFilePath(runId: string): string {
    return path.join(this.runsDir, `${runId}.json`)
  }
}

function defaultWorktree(): AgentRunWorktreeState {
  return { mode: 'shared-project', status: 'not-requested' }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
