#!/usr/bin/env bun
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { AWB_VERSION } from './generatedVersion.js'

const isBunCompiledBinary = import.meta.url.includes('$bunfs') || import.meta.url.includes('~BUN') || import.meta.url.includes('%7EBUN')

if (isBunCompiledBinary && !process.env.PI_PACKAGE_DIR?.trim()) {
  const packageDir = path.join(os.tmpdir(), `awb-pi-package-${AWB_VERSION}`)
  await fs.mkdir(packageDir, { recursive: true })
  await fs.writeFile(
    path.join(packageDir, 'package.json'),
    JSON.stringify(
      {
        name: 'awb',
        version: AWB_VERSION,
      },
      null,
      2,
    ),
  )
  process.env.PI_PACKAGE_DIR = packageDir
}

await import('./cli.js')
