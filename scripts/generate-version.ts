#!/usr/bin/env bun
import fs from 'node:fs/promises'

const packageJson = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string }

if (!packageJson.version) {
  throw new Error('package.json is missing a version.')
}

await fs.writeFile(
  new URL('../src/generatedVersion.ts', import.meta.url),
  `// Generated from package.json by scripts/generate-version.ts.\nexport const AWB_VERSION = '${packageJson.version}'\n`,
)
