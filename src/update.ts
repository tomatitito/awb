import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const DEFAULT_RELEASE_CHECK_URL = 'https://api.github.com/repos/tomatitito/awb/releases/latest'
export const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 6
const CACHE_FILE_NAME = 'update-check.json'

export type ReleaseMetadata = {
  version: string
  htmlUrl: string
  publishedAt?: string
}

export type CachedUpdateCheck = {
  endpoint: string
  checkedAt: number
  latestRelease: ReleaseMetadata
}

export type UpdateCheckResult = {
  currentVersion: string
  latestVersion?: string
  latestReleaseUrl?: string
  updateAvailable: boolean
  checkedAt: number
  fromCache: boolean
  error?: string
}

export function compareSemver(left: string, right: string): number {
  const leftParts = normalizeVersion(left)
  const rightParts = normalizeVersion(right)

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (diff !== 0) return diff
  }

  return 0
}

function normalizeVersion(version: string): number[] {
  const clean = version.trim().replace(/^v/, '').split('-')[0] ?? version.trim().replace(/^v/, '')
  return clean.split('.').map((part) => Number.parseInt(part, 10) || 0)
}

export function getUserCacheDir(options: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv | Record<string, string | undefined>; homeDir?: string } = {}): string {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const homeDir = options.homeDir ?? os.homedir()

  if (platform === 'darwin') return path.join(homeDir, 'Library', 'Caches', 'awb')
  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA
    return localAppData ? path.join(localAppData, 'awb', 'Cache') : path.join(homeDir, 'AppData', 'Local', 'awb', 'Cache')
  }
  const xdgCacheHome = env.XDG_CACHE_HOME
  return xdgCacheHome ? path.join(xdgCacheHome, 'awb') : path.join(homeDir, '.cache', 'awb')
}

function getCacheFilePath(cacheDir: string): string {
  return path.join(cacheDir, CACHE_FILE_NAME)
}

export async function readCachedUpdateCheck(cacheDir: string): Promise<CachedUpdateCheck | undefined> {
  try {
    const content = await fs.readFile(getCacheFilePath(cacheDir), 'utf8')
    return JSON.parse(content) as CachedUpdateCheck
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined
    if (code === 'ENOENT') return undefined
    throw error
  }
}

export async function writeCachedUpdateCheck(cacheDir: string, payload: CachedUpdateCheck): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true })
  await fs.writeFile(getCacheFilePath(cacheDir), JSON.stringify(payload, null, 2))
}

export async function fetchLatestGithubRelease(endpoint = DEFAULT_RELEASE_CHECK_URL): Promise<ReleaseMetadata> {
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'awb-update-check',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub update check failed: ${response.status}`)
  }

  const payload = (await response.json()) as {
    tag_name?: string
    html_url?: string
    published_at?: string
    prerelease?: boolean
  }

  if (payload.prerelease) {
    throw new Error('Latest GitHub release is a prerelease.')
  }

  const version = payload.tag_name?.replace(/^v/, '')
  if (!version || !payload.html_url) {
    throw new Error('GitHub update metadata is incomplete.')
  }

  return {
    version,
    htmlUrl: payload.html_url,
    publishedAt: payload.published_at,
  }
}

export async function checkForAwbUpdates(options: {
  currentVersion: string
  cacheDir?: string
  endpoint?: string
  cacheTtlMs?: number
  forceRefresh?: boolean
  now?: () => number
  fetchLatestRelease?: (endpoint?: string) => Promise<ReleaseMetadata>
}): Promise<UpdateCheckResult> {
  const now = options.now ?? Date.now
  const checkedAt = now()
  const cacheDir = options.cacheDir ?? getUserCacheDir()
  const endpoint = options.endpoint ?? DEFAULT_RELEASE_CHECK_URL
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  const fetchLatestRelease = options.fetchLatestRelease ?? fetchLatestGithubRelease

  try {
    if (!options.forceRefresh) {
      const cached = await readCachedUpdateCheck(cacheDir)
      if (cached && cached.endpoint === endpoint && checkedAt - cached.checkedAt <= cacheTtlMs) {
        return {
          currentVersion: options.currentVersion,
          latestVersion: cached.latestRelease.version,
          latestReleaseUrl: cached.latestRelease.htmlUrl,
          updateAvailable: compareSemver(cached.latestRelease.version, options.currentVersion) > 0,
          checkedAt: cached.checkedAt,
          fromCache: true,
        }
      }
    }

    const latestRelease = await fetchLatestRelease(endpoint)
    await writeCachedUpdateCheck(cacheDir, {
      endpoint,
      checkedAt,
      latestRelease,
    })

    return {
      currentVersion: options.currentVersion,
      latestVersion: latestRelease.version,
      latestReleaseUrl: latestRelease.htmlUrl,
      updateAvailable: compareSemver(latestRelease.version, options.currentVersion) > 0,
      checkedAt,
      fromCache: false,
    }
  } catch (error) {
    return {
      currentVersion: options.currentVersion,
      updateAvailable: false,
      checkedAt,
      fromCache: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export function formatUpdateNotice(result: UpdateCheckResult): string | undefined {
  if (!result.updateAvailable || !result.latestVersion) return undefined
  return [
    `awb: update available ${result.currentVersion} -> ${result.latestVersion}`,
    result.latestReleaseUrl ? `awb: download the latest release from ${result.latestReleaseUrl}` : 'awb: run `awb check-for-updates` for more details',
  ].join('\n')
}
