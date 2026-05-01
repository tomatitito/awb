import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { discoverSelectableProjects, getAwbUserConfigDir } from '../src/projects'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

async function makeHome() {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-projects-home-'))
  tempDirs.push(homeDir)
  return homeDir
}

describe('getAwbUserConfigDir', () => {
  test('uses an XDG-style user config directory on linux', () => {
    expect(getAwbUserConfigDir({ platform: 'linux', env: { XDG_CONFIG_HOME: '/tmp/xdg-config' }, homeDir: '/home/tester' })).toBe('/tmp/xdg-config/awb')
  })
})

describe('discoverSelectableProjects', () => {
  test('reads selectable projects from the user-level allowlist config', async () => {
    const homeDir = await makeHome()
    const configDir = getAwbUserConfigDir({ platform: 'linux', env: {}, homeDir })
    const firstProject = path.join(homeDir, 'project-a')
    const secondProject = path.join(homeDir, 'project-b')
    await fs.mkdir(firstProject, { recursive: true })
    await fs.mkdir(secondProject, { recursive: true })
    await fs.mkdir(configDir, { recursive: true })
    await fs.writeFile(
      path.join(configDir, 'config.json'),
      JSON.stringify({
        projects: [{ root: firstProject, label: 'Project A' }, { root: secondProject }],
      }),
    )

    await expect(discoverSelectableProjects({ platform: 'linux', env: {}, homeDir })).resolves.toEqual(
      expect.objectContaining({
        projects: [{ root: firstProject, label: 'Project A' }, { root: secondProject }],
        warnings: [],
      }),
    )
  })

  test('handles missing config files gracefully', async () => {
    const homeDir = await makeHome()

    await expect(discoverSelectableProjects({ platform: 'linux', env: {}, homeDir })).resolves.toEqual(
      expect.objectContaining({
        projects: [],
        warnings: [],
      }),
    )
  })

  test('skips invalid, missing, and duplicate entries gracefully', async () => {
    const homeDir = await makeHome()
    const configDir = getAwbUserConfigDir({ platform: 'linux', env: {}, homeDir })
    const validProject = path.join(homeDir, 'valid-project')
    await fs.mkdir(validProject, { recursive: true })
    await fs.mkdir(configDir, { recursive: true })
    await fs.writeFile(
      path.join(configDir, 'config.json'),
      JSON.stringify({
        projects: [
          { root: validProject, label: 'Valid' },
          { root: validProject, label: 'Duplicate' },
          { root: path.join(homeDir, 'missing-project') },
          { root: '' },
          { label: 'No root' },
          'invalid',
        ],
      }),
    )

    const result = await discoverSelectableProjects({ platform: 'linux', env: {}, homeDir })

    expect(result.projects).toEqual([{ root: validProject, label: 'Valid' }])
    expect(result.warnings.length).toBeGreaterThanOrEqual(4)
  })
})
