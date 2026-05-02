import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../src/server'

const tempDirs: string[] = []
const originalXdgConfigHome = process.env.XDG_CONFIG_HOME
const originalHome = process.env.HOME

beforeEach(() => {
  process.env.XDG_CONFIG_HOME = undefined
  process.env.HOME = originalHome
})

afterEach(async () => {
  process.env.XDG_CONFIG_HOME = originalXdgConfigHome
  process.env.HOME = originalHome
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

async function makeProject(id: string, title: string) {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), `awb-project-${id}-`))
  tempDirs.push(projectDir)
  const ticketsDir = path.join(projectDir, '.tickets')
  await fs.mkdir(ticketsDir, { recursive: true })
  await fs.writeFile(path.join(ticketsDir, `${id}.md`), `---\nid: ${id}\nstatus: open\n---\n# ${title}\n\nBody\n`)
  return projectDir
}

async function writeProjectAllowlist(homeConfigDir: string, projects: Array<{ root: string; label?: string }>) {
  await fs.mkdir(homeConfigDir, { recursive: true })
  await fs.writeFile(path.join(homeConfigDir, 'config.json'), JSON.stringify({ projects }, null, 2))
}

async function waitFor(assertion: () => Promise<void>, timeoutMs = 3000) {
  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      await assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Timed out waiting for assertion to pass.')
}

describe('server project switching', () => {
  test('switches to another allowlisted project and rebinds ticket watching', async () => {
    const projectA = await makeProject('project-a', 'Project A')
    const projectB = await makeProject('project-b', 'Project B')
    const userConfigRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-user-config-'))
    tempDirs.push(userConfigRoot)
    await writeProjectAllowlist(userConfigRoot, [
      { root: projectA, label: 'Project A' },
      { root: projectB, label: 'Project B' },
    ])

    const { server, url } = await startServer({
      projectDir: projectA,
      ticketsDir: '.tickets',
      port: 0,
      projectDiscoveryConfigDir: userConfigRoot,
    })

    try {
      const initialTickets = await fetch(`${url}/api/tickets`).then((response) => response.json() as Promise<{ projectDir: string; tickets: Array<{ id: string; title: string }> }>)
      expect(initialTickets.projectDir).toBe(path.resolve(projectA))
      expect(initialTickets.tickets.map((ticket) => ticket.id)).toEqual(['project-a'])

      const projectsPayload = await fetch(`${url}/api/projects`).then((response) => response.json() as Promise<{ activeProjectRoot: string; projects: Array<{ root: string }> }>)
      expect(projectsPayload.activeProjectRoot).toBe(path.resolve(projectA))
      expect(projectsPayload.projects).toHaveLength(2)

      const switchResponse = await fetch(`${url}/api/projects/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: path.resolve(projectB) }),
      })
      expect(switchResponse.status).toBe(202)

      await waitFor(async () => {
        const switchedTickets = await fetch(`${url}/api/tickets`).then(
          (response) => response.json() as Promise<{ projectDir: string; tickets: Array<{ id: string; title: string }> }>,
        )
        expect(switchedTickets.projectDir).toBe(path.resolve(projectB))
        expect(switchedTickets.tickets.map((ticket) => ticket.id)).toEqual(['project-b'])
      })

      await fs.writeFile(path.join(projectB, '.tickets', 'project-b.md'), `---\nid: project-b\nstatus: open\n---\n# Project B Updated\n\nBody\n`)

      await waitFor(async () => {
        const switchedTickets = await fetch(`${url}/api/tickets`).then((response) => response.json() as Promise<{ tickets: Array<{ title: string }> }>)
        expect(switchedTickets.tickets[0]?.title).toBe('Project B Updated')
      })
    } finally {
      server.close()
    }
  })

  test('failed switches leave the current project usable', async () => {
    const projectA = await makeProject('project-a', 'Project A')
    const userConfigRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-user-config-'))
    tempDirs.push(userConfigRoot)
    await writeProjectAllowlist(userConfigRoot, [{ root: projectA, label: 'Project A' }])

    const { server, url } = await startServer({
      projectDir: projectA,
      ticketsDir: '.tickets',
      port: 0,
      projectDiscoveryConfigDir: userConfigRoot,
    })

    try {
      const switchResponse = await fetch(`${url}/api/projects/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: '/missing/project' }),
      })
      expect(switchResponse.status).toBe(404)

      const ticketsPayload = await fetch(`${url}/api/tickets`).then((response) => response.json() as Promise<{ projectDir: string; tickets: Array<{ id: string }> }>)
      expect(ticketsPayload.projectDir).toBe(path.resolve(projectA))
      expect(ticketsPayload.tickets.map((ticket) => ticket.id)).toEqual(['project-a'])
    } finally {
      server.close()
    }
  })
})
