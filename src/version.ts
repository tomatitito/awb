import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveAwbPackageJsonPath } from './runtimeSupport.js'

let cachedVersion: string | undefined

export async function getAwbVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion

  const packageJsonPath = resolveAwbPackageJsonPath() ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json')
  const content = await fs.readFile(packageJsonPath, 'utf8')
  const parsed = JSON.parse(content) as { version?: string }
  if (!parsed.version) {
    throw new Error(`AWB version is missing from package.json at ${packageJsonPath}.`)
  }

  cachedVersion = parsed.version
  return parsed.version
}
