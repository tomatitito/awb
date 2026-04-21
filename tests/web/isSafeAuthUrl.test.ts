import { describe, expect, test } from 'bun:test'
import { isSafeAuthUrl } from '../../src/web/AgentLoginSection'

describe('isSafeAuthUrl', () => {
  test('allows https URLs', () => {
    expect(isSafeAuthUrl('https://provider.example.com/auth?code=abc')).toBe(true)
  })

  test('allows http URLs', () => {
    expect(isSafeAuthUrl('http://localhost:3000/callback')).toBe(true)
  })

  test('rejects javascript: URIs', () => {
    expect(isSafeAuthUrl('javascript:alert(1)')).toBe(false)
  })

  test('rejects data: URIs', () => {
    expect(isSafeAuthUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  test('rejects empty strings', () => {
    expect(isSafeAuthUrl('')).toBe(false)
  })

  test('rejects schemes with mixed case bypass attempts', () => {
    expect(isSafeAuthUrl('JavaScript:alert(1)')).toBe(false)
  })
})
