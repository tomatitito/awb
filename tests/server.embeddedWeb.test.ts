import { describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../src/server'
import type { EmbeddedWebAssetsManifest } from '../src/webAssets'

describe('server embedded web assets', () => {
  test('serves the app shell and hashed assets from the embedded manifest', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-embedded-web-'))
    const ticketsDir = path.join(projectDir, '.tickets')
    await fs.mkdir(ticketsDir, { recursive: true })
    await fs.writeFile(path.join(ticketsDir, 'ticket-1.md'), '---\nid: ticket-1\nstatus: open\n---\n# Ticket 1\n')

    const embeddedWebAssets: EmbeddedWebAssetsManifest = {
      '/index.html': {
        contentType: 'text/html; charset=utf-8',
        encoding: 'utf8',
        content: '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/app-123.js"></script></body></html>',
      },
      '/assets/app-123.js': {
        contentType: 'text/javascript; charset=utf-8',
        encoding: 'utf8',
        content: 'console.log("embedded")',
      },
    }

    const { server, url } = await startServer({
      projectDir,
      ticketsDir: '.tickets',
      port: 0,
      embeddedWebAssets,
    })

    try {
      const rootResponse = await fetch(`${url}/`)
      expect(rootResponse.status).toBe(200)
      expect(rootResponse.headers.get('content-type')).toContain('text/html')
      expect(await rootResponse.text()).toContain('/assets/app-123.js')

      const assetResponse = await fetch(`${url}/assets/app-123.js`)
      expect(assetResponse.status).toBe(200)
      expect(assetResponse.headers.get('content-type')).toContain('text/javascript')
      expect(await assetResponse.text()).toBe('console.log("embedded")')

      const missingAssetResponse = await fetch(`${url}/assets/missing.js`)
      expect(missingAssetResponse.status).toBe(404)
    } finally {
      server.close()
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })
})
