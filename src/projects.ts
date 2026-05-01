import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export type SelectableProject = {
  root: string
  label?: string
}

export type ProjectDiscoveryResult = {
  configPath: string
  projects: SelectableProject[]
  warnings: string[]
}

type AwbUserConfig = {
  projects?: unknown
}

const USER_CONFIG_FILE_NAME = 'config.json'

export function getAwbUserConfigDir(options: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv | Record<string, string | undefined>; homeDir?: string } = {}): string {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const homeDir = options.homeDir ?? os.homedir()

  if (platform === 'darwin') return path.join(homeDir, 'Library', 'Application Support', 'awb')
  if (platform === 'win32') {
    const appData = env.APPDATA
    return appData ? path.join(appData, 'awb') : path.join(homeDir, 'AppData', 'Roaming', 'awb')
  }

  const xdgConfigHome = env.XDG_CONFIG_HOME
  return xdgConfigHome ? path.join(xdgConfigHome, 'awb') : path.join(homeDir, '.config', 'awb')
}

export async function discoverSelectableProjects(
  options: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv | Record<string, string | undefined>; homeDir?: string } = {},
): Promise<ProjectDiscoveryResult> {
  const configDir = getAwbUserConfigDir(options)
  const configPath = path.join(configDir, USER_CONFIG_FILE_NAME)
  const warnings: string[] = []
  const projects: SelectableProject[] = []
  const seenRoots = new Set<string>()

  const config = await readUserConfig(configPath, warnings)
  const entries = Array.isArray(config.projects) ? config.projects : []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      warnings.push('Ignoring invalid project entry because it is not an object.')
      continue
    }

    const rootValue = 'root' in entry ? entry.root : undefined
    if (typeof rootValue !== 'string' || !rootValue.trim()) {
      warnings.push('Ignoring project entry because root is missing or empty.')
      continue
    }

    const root = path.resolve(rootValue)
    if (!(await isDirectory(root))) {
      warnings.push(`Ignoring project entry because the directory does not exist: ${root}`)
      continue
    }

    if (seenRoots.has(root)) {
      warnings.push(`Ignoring duplicate project entry for ${root}.`)
      continue
    }

    const labelValue = 'label' in entry ? entry.label : undefined
    const label = typeof labelValue === 'string' && labelValue.trim() ? labelValue.trim() : undefined

    seenRoots.add(root)
    projects.push(label ? { root, label } : { root })
  }

  return {
    configPath,
    projects,
    warnings,
  }
}

async function readUserConfig(configPath: string, warnings: string[]): Promise<AwbUserConfig> {
  try {
    const content = await fs.readFile(configPath, 'utf8')
    const parsed = JSON.parse(content) as AwbUserConfig
    if (!parsed || typeof parsed !== 'object') {
      warnings.push(`Ignoring ${configPath} because it does not contain a JSON object.`)
      return {}
    }
    return parsed
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined
    if (code === 'ENOENT') return {}
    warnings.push(`Ignoring ${configPath} because it could not be parsed.`)
    return {}
  }
}

async function isDirectory(directoryPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(directoryPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}
