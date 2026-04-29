import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { GitWorktreeManager } from '../../src/agent/worktree'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('GitWorktreeManager', () => {
  test('reconciles stale worktree directories on startup', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-worktree-'))
    tempDirs.push(projectDir)
    const worktreesDir = path.join(projectDir, '.awb', 'worktrees', 'orphan-run')
    await fs.mkdir(worktreesDir, { recursive: true })
    await fs.writeFile(path.join(worktreesDir, 'leftover.txt'), 'stale')

    const calls: string[] = []
    const manager = new GitWorktreeManager(projectDir, {
      enabled: true,
      now: () => 1000,
      runCommand: async (command, args) => {
        calls.push([command, ...args].join(' '))
        if (args[0] === 'worktree' && args[1] === 'remove') {
          await fs.rm(worktreesDir, { recursive: true, force: true })
        }
        return ''
      },
    })

    await manager.reconcileStaleWorktrees()

    expect(calls).toContain(`git worktree remove --force ${worktreesDir}`)
    await expect(fs.access(worktreesDir)).rejects.toThrow()
  })
})
