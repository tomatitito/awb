#!/usr/bin/env node
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type ReleaseOptions = {
  platform: string
  arch: string
  target: string
  archive: string
  owner: string
}

function parseArgs(argv: string[]): ReleaseOptions {
  const options: Partial<ReleaseOptions> & Pick<ReleaseOptions, 'owner'> = {
    owner: 'tomatitito/awb',
  }

  for (const arg of argv) {
    const [key, value] = arg.split('=')
    if (key === '--platform') options.platform = value
    else if (key === '--arch') options.arch = value
    else if (key === '--target') options.target = value
    else if (key === '--archive') options.archive = value
    else if (key === '--owner') options.owner = value
  }

  if (!options.platform || !options.arch || !options.target || !options.archive) {
    throw new Error('Usage: build-release-artifact.ts --platform=<platform> --arch=<arch> --target=<bun-target> --archive=<tar.gz|zip> [--owner=<owner/repo>]')
  }

  return options as ReleaseOptions
}

async function run(command: string, args: string[], options: Parameters<typeof spawn>[2] = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code ?? 'unknown'}`))
    })
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const packageJson = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const version = packageJson.version
  const executableName = options.platform === 'windows' ? 'awb.exe' : 'awb'
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const releaseDir = path.join(rootDir, 'dist', 'release')
  const stageDir = path.join(rootDir, 'dist', 'release-stage', `${options.platform}-${options.arch}`)
  const executablePath = path.join(stageDir, executableName)
  const archiveName = `awb-v${version}-${options.platform}-${options.arch}.${options.archive}`
  const archivePath = path.join(releaseDir, archiveName)

  await fs.rm(stageDir, { recursive: true, force: true })
  await fs.mkdir(stageDir, { recursive: true })
  await fs.mkdir(releaseDir, { recursive: true })

  await run('bun', ['build', 'src/cli.ts', '--compile', `--target=${options.target}`, `--outfile=${executablePath}`], {
    cwd: rootDir,
  })

  await fs.writeFile(
    path.join(stageDir, 'awb-install.json'),
    JSON.stringify(
      {
        channel: 'github-release',
        owner: options.owner,
      },
      null,
      2,
    ),
  )

  await fs.rm(archivePath, { force: true })

  if (options.archive === 'tar.gz') {
    await run('tar', ['-czf', archivePath, '-C', stageDir, executableName, 'awb-install.json'], { cwd: rootDir })
  } else if (options.archive === 'zip') {
    await run(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${executablePath.replace(/'/g, "''")}', '${path.join(stageDir, 'awb-install.json').replace(/'/g, "''")}' -DestinationPath '${archivePath.replace(/'/g, "''")}' -Force`,
      ],
      { cwd: rootDir },
    )
  } else {
    throw new Error(`Unsupported archive format: ${options.archive}`)
  }

  console.log(archivePath)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
