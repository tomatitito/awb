import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { checkForAwbUpdates, compareSemver, DEFAULT_RELEASE_CHECK_URL, getUserCacheDir, type ReleaseMetadata, readCachedUpdateCheck, writeCachedUpdateCheck } from '../src/update'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('compareSemver', () => {
  test('compares semantic versions numerically', () => {
    expect(compareSemver('0.10.0', '0.9.9')).toBeGreaterThan(0)
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0)
    expect(compareSemver('1.2.3', '1.3.0')).toBeLessThan(0)
  })
})

describe('update cache', () => {
  test('writes and reads cached update results from a user-level cache path', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-update-home-'))
    tempDirs.push(homeDir)

    const cacheDir = getUserCacheDir({ platform: 'linux', env: {}, homeDir })
    const cachedAt = 1234
    const release: ReleaseMetadata = {
      version: '0.2.0',
      htmlUrl: 'https://github.com/tomatitito/awb/releases/tag/v0.2.0',
      publishedAt: '2026-04-29T00:00:00Z',
    }

    await writeCachedUpdateCheck(cacheDir, {
      endpoint: DEFAULT_RELEASE_CHECK_URL,
      checkedAt: cachedAt,
      latestRelease: release,
    })

    await expect(readCachedUpdateCheck(cacheDir)).resolves.toEqual({
      endpoint: DEFAULT_RELEASE_CHECK_URL,
      checkedAt: cachedAt,
      latestRelease: release,
    })
  })
})

describe('checkForAwbUpdates', () => {
  test('uses fresh cached release metadata without refetching', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-update-cache-'))
    tempDirs.push(homeDir)
    const cacheDir = getUserCacheDir({ platform: 'linux', env: {}, homeDir })

    await writeCachedUpdateCheck(cacheDir, {
      endpoint: DEFAULT_RELEASE_CHECK_URL,
      checkedAt: 2_000,
      latestRelease: {
        version: '0.2.0',
        htmlUrl: 'https://github.com/tomatitito/awb/releases/tag/v0.2.0',
        publishedAt: '2026-04-29T00:00:00Z',
      },
    })

    let fetchCalled = false
    const result = await checkForAwbUpdates({
      currentVersion: '0.1.0',
      cacheDir,
      now: () => 2_500,
      cacheTtlMs: 5_000,
      fetchLatestRelease: async () => {
        fetchCalled = true
        throw new Error('should not fetch')
      },
    })

    expect(fetchCalled).toBe(false)
    expect(result.latestVersion).toBe('0.2.0')
    expect(result.updateAvailable).toBe(true)
  })

  test('bypasses cache for an explicit manual check', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-update-force-'))
    tempDirs.push(homeDir)
    const cacheDir = getUserCacheDir({ platform: 'linux', env: {}, homeDir })

    await writeCachedUpdateCheck(cacheDir, {
      endpoint: DEFAULT_RELEASE_CHECK_URL,
      checkedAt: 2_000,
      latestRelease: {
        version: '0.2.0',
        htmlUrl: 'https://github.com/tomatitito/awb/releases/tag/v0.2.0',
        publishedAt: '2026-04-29T00:00:00Z',
      },
    })

    const result = await checkForAwbUpdates({
      currentVersion: '0.2.0',
      cacheDir,
      now: () => 2_500,
      cacheTtlMs: 5_000,
      forceRefresh: true,
      fetchLatestRelease: async () => ({
        version: '0.3.0',
        htmlUrl: 'https://github.com/tomatitito/awb/releases/tag/v0.3.0',
        publishedAt: '2026-05-01T00:00:00Z',
      }),
    })

    expect(result.latestVersion).toBe('0.3.0')
    expect(result.updateAvailable).toBe(true)
  })

  test('ignores fetch failures during normal silent checks', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-update-fail-'))
    tempDirs.push(homeDir)
    const cacheDir = getUserCacheDir({ platform: 'linux', env: {}, homeDir })

    const result = await checkForAwbUpdates({
      currentVersion: '0.1.0',
      cacheDir,
      now: () => 3_000,
      fetchLatestRelease: async () => {
        throw new Error('offline')
      },
    })

    expect(result.error).toBe('offline')
    expect(result.latestVersion).toBeUndefined()
    expect(result.updateAvailable).toBe(false)
  })
})
