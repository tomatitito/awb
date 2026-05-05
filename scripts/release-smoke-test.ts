#!/usr/bin/env bun
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { verifyBrowserEntrypoint, waitForServerReady } from '../src/releaseSmoke.js'

type SmokeTestOptions = {
  executablePath: string
  projectDir?: string
  ticketsDir: string
  startupTimeoutMs: number
}

function parseArgs(argv: string[]): SmokeTestOptions {
  const options: SmokeTestOptions = {
    executablePath: '',
    ticketsDir: '.tickets',
    startupTimeoutMs: 10_000,
  }

  for (const arg of argv) {
    const [key, value] = arg.split('=')
    if (key === '--executable') options.executablePath = value ?? ''
    else if (key === '--project-dir') options.projectDir = value
    else if (key === '--tickets-dir') options.ticketsDir = value ?? options.ticketsDir
    else if (key === '--startup-timeout-ms') options.startupTimeoutMs = Number(value ?? options.startupTimeoutMs)
  }

  if (!options.executablePath) {
    throw new Error('Usage: release-smoke-test.ts --executable=/path/to/awb [--project-dir=/path/to/project] [--tickets-dir=.tickets] [--startup-timeout-ms=10000]')
  }

  return options
}

async function withTempProject(projectDir: string | undefined, ticketsDir: string, callback: (resolvedProjectDir: string) => Promise<void>) {
  if (projectDir) {
    await callback(projectDir)
    return
  }

  const tempProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-release-smoke-'))
  try {
    const ticketsPath = path.join(tempProjectDir, ticketsDir)
    await fs.mkdir(ticketsPath, { recursive: true })
    await fs.writeFile(path.join(ticketsPath, 'smoke-ticket.md'), '---\nid: smoke-ticket\nstatus: open\n---\n# Smoke Ticket\n')
    await callback(tempProjectDir)
  } finally {
    await fs.rm(tempProjectDir, { recursive: true, force: true })
  }
}

async function findFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(port)
      })
    })
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  await withTempProject(options.projectDir, options.ticketsDir, async (projectDir) => {
    const port = await findFreePort()
    const baseUrl = `http://127.0.0.1:${port}`
    const child = spawn(options.executablePath, ['--dir', projectDir, '--tickets-dir', options.ticketsDir, '--port', String(port), '--no-open'], {
      stdio: 'inherit',
    })

    const exitPromise = new Promise<void>((resolve, reject) => {
      child.on('error', reject)
      child.on('exit', (code, signal) => {
        if (code === 0 || signal) {
          resolve()
          return
        }

        reject(new Error(`${options.executablePath} exited with code ${code ?? 'unknown'}.`))
      })
    })

    try {
      await Promise.race([waitForServerReady(baseUrl, options.startupTimeoutMs), exitPromise])
      await verifyBrowserEntrypoint(baseUrl)
      console.log(`awb: release smoke test passed for ${options.executablePath}`)
    } finally {
      if (!child.killed) {
        child.kill()
      }
      await exitPromise.catch(() => undefined)
    }
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
