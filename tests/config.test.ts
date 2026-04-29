import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadAwbSettings } from '../src/config'

const tempDirs: string[] = []

async function makeProject(config?: unknown) {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-config-'))
  tempDirs.push(projectDir)
  await fs.mkdir(path.join(projectDir, '.awb'), { recursive: true })
  if (config !== undefined) {
    await fs.writeFile(path.join(projectDir, '.awb', 'config.json'), JSON.stringify(config, null, 2))
  }
  return projectDir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('loadAwbSettings', () => {
  test('reads editor and worktree isolation from the project config file', async () => {
    const projectDir = await makeProject({ editor: 'zed', agentRuns: { worktreeIsolation: true } })

    await expect(loadAwbSettings({ projectDir, env: {} })).resolves.toEqual({
      editorCommand: 'zed',
      worktreeIsolationEnabled: true,
    })
  })

  test('uses AWB_EDITOR over the config file', async () => {
    const projectDir = await makeProject({ editor: 'zed' })

    await expect(loadAwbSettings({ projectDir, env: { AWB_EDITOR: 'code --reuse-window' } })).resolves.toEqual({
      editorCommand: 'code --reuse-window',
      worktreeIsolationEnabled: false,
    })
  })

  test('uses the cli editor override over AWB_EDITOR', async () => {
    const projectDir = await makeProject({ editor: 'zed' })

    await expect(loadAwbSettings({ projectDir, env: { AWB_EDITOR: 'code --reuse-window' }, editorOverride: 'hx' })).resolves.toEqual({
      editorCommand: 'hx',
      worktreeIsolationEnabled: false,
    })
  })
})
