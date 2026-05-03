import { describe, expect, test } from 'bun:test'
import { createServer } from 'node:http'
import { extractLocalAssetPathsFromHtml, verifyBrowserEntrypoint } from '../src/releaseSmoke'

describe('extractLocalAssetPathsFromHtml', () => {
  test('returns local script and stylesheet asset paths', () => {
    const html = [
      '<!doctype html>',
      '<html>',
      '  <head>',
      '    <link rel="stylesheet" href="/assets/app-123.css">',
      '    <link rel="icon" href="/favicon.ico">',
      '    <link rel="preconnect" href="https://example.com">',
      '  </head>',
      '  <body>',
      '    <script type="module" src="/assets/app-123.js"></script>',
      '    <img src="data:image/png;base64,abc">',
      '  </body>',
      '</html>',
    ].join('\n')

    expect(extractLocalAssetPathsFromHtml(html)).toEqual(['/assets/app-123.css', '/favicon.ico', '/assets/app-123.js'])
  })
})

describe('verifyBrowserEntrypoint', () => {
  test('fails when a referenced local asset returns a non-200 response', async () => {
    const server = createServer((request, response) => {
      if (request.url === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end('<!doctype html><html><head><link rel="stylesheet" href="/assets/app.css"></head><body></body></html>')
        return
      }

      response.writeHead(404)
      response.end()
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const baseUrl = `http://127.0.0.1:${port}`

    try {
      await expect(verifyBrowserEntrypoint(baseUrl)).rejects.toThrow('/assets/app.css')
    } finally {
      server.close()
    }
  })
})
