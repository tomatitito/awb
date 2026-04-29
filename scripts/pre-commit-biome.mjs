#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const stagedPaths = process.argv.slice(2)
const supportedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.jsonc'])

const shouldCheck = (filePath) => {
  if (!filePath.startsWith('src/') && !filePath.startsWith('tests/')) return false
  const extensionIndex = filePath.lastIndexOf('.')
  if (extensionIndex === -1) return false
  return supportedExtensions.has(filePath.slice(extensionIndex))
}

const files = stagedPaths.filter((filePath) => existsSync(filePath) && shouldCheck(filePath))

if (files.length === 0) process.exit(0)

const result = spawnSync('bunx', ['biome', 'check', ...files], {
  stdio: 'inherit',
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
