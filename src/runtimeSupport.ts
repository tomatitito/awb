import { existsSync } from 'node:fs'
import path from 'node:path'
import { getAwbUserConfigDir } from './projects.js'

export const AWB_PACKAGE_DIR_ENV = 'AWB_PACKAGE_DIR'
export const AWB_PI_PACKAGE_DIR_NAME = 'pi-package'

export function getAwbPiPackageDir(options: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv | Record<string, string | undefined>; homeDir?: string } = {}): string {
  return path.join(getAwbUserConfigDir(options), AWB_PI_PACKAGE_DIR_NAME)
}

export function resolveAwbPackageDir(options: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv | Record<string, string | undefined>; homeDir?: string } = {}): string {
  const explicitAwbDir = process.env[AWB_PACKAGE_DIR_ENV]?.trim()
  if (explicitAwbDir) return explicitAwbDir

  const explicitPiDir = process.env.PI_PACKAGE_DIR?.trim()
  if (explicitPiDir) return explicitPiDir

  return getAwbPiPackageDir(options)
}

export function resolveAwbPackageJsonPath(): string | undefined {
  const candidates = [process.env[AWB_PACKAGE_DIR_ENV]?.trim(), process.env.PI_PACKAGE_DIR?.trim()].filter((value): value is string => Boolean(value))

  for (const directoryPath of candidates) {
    const packageJsonPath = path.join(directoryPath, 'package.json')
    if (existsSync(packageJsonPath)) return packageJsonPath
  }

  return undefined
}
