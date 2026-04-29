#!/usr/bin/env bun
import fs from 'node:fs'
import path from 'node:path'
import open from 'open'
import { loadAwbSettings } from './config.js'
import { startServer } from './server.js'
import { checkForAwbUpdates, formatUpdateNotice } from './update.js'
import { getAwbVersion } from './version.js'

type CliOptions = {
  projectDir: string
  ticketsDir: string
  port: number
  shouldOpen: boolean
  dev: boolean
  editorOverride?: string
  command?: 'serve' | 'check-for-updates'
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    projectDir: process.cwd(),
    ticketsDir: '.tickets',
    port: 4312,
    shouldOpen: true,
    dev: false,
    command: 'serve',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === 'check-for-updates') {
      options.command = 'check-for-updates'
    } else if (arg === '--dir') {
      options.projectDir = path.resolve(argv[++index] || options.projectDir)
    } else if (arg === '--tickets-dir') {
      options.ticketsDir = argv[++index] || options.ticketsDir
    } else if (arg === '--port') {
      options.port = Number(argv[++index] || options.port)
    } else if (arg === '--no-open') {
      options.shouldOpen = false
    } else if (arg === '--dev') {
      options.dev = true
    } else if (arg === '--editor') {
      options.editorOverride = argv[++index] || options.editorOverride
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return options
}

function printHelp(): void {
  console.log(`awb\n\nUsage:\n  awb [--dir PATH] [--tickets-dir DIR] [--port PORT] [--no-open] [--dev] [--editor COMMAND]\n  awb check-for-updates\n`)
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const currentVersion = await getAwbVersion()

  if (options.command === 'check-for-updates') {
    const result = await checkForAwbUpdates({
      currentVersion,
      forceRefresh: true,
    })

    if (result.error) {
      console.error(`awb: update check failed: ${result.error}`)
      process.exit(1)
    }

    const notice = formatUpdateNotice(result)
    if (notice) {
      console.log(notice)
    } else {
      console.log(`awb: you are up to date (${currentVersion})`)
    }
    return
  }

  const absoluteTicketsDir = path.resolve(options.projectDir, options.ticketsDir)

  if (!fs.existsSync(absoluteTicketsDir)) {
    console.error(`awb: tickets directory not found: ${absoluteTicketsDir}`)
    process.exit(1)
  }

  const settings = await loadAwbSettings({
    projectDir: options.projectDir,
    editorOverride: options.editorOverride,
  })

  const { url } = await startServer({
    ...options,
    editorCommand: settings.editorCommand,
    worktreeIsolationEnabled: settings.worktreeIsolationEnabled,
  })

  console.log(`awb: serving ${absoluteTicketsDir}`)
  console.log(`awb: ${url}`)

  void checkForAwbUpdates({ currentVersion }).then((result) => {
    const notice = formatUpdateNotice(result)
    if (notice) console.log(notice)
  })

  if (options.shouldOpen) {
    await open(url)
  }
}

main().catch((error) => {
  console.error('awb:', error instanceof Error ? error.message : error)
  process.exit(1)
})
