import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { compareSemver, DEFAULT_RELEASE_CHECK_URL } from './update.js'

const INSTALL_METADATA_FILE_NAME = 'awb-install.json'
const MANAGED_RELEASE_OWNER = 'tomatitito/awb'

type SelfUpdatePlatform = 'darwin' | 'linux' | 'windows'
type SelfUpdateArch = 'x64' | 'arm64'

export type InstallMetadata = {
  channel: 'github-release'
  owner: string
}

export type InstallMethod =
  | {
      kind: 'managed-github-release'
      executablePath: string
      metadataPath: string
      metadata: InstallMetadata
      supportsSelfUpdate: true
    }
  | {
      kind: 'bun-global' | 'npm-global' | 'source-checkout' | 'unknown'
      executablePath: string
      supportsSelfUpdate: false
    }

export type ReleaseAsset = {
  name: string
  downloadUrl: string
}

export type ReleaseMetadataWithAssets = {
  version: string
  htmlUrl: string
  assets: ReleaseAsset[]
}

export async function detectInstallMethod(options: { executablePath: string; invocationPath?: string; env?: Record<string, string | undefined> }): Promise<InstallMethod> {
  const env = options.env ?? process.env
  const metadataPath = path.join(path.dirname(options.executablePath), INSTALL_METADATA_FILE_NAME)
  const metadata = await readInstallMetadata(metadataPath)

  if (metadata?.channel === 'github-release' && metadata.owner === MANAGED_RELEASE_OWNER) {
    return {
      kind: 'managed-github-release',
      executablePath: options.executablePath,
      metadataPath,
      metadata,
      supportsSelfUpdate: true,
    }
  }

  if (options.invocationPath && (options.invocationPath.endsWith(`${path.sep}src${path.sep}cli.ts`) || options.invocationPath.endsWith(`${path.sep}dist${path.sep}cli.js`))) {
    return {
      kind: 'source-checkout',
      executablePath: options.executablePath,
      supportsSelfUpdate: false,
    }
  }

  const userAgent = env.npm_config_user_agent ?? ''
  if (userAgent.includes('bun/')) {
    return {
      kind: 'bun-global',
      executablePath: options.executablePath,
      supportsSelfUpdate: false,
    }
  }

  if (userAgent.includes('npm/')) {
    return {
      kind: 'npm-global',
      executablePath: options.executablePath,
      supportsSelfUpdate: false,
    }
  }

  return {
    kind: 'unknown',
    executablePath: options.executablePath,
    supportsSelfUpdate: false,
  }
}

export function resolveManualUpgradeInstructions(method: InstallMethod, releaseUrl?: string): string {
  switch (method.kind) {
    case 'bun-global':
      return 'Self-update is not supported for Bun global installs. Run: bun install -g awb@latest'
    case 'npm-global':
      return 'Self-update is not supported for npm global installs. Run: npm install -g awb@latest'
    case 'source-checkout':
      return 'Self-update is not supported for source checkouts. Run: git pull && bun install && bun run build'
    case 'unknown':
      return `Self-update is not supported for this install. Download the latest release manually${releaseUrl ? `: ${releaseUrl}` : '.'}`
    case 'managed-github-release':
      return 'This install supports self-update.'
  }
}

export function selectReleaseArtifacts(
  release: ReleaseMetadataWithAssets,
  target: { platform: NodeJS.Platform; arch: string },
): { archive: ReleaseAsset; checksums: ReleaseAsset } {
  const platform = normalizePlatform(target.platform)
  const arch = normalizeArch(target.arch)
  const archiveExtension = platform === 'windows' ? 'zip' : 'tar.gz'
  const archiveName = `awb-v${release.version}-${platform}-${arch}.${archiveExtension}`
  const checksumsName = `awb-v${release.version}-checksums.txt`

  const archive = release.assets.find((asset) => asset.name === archiveName)
  const checksums = release.assets.find((asset) => asset.name === checksumsName)

  if (!archive) {
    throw new Error(`No release artifact matches ${platform}/${arch}. Expected ${archiveName}.`)
  }
  if (!checksums) {
    throw new Error(`No checksums asset found. Expected ${checksumsName}.`)
  }

  return { archive, checksums }
}

export function parseChecksumsFile(content: string): Map<string, string> {
  const checksums = new Map<string, string>()
  for (const line of content
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const match = line.match(/^([a-fA-F0-9]+)\s+(.+)$/)
    if (!match) continue
    const [, checksum, fileName] = match
    if (checksum && fileName) checksums.set(fileName, checksum)
  }
  return checksums
}

export async function replaceExecutableSafely(
  options: { currentPath: string; nextPath: string },
  dependencies: {
    copyFile?: typeof fs.copyFile
    rename?: typeof fs.rename
    unlink?: typeof fs.unlink
    stat?: typeof fs.stat
    chmod?: typeof fs.chmod
  } = {},
): Promise<void> {
  const copyFile = dependencies.copyFile ?? fs.copyFile
  const rename = dependencies.rename ?? fs.rename
  const unlink = dependencies.unlink ?? fs.unlink
  const stat = dependencies.stat ?? fs.stat
  const chmod = dependencies.chmod ?? fs.chmod

  const installDir = path.dirname(options.currentPath)
  const executableName = path.basename(options.currentPath)
  const stagedPath = path.join(installDir, `.${executableName}.next-${Date.now()}`)
  const backupPath = path.join(installDir, `.${executableName}.backup-${Date.now()}`)

  await copyFile(options.nextPath, stagedPath)
  const mode = (await stat(options.currentPath)).mode
  await chmod(stagedPath, mode)

  let movedCurrentToBackup = false
  try {
    await rename(options.currentPath, backupPath)
    movedCurrentToBackup = true
    await rename(stagedPath, options.currentPath)
    await unlink(backupPath)
  } catch (error) {
    if (movedCurrentToBackup) {
      try {
        await rename(backupPath, options.currentPath)
      } catch {
        // best effort restore
      }
    }
    try {
      await unlink(stagedPath)
    } catch {
      // best effort cleanup
    }
    throw error
  }
}

export async function fetchLatestGithubReleaseWithAssets(endpoint = DEFAULT_RELEASE_CHECK_URL): Promise<ReleaseMetadataWithAssets> {
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'awb-self-update',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub self-update check failed: ${response.status}`)
  }

  const payload = (await response.json()) as {
    tag_name?: string
    html_url?: string
    prerelease?: boolean
    assets?: Array<{
      name?: string
      browser_download_url?: string
    }>
  }

  if (payload.prerelease) {
    throw new Error('Latest GitHub release is a prerelease.')
  }

  const version = payload.tag_name?.replace(/^v/, '')
  if (!version || !payload.html_url) {
    throw new Error('GitHub release metadata is incomplete.')
  }

  return {
    version,
    htmlUrl: payload.html_url,
    assets: (payload.assets ?? [])
      .filter((asset): asset is { name: string; browser_download_url: string } => Boolean(asset.name && asset.browser_download_url))
      .map((asset) => ({
        name: asset.name,
        downloadUrl: asset.browser_download_url,
      })),
  }
}

export async function selfUpdateAwb(options: {
  currentVersion: string
  executablePath: string
  invocationPath?: string
  env?: Record<string, string | undefined>
  endpoint?: string
  platform?: NodeJS.Platform
  arch?: string
  fetchRelease?: (endpoint?: string) => Promise<ReleaseMetadataWithAssets>
  downloadText?: (url: string) => Promise<string>
  downloadFile?: (url: string, destinationPath: string) => Promise<void>
  extractArchive?: (archivePath: string, destinationDir: string) => Promise<void>
}): Promise<{ status: 'updated' | 'up-to-date' | 'unsupported'; updated: boolean; version: string; message: string }> {
  const installation = await detectInstallMethod({
    executablePath: options.executablePath,
    invocationPath: options.invocationPath,
    env: options.env,
  })
  const fetchRelease = options.fetchRelease ?? fetchLatestGithubReleaseWithAssets
  const release = await fetchRelease(options.endpoint)

  if (compareSemver(release.version, options.currentVersion) <= 0) {
    return {
      status: 'up-to-date',
      updated: false,
      version: options.currentVersion,
      message: `awb is already up to date (${options.currentVersion}).`,
    }
  }

  if (!installation.supportsSelfUpdate) {
    return {
      status: 'unsupported',
      updated: false,
      version: options.currentVersion,
      message: resolveManualUpgradeInstructions(installation, release.htmlUrl),
    }
  }

  const downloadText = options.downloadText ?? defaultDownloadText
  const downloadFile = options.downloadFile ?? defaultDownloadFile
  const extractArchive = options.extractArchive ?? defaultExtractArchive
  const { archive, checksums } = selectReleaseArtifacts(release, {
    platform: options.platform ?? process.platform,
    arch: options.arch ?? process.arch,
  })

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-self-update-'))
  try {
    const checksumsContent = await downloadText(checksums.downloadUrl)
    const checksumsByFile = parseChecksumsFile(checksumsContent)
    const expectedChecksum = checksumsByFile.get(archive.name)
    if (!expectedChecksum) {
      throw new Error(`No checksum was published for ${archive.name}.`)
    }

    const archivePath = path.join(tempDir, archive.name)
    await downloadFile(archive.downloadUrl, archivePath)
    const actualChecksum = await computeSha256(archivePath)
    if (actualChecksum !== expectedChecksum) {
      throw new Error(`Checksum verification failed for ${archive.name}.`)
    }

    const extractedDir = path.join(tempDir, 'extracted')
    await fs.mkdir(extractedDir, { recursive: true })
    await extractArchive(archivePath, extractedDir)
    const executableName = (options.platform ?? process.platform) === 'win32' ? 'awb.exe' : 'awb'
    const nextExecutablePath = await findFileRecursive(extractedDir, executableName)
    if (!nextExecutablePath) {
      throw new Error(`The downloaded artifact did not contain ${executableName}.`)
    }

    await replaceExecutableSafely({
      currentPath: installation.executablePath,
      nextPath: nextExecutablePath,
    })

    return {
      status: 'updated',
      updated: true,
      version: release.version,
      message: `awb updated successfully to ${release.version}.`,
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

async function readInstallMetadata(metadataPath: string): Promise<InstallMetadata | undefined> {
  try {
    const content = await fs.readFile(metadataPath, 'utf8')
    return JSON.parse(content) as InstallMetadata
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined
    if (code === 'ENOENT') return undefined
    throw error
  }
}

function normalizePlatform(platform: NodeJS.Platform): SelfUpdatePlatform {
  switch (platform) {
    case 'darwin':
      return 'darwin'
    case 'linux':
      return 'linux'
    case 'win32':
      return 'windows'
    default:
      throw new Error(`Unsupported platform for self-update: ${platform}`)
  }
}

function normalizeArch(arch: string): SelfUpdateArch {
  if (arch === 'x64' || arch === 'arm64') return arch
  throw new Error(`Unsupported architecture for self-update: ${arch}`)
}

async function defaultDownloadText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain, application/octet-stream',
      'User-Agent': 'awb-self-update',
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }
  return response.text()
}

async function defaultDownloadFile(url: string, destinationPath: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'awb-self-update',
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  await fs.writeFile(destinationPath, new Uint8Array(arrayBuffer))
}

async function defaultExtractArchive(archivePath: string, destinationDir: string): Promise<void> {
  if (archivePath.endsWith('.tar.gz')) {
    await runCommand('tar', ['-xzf', archivePath, '-C', destinationDir])
    return
  }
  if (archivePath.endsWith('.zip')) {
    if (process.platform === 'win32') {
      await runCommand('powershell', [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`,
      ])
      return
    }
    await runCommand('unzip', ['-q', archivePath, '-d', destinationDir])
    return
  }
  throw new Error(`Unsupported archive format: ${archivePath}`)
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code ?? 'unknown'}`))
    })
  })
}

async function computeSha256(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath)
  return createHash('sha256').update(content).digest('hex')
}

async function findFileRecursive(rootDir: string, fileName: string): Promise<string | undefined> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name)
    if (entry.isFile() && entry.name === fileName) return entryPath
    if (entry.isDirectory()) {
      const found = await findFileRecursive(entryPath, fileName)
      if (found) return found
    }
  }
  return undefined
}
