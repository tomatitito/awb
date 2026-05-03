#!/usr/bin/env bun
import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { fileURLToPath } from 'node:url'
import { buildEmbeddedWebAssetsModule, contentTypeForWebAsset } from '../src/webAssets.js'

async function main() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const webDir = path.join(rootDir, 'dist', 'web')
  const outputPath = path.join(rootDir, 'src', 'generated', 'embeddedWebAssets.ts')
  const files = await fg('**/*', { cwd: webDir, onlyFiles: true })
  const assets = await Promise.all(
    files.map(async (relativePath) => ({
      routePath: `/${relativePath.split(path.sep).join('/')}`,
      contentType: contentTypeForWebAsset(relativePath),
      content: await fs.readFile(path.join(webDir, relativePath)),
    })),
  )

  await fs.writeFile(outputPath, buildEmbeddedWebAssetsModule(assets))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
