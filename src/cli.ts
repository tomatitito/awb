#!/usr/bin/env bun
import fs from 'node:fs'
import path from 'node:path'
import open from 'open'
import { startServer } from './server.js'

type CliOptions = {
  projectDir: string
  ticketsDir: string
  port: number
  shouldOpen: boolean
  dev: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    projectDir: process.cwd(),
    ticketsDir: '.tickets',
    port: 4312,
    shouldOpen: true,
    dev: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dir') {
      options.projectDir = path.resolve(argv[++index] || options.projectDir)
    } else if (arg === '--tickets-dir') {
      options.ticketsDir = argv[++index] || options.ticketsDir
    } else if (arg === '--port') {
      options.port = Number(argv[++index] || options.port)
    } else if (arg === '--no-open') {
      options.shouldOpen = false
    } else if (arg === '--dev') {
      options.dev = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return options
}

function printHelp(): void {
  console.log(`awb\n\nUsage:\n  awb [--dir PATH] [--tickets-dir DIR] [--port PORT] [--no-open] [--dev]\n`)
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const absoluteTicketsDir = path.resolve(options.projectDir, options.ticketsDir)

  if (!fs.existsSync(absoluteTicketsDir)) {
    console.error(`awb: tickets directory not found: ${absoluteTicketsDir}`)
    process.exit(1)
  }

  const { url } = await startServer(options)

  console.log(`awb: serving ${absoluteTicketsDir}`)
  console.log(`awb: ${url}`)

  if (options.shouldOpen) {
    await open(url)
  }
}

main().catch((error) => {
  console.error('awb:', error instanceof Error ? error.message : error)
  process.exit(1)
})
