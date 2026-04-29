import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { AgentRunWorktreeState } from './types.js'

export type RunCommand = (command: string, args: string[], options?: { cwd?: string }) => Promise<string>

export type GitWorktreeManagerOptions = {
  enabled: boolean
  now: () => number
  runCommand?: RunCommand
}

async function defaultRunCommand(command: string, args: string[], options?: { cwd?: string }): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout.trim())
        return
      }
      reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code ?? 'unknown'}`))
    })
  })
}

export class GitWorktreeManager {
  readonly enabled: boolean
  private readonly now: () => number
  private readonly runCommand: RunCommand

  constructor(
    private readonly projectDir: string,
    options: GitWorktreeManagerOptions,
  ) {
    this.enabled = options.enabled
    this.now = options.now
    this.runCommand = options.runCommand ?? defaultRunCommand
  }

  getWorktreesRoot(): string {
    return path.join(this.projectDir, '.awb', 'worktrees')
  }

  getWorktreePath(runId: string): string {
    return path.join(this.getWorktreesRoot(), runId)
  }

  getBranchName(runId: string): string {
    return `awb/run/${runId}`
  }

  async provision(runId: string): Promise<AgentRunWorktreeState> {
    const worktreePath = this.getWorktreePath(runId)
    const branch = this.getBranchName(runId)
    const baseRef = 'HEAD'

    await fs.mkdir(this.getWorktreesRoot(), { recursive: true })
    await this.runCommand('git', ['worktree', 'add', '-b', branch, worktreePath, baseRef], { cwd: this.projectDir })
    const headSha = await this.runCommand('git', ['-C', worktreePath, 'rev-parse', 'HEAD'], { cwd: this.projectDir })
    const timestamp = this.now()

    return {
      mode: 'git-worktree',
      status: 'ready',
      path: worktreePath,
      branch,
      baseRef,
      headSha,
      createdAt: timestamp,
      lastCheckedAt: timestamp,
    }
  }

  async cleanup(worktree: AgentRunWorktreeState, options: { removeBranch: boolean }): Promise<AgentRunWorktreeState> {
    const timestamp = this.now()
    const next: AgentRunWorktreeState = {
      ...worktree,
      mode: 'git-worktree',
      status: 'cleaning',
      cleanupStartedAt: timestamp,
      cleanupError: undefined,
    }

    try {
      if (worktree.path) {
        try {
          await this.runCommand('git', ['worktree', 'remove', '--force', worktree.path], { cwd: this.projectDir })
        } catch {
          await fs.rm(worktree.path, { recursive: true, force: true })
        }
      }
      if (options.removeBranch && worktree.branch) {
        await this.runCommand('git', ['branch', '-D', worktree.branch], { cwd: this.projectDir })
      }
      return {
        ...next,
        status: 'cleaned',
        cleanedAt: this.now(),
        lastCheckedAt: this.now(),
      }
    } catch (error) {
      return {
        ...next,
        status: 'failed',
        cleanupError: error instanceof Error ? error.message : String(error),
        lastCheckedAt: this.now(),
      }
    }
  }

  async reconcileStaleWorktrees(): Promise<void> {
    if (!this.enabled) return
    try {
      const entries = await fs.readdir(this.getWorktreesRoot(), { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const stalePath = path.join(this.getWorktreesRoot(), entry.name)
        try {
          await this.runCommand('git', ['worktree', 'remove', '--force', stalePath], { cwd: this.projectDir })
        } catch {
          await fs.rm(stalePath, { recursive: true, force: true })
        }
      }
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined
      if (code !== 'ENOENT') throw error
    }
  }
}
