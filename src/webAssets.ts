import path from 'node:path'

export type EmbeddedWebAsset = {
  contentType: string
  encoding: 'utf8' | 'base64'
  content: string
}

export type EmbeddedWebAssetsManifest = Record<string, EmbeddedWebAsset>

export type EmbeddedWebAssetSource = {
  routePath: string
  contentType: string
  content: Buffer
}

const SPA_FALLBACK_ASSET_PATH = '/index.html'

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export function contentTypeForWebAsset(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

export function hasEmbeddedWebAssets(manifest: EmbeddedWebAssetsManifest): boolean {
  return Object.keys(manifest).length > 0
}

export function resolveEmbeddedWebAsset(manifest: EmbeddedWebAssetsManifest, requestPath: string): EmbeddedWebAsset | undefined {
  const normalizedPath = normalizeWebAssetPath(requestPath)
  if (normalizedPath === '/') {
    return manifest[SPA_FALLBACK_ASSET_PATH]
  }

  const exactMatch = manifest[normalizedPath]
  if (exactMatch) {
    return exactMatch
  }

  if (looksLikeAssetRequest(normalizedPath)) {
    return undefined
  }

  return manifest[SPA_FALLBACK_ASSET_PATH]
}

export function decodeEmbeddedWebAsset(asset: EmbeddedWebAsset): Buffer | string {
  return asset.encoding === 'base64' ? Buffer.from(asset.content, 'base64') : asset.content
}

export function buildEmbeddedWebAssetsModule(assets: EmbeddedWebAssetSource[]): string {
  const manifestEntries = assets
    .slice()
    .sort((left, right) => left.routePath.localeCompare(right.routePath))
    .map((asset) => {
      const isText = isUtf8TextContentType(asset.contentType)
      const content = isText ? asset.content.toString('utf8') : asset.content.toString('base64')
      const serializedContent = chunkSerializedString(content)
      return `  ${JSON.stringify(asset.routePath)}: {\n    contentType: ${JSON.stringify(asset.contentType)},\n    encoding: ${isText ? "'utf8'" : "'base64'"},\n    content: ${serializedContent},\n  },`
    })
    .join('\n')

  return `import type { EmbeddedWebAssetsManifest } from '../webAssets.js'\n\nexport const embeddedWebAssets: EmbeddedWebAssetsManifest = {\n${manifestEntries}\n}\n`
}

function chunkSerializedString(value: string, chunkSize = 16_384): string {
  if (value.length <= chunkSize) {
    return JSON.stringify(value)
  }

  const chunks: string[] = []
  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(JSON.stringify(value.slice(index, index + chunkSize)))
  }

  return `[\n      ${chunks.join(',\n      ')}\n    ].join('')`
}

function normalizeWebAssetPath(requestPath: string): string {
  const pathname = requestPath.split('?')[0]?.split('#')[0] ?? '/'
  if (!pathname.startsWith('/')) {
    return `/${pathname}`
  }

  return pathname
}

function looksLikeAssetRequest(requestPath: string): boolean {
  const basename = path.posix.basename(requestPath)
  return basename.includes('.')
}

function isUtf8TextContentType(contentType: string): boolean {
  return contentType.startsWith('text/') || contentType === 'application/json; charset=utf-8' || contentType === 'image/svg+xml; charset=utf-8'
}
