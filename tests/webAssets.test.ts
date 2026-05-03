import { describe, expect, test } from 'bun:test'
import { buildEmbeddedWebAssetsModule, type EmbeddedWebAssetsManifest, resolveEmbeddedWebAsset } from '../src/webAssets'

describe('resolveEmbeddedWebAsset', () => {
  const manifest: EmbeddedWebAssetsManifest = {
    '/index.html': {
      contentType: 'text/html; charset=utf-8',
      encoding: 'utf8',
      content: '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/app-123.js"></script></body></html>',
    },
    '/assets/app-123.js': {
      contentType: 'text/javascript; charset=utf-8',
      encoding: 'utf8',
      content: 'console.log("hello")',
    },
  }

  test('serves index.html for the app shell routes', () => {
    expect(resolveEmbeddedWebAsset(manifest, '/')).toEqual(manifest['/index.html'])
    expect(resolveEmbeddedWebAsset(manifest, '/tickets/awb-4m8h')).toEqual(manifest['/index.html'])
  })

  test('serves hashed asset files by exact path', () => {
    expect(resolveEmbeddedWebAsset(manifest, '/assets/app-123.js')).toEqual(manifest['/assets/app-123.js'])
  })

  test('does not rewrite unknown asset-like requests to index.html', () => {
    expect(resolveEmbeddedWebAsset(manifest, '/assets/missing.js')).toBeUndefined()
    expect(resolveEmbeddedWebAsset(manifest, '/favicon.ico')).toBeUndefined()
  })
})

describe('buildEmbeddedWebAssetsModule', () => {
  test('serializes utf8 text and binary assets into a TypeScript module', () => {
    const source = buildEmbeddedWebAssetsModule([
      {
        routePath: '/index.html',
        contentType: 'text/html; charset=utf-8',
        content: Buffer.from('<html></html>'),
      },
      {
        routePath: '/assets/logo.png',
        contentType: 'image/png',
        content: Buffer.from([0, 1, 2, 3]),
      },
    ])

    expect(source).toContain('"/index.html"')
    expect(source).toContain("encoding: 'utf8'")
    expect(source).toContain('content: "<html></html>"')
    expect(source).toContain('"/assets/logo.png"')
    expect(source).toContain("encoding: 'base64'")
    expect(source).toContain(Buffer.from([0, 1, 2, 3]).toString('base64'))
  })
})
