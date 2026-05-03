const LOCAL_ASSET_URL_PATTERN = /<(script|link|img)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi

export function extractLocalAssetPathsFromHtml(html: string): string[] {
  const assets = new Set<string>()

  for (const match of html.matchAll(LOCAL_ASSET_URL_PATTERN)) {
    const value = match[2]?.trim()
    if (!value?.startsWith('/')) {
      continue
    }

    assets.add(value)
  }

  return [...assets]
}

export async function waitForServerReady(baseUrl: string, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      await verifyApiTicketsEndpoint(baseUrl)
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${baseUrl} to become ready.`)
}

export async function verifyApiTicketsEndpoint(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/tickets`)
  if (!response.ok) {
    throw new Error(`Expected ${baseUrl}/api/tickets to return 200 but received ${response.status}.`)
  }
}

export async function verifyBrowserEntrypoint(baseUrl: string): Promise<void> {
  const rootResponse = await fetch(`${baseUrl}/`)
  if (!rootResponse.ok) {
    throw new Error(`Expected ${baseUrl}/ to return 200 but received ${rootResponse.status}.`)
  }

  const html = await rootResponse.text()
  for (const assetPath of extractLocalAssetPathsFromHtml(html)) {
    const assetResponse = await fetch(new URL(assetPath, `${baseUrl}/`))
    if (!assetResponse.ok) {
      throw new Error(`Expected ${assetPath} to return 200 but received ${assetResponse.status}.`)
    }
  }
}
