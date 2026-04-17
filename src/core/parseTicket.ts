import path from 'node:path'
import matter from 'gray-matter'
import type { Ticket } from './types.js'

const firstHeadingRegex = /^#\s+(.+)$/m

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()]
  }
  return []
}

export function parseTicket(filePath: string, source: string): Ticket {
  const parsed = matter(source)
  const data = parsed.data as Record<string, unknown>
  const fileName = path.basename(filePath, '.md')
  const content = parsed.content.trim()
  const headingMatch = content.match(firstHeadingRegex)
  const title = headingMatch?.[1]?.trim() || String(data.title || data.id || fileName)
  const body = content.replace(firstHeadingRegex, '').trim()

  return {
    id: String(data.id || fileName),
    title,
    body,
    status: typeof data.status === 'string' ? data.status : undefined,
    deps: toStringArray(data.deps),
    links: toStringArray(data.links),
    created: typeof data.created === 'string' ? data.created : undefined,
    type: typeof data.type === 'string' ? data.type : undefined,
    priority: typeof data.priority === 'string' || typeof data.priority === 'number' ? data.priority : undefined,
    assignee: typeof data.assignee === 'string' ? data.assignee : undefined,
    parent: typeof data.parent === 'string' ? data.parent : undefined,
    tags: toStringArray(data.tags),
    filePath,
  }
}
