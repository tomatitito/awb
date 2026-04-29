import fs from 'node:fs/promises'
import path from 'node:path'

export type AwbProjectConfig = {
  editor?: string
  agentRuns?: {
    worktreeIsolation?: boolean
  }
}

export type LoadAwbSettingsOptions = {
  projectDir: string
  env?: Record<string, string | undefined>
  editorOverride?: string
}

export type AwbSettings = {
  editorCommand?: string
  worktreeIsolationEnabled: boolean
}

export async function loadAwbSettings(options: LoadAwbSettingsOptions): Promise<AwbSettings> {
  const env = options.env ?? process.env
  const config = await readAwbProjectConfig(options.projectDir)
  const editorCommand = options.editorOverride?.trim() || env.AWB_EDITOR?.trim() || config.editor?.trim() || undefined

  return {
    editorCommand: editorCommand || undefined,
    worktreeIsolationEnabled: Boolean(config.agentRuns?.worktreeIsolation),
  }
}

export async function readAwbProjectConfig(projectDir: string): Promise<AwbProjectConfig> {
  const configPath = path.join(projectDir, '.awb', 'config.json')
  try {
    const content = await fs.readFile(configPath, 'utf8')
    const parsed = JSON.parse(content) as AwbProjectConfig
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined
    if (code === 'ENOENT') return {}
    throw error
  }
}
