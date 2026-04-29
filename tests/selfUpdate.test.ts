import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  detectInstallMethod,
  parseChecksumsFile,
  type ReleaseAsset,
  type ReleaseMetadataWithAssets,
  replaceExecutableSafely,
  resolveManualUpgradeInstructions,
  selectReleaseArtifacts,
  selfUpdateAwb,
} from '../src/selfUpdate'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

function makeRelease(version: string, assets: ReleaseAsset[]): ReleaseMetadataWithAssets {
  return {
    version,
    htmlUrl: `https://github.com/tomatitito/awb/releases/tag/v${version}`,
    assets,
  }
}

describe('detectInstallMethod', () => {
  test('detects a managed GitHub release install from adjacent metadata', async () => {
    const installRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-managed-'))
    tempDirs.push(installRoot)
    const executablePath = path.join(installRoot, 'awb')
    await fs.writeFile(executablePath, 'binary')
    await fs.writeFile(path.join(installRoot, 'awb-install.json'), JSON.stringify({ channel: 'github-release', owner: 'tomatitito/awb' }))

    await expect(detectInstallMethod({ executablePath, env: {} })).resolves.toEqual(
      expect.objectContaining({
        kind: 'managed-github-release',
        executablePath,
      }),
    )
  })

  test('detects bun global installs as unsupported', async () => {
    const result = await detectInstallMethod({
      executablePath: '/usr/local/bin/awb',
      env: { npm_config_user_agent: 'bun/1.2.18 npm/? node/?' },
    })

    expect(result.kind).toBe('bun-global')
    expect(resolveManualUpgradeInstructions(result)).toContain('bun install -g awb@latest')
  })
})

describe('selectReleaseArtifacts', () => {
  test('selects the platform archive and checksums asset for the current platform', () => {
    const release = makeRelease('0.2.0', [
      { name: 'awb-v0.2.0-darwin-arm64.tar.gz', downloadUrl: 'https://example.com/darwin-arm64.tar.gz' },
      { name: 'awb-v0.2.0-checksums.txt', downloadUrl: 'https://example.com/checksums.txt' },
    ])

    expect(selectReleaseArtifacts(release, { platform: 'darwin', arch: 'arm64' })).toEqual({
      archive: release.assets[0],
      checksums: release.assets[1],
    })
  })
})

describe('parseChecksumsFile', () => {
  test('parses sha256 checksums by artifact name', () => {
    expect(parseChecksumsFile(['abc123  awb-v0.2.0-darwin-arm64.tar.gz', 'def456  awb-v0.2.0-checksums.txt'].join('\n'))).toEqual(
      new Map([
        ['awb-v0.2.0-darwin-arm64.tar.gz', 'abc123'],
        ['awb-v0.2.0-checksums.txt', 'def456'],
      ]),
    )
  })
})

describe('replaceExecutableSafely', () => {
  test('replaces the executable and preserves usability on success', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-replace-'))
    tempDirs.push(dir)
    const currentPath = path.join(dir, 'awb')
    const nextPath = path.join(dir, 'next-awb')
    await fs.writeFile(currentPath, 'old-version')
    await fs.writeFile(nextPath, 'new-version')

    await replaceExecutableSafely({ currentPath, nextPath })

    await expect(fs.readFile(currentPath, 'utf8')).resolves.toBe('new-version')
  })
})

describe('selfUpdateAwb', () => {
  test('returns manual guidance for unsupported installs', async () => {
    const result = await selfUpdateAwb({
      currentVersion: '0.1.0',
      executablePath: '/usr/local/bin/awb',
      env: { npm_config_user_agent: 'bun/1.2.18 npm/? node/?' },
      fetchRelease: async () => makeRelease('0.2.0', []),
    })

    expect(result.status).toBe('unsupported')
    expect(result.updated).toBe(false)
    expect(result.message).toContain('bun install -g awb@latest')
  })

  test('updates a managed install when a newer release exists', async () => {
    const installRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-update-managed-'))
    tempDirs.push(installRoot)
    const executablePath = path.join(installRoot, 'awb')
    await fs.writeFile(executablePath, 'old-version')
    await fs.writeFile(path.join(installRoot, 'awb-install.json'), JSON.stringify({ channel: 'github-release', owner: 'tomatitito/awb' }))

    const release = makeRelease('0.2.0', [
      { name: 'awb-v0.2.0-linux-x64.tar.gz', downloadUrl: 'https://example.com/awb-v0.2.0-linux-x64.tar.gz' },
      { name: 'awb-v0.2.0-checksums.txt', downloadUrl: 'https://example.com/awb-v0.2.0-checksums.txt' },
    ])
    const archiveContent = 'archive-bits'
    const checksum = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(archiveContent)).then((buffer) =>
      Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    )

    const result = await selfUpdateAwb({
      currentVersion: '0.1.0',
      executablePath,
      platform: 'linux',
      arch: 'x64',
      fetchRelease: async () => release,
      downloadText: async () => `${checksum}  awb-v0.2.0-linux-x64.tar.gz`,
      downloadFile: async (_url, destinationPath) => {
        await fs.writeFile(destinationPath, archiveContent)
      },
      extractArchive: async (_archivePath, destinationDir) => {
        await fs.writeFile(path.join(destinationDir, 'awb'), 'new-version')
      },
    })

    expect(result.status).toBe('updated')
    expect(result.updated).toBe(true)
    expect(result.version).toBe('0.2.0')
    await expect(fs.readFile(executablePath, 'utf8')).resolves.toBe('new-version')
  })
})
