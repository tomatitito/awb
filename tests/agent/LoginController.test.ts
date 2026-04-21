import { describe, expect, test } from 'bun:test'
import type { OAuthLoginCallbacks } from '@mariozechner/pi-ai'
import { LoginController } from '../../src/agent/LoginController'

function makeAuthStorage(overrides: Record<string, unknown> = {}) {
  return {
    get: () => undefined,
    getOAuthProviders: () => [],
    login: async () => {},
    ...overrides,
  } as any
}

function makeModelRegistry(overrides: Record<string, unknown> = {}) {
  return {
    refresh: () => {},
    getAll: () => [],
    hasConfiguredAuth: () => false,
    ...overrides,
  } as any
}

function makeClock(start = 1000) {
  let current = start
  return () => ++current
}

describe('LoginController', () => {
  test('returns sorted auth providers with login and model counts', () => {
    const authStorage = makeAuthStorage({
      getOAuthProviders: () => [
        { id: 'zeta', name: 'Zeta Corp', usesCallbackServer: true },
        { id: 'alpha', name: 'Alpha Inc' },
      ],
      get: (id: string) => (id === 'alpha' ? { type: 'oauth' } : undefined),
    })
    const modelRegistry = makeModelRegistry({
      getAll: () => [
        { provider: 'alpha', id: 'model-a' },
        { provider: 'alpha', id: 'model-b' },
        { provider: 'zeta', id: 'model-z' },
      ],
      hasConfiguredAuth: (model: { provider: string }) => model.provider === 'alpha',
    })

    const controller = new LoginController({ authStorage, modelRegistry, now: makeClock() })
    const providers = controller.getAuthProviders()

    expect(providers).toEqual([
      {
        id: 'alpha',
        name: 'Alpha Inc',
        usesCallbackServer: false,
        isLoggedIn: true,
        availableModelCount: 2,
        configuredModelCount: 2,
      },
      {
        id: 'zeta',
        name: 'Zeta Corp',
        usesCallbackServer: true,
        isLoggedIn: false,
        availableModelCount: 0,
        configuredModelCount: 1,
      },
    ])
  })

  test('completes a login flow and refreshes the model registry', async () => {
    let refreshCount = 0
    const authStorage = makeAuthStorage({
      getOAuthProviders: () => [{ id: 'test', name: 'Test Provider' }],
      login: async () => {},
    })
    const modelRegistry = makeModelRegistry({
      refresh: () => { refreshCount++ },
    })

    const controller = new LoginController({ authStorage, modelRegistry, now: makeClock() })
    const flow = await controller.startLogin('test')

    expect(flow.providerId).toBe('test')
    expect(flow.status).toBe('running')

    // Let the background runLogin settle
    await Promise.resolve()
    await Promise.resolve()

    const completed = controller.getLoginFlow()
    expect(completed?.status).toBe('completed')
    expect(completed?.completedAt).toBeDefined()
    expect(refreshCount).toBeGreaterThanOrEqual(1)
  })

  test('rejects startLogin when a flow is already in progress', async () => {
    let loginResolve: () => void
    const authStorage = makeAuthStorage({
      getOAuthProviders: () => [{ id: 'test', name: 'Test' }],
      login: () => new Promise<void>((resolve) => { loginResolve = resolve }),
    })

    const controller = new LoginController({
      authStorage,
      modelRegistry: makeModelRegistry(),
      now: makeClock(),
    })

    await controller.startLogin('test')
    await expect(controller.startLogin('test')).rejects.toThrow('already in progress')

    loginResolve!()
  })

  test('rejects startLogin for an unknown provider', async () => {
    const controller = new LoginController({
      authStorage: makeAuthStorage(),
      modelRegistry: makeModelRegistry(),
      now: makeClock(),
    })

    await expect(controller.startLogin('nope')).rejects.toThrow('Unknown login provider')
  })

  test('delivers user input to a pending prompt callback', async () => {
    let capturedAnswer: string | undefined
    const authStorage = makeAuthStorage({
      getOAuthProviders: () => [{ id: 'test', name: 'Test' }],
      login: async (_id: string, callbacks: OAuthLoginCallbacks) => {
        capturedAnswer = await callbacks.onPrompt({
          message: 'Enter code',
          placeholder: '123456',
        })
      },
    })

    const controller = new LoginController({
      authStorage,
      modelRegistry: makeModelRegistry(),
      now: makeClock(),
    })

    await controller.startLogin('test')
    // Let runLogin reach the onPrompt callback
    await Promise.resolve()
    await Promise.resolve()

    expect(controller.getLoginFlow()?.status).toBe('awaiting-input')
    expect(controller.getLoginFlow()?.prompt?.message).toBe('Enter code')

    await controller.submitLoginInput('my-code')
    await Promise.resolve()
    await Promise.resolve()

    expect(capturedAnswer).toBe('my-code')
    expect(controller.getLoginFlow()?.status).toBe('completed')
  })

  test('rejects submitLoginInput when no input is pending', async () => {
    const controller = new LoginController({
      authStorage: makeAuthStorage(),
      modelRegistry: makeModelRegistry(),
      now: makeClock(),
    })

    await expect(controller.submitLoginInput('x')).rejects.toThrow('not waiting for input')
  })

  test('cancels an active login flow', async () => {
    let loginResolve: () => void
    const authStorage = makeAuthStorage({
      getOAuthProviders: () => [{ id: 'test', name: 'Test' }],
      login: (_id: string, callbacks: OAuthLoginCallbacks) =>
        new Promise<void>((resolve, reject) => {
          loginResolve = resolve
          callbacks.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    })

    const controller = new LoginController({
      authStorage,
      modelRegistry: makeModelRegistry(),
      now: makeClock(),
    })

    await controller.startLogin('test')
    await controller.cancelLogin()

    // Let the background runLogin catch block settle
    await Promise.resolve()
    await Promise.resolve()

    const flow = controller.getLoginFlow()
    expect(flow?.status).toBe('cancelled')
    expect(flow?.error).toBeDefined()
    expect(flow?.completedAt).toBeDefined()
  })

  test('tracks progress messages up to the limit', async () => {
    const authStorage = makeAuthStorage({
      getOAuthProviders: () => [{ id: 'test', name: 'Test' }],
      login: async (_id: string, callbacks: OAuthLoginCallbacks) => {
        for (let i = 0; i < 15; i++) {
          callbacks.onProgress?.(`step ${i}`)
        }
      },
    })

    const controller = new LoginController({
      authStorage,
      modelRegistry: makeModelRegistry(),
      now: makeClock(),
    })

    await controller.startLogin('test')
    await Promise.resolve()
    await Promise.resolve()

    const flow = controller.getLoginFlow()
    expect(flow?.progressMessages).toHaveLength(12)
    expect(flow?.progressMessages[0]).toBe('step 3')
    expect(flow?.progressMessages[11]).toBe('step 14')
  })

  test('sets failed status when login throws', async () => {
    const authStorage = makeAuthStorage({
      getOAuthProviders: () => [{ id: 'test', name: 'Test' }],
      login: async () => { throw new Error('network error') },
    })

    const controller = new LoginController({
      authStorage,
      modelRegistry: makeModelRegistry(),
      now: makeClock(),
    })

    await controller.startLogin('test')
    await Promise.resolve()
    await Promise.resolve()

    const flow = controller.getLoginFlow()
    expect(flow?.status).toBe('failed')
    expect(flow?.error).toBe('network error')
  })
})
