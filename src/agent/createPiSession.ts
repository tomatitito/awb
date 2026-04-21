import fs from 'node:fs/promises'
import path from 'node:path'
import type { Model } from '@mariozechner/pi-ai'
import type { AuthCredential } from '@mariozechner/pi-coding-agent'
import { AuthStorage, createAgentSession, createEventBus, DefaultResourceLoader, ModelRegistry, SessionManager } from '@mariozechner/pi-coding-agent'

/**
 * Narrow credential-access interface passed to createSession.
 * AuthStorage implements this structurally; only these methods are
 * required to create an agent session, keeping full auth-flow
 * ownership (login/logout/OAuth) inside LoginController.
 */
export interface CredentialProvider {
  get(provider: string): AuthCredential | undefined
  getApiKey(providerId: string, options?: { includeFallback?: boolean }): Promise<string | undefined>
  has(provider: string): boolean
  hasAuth(provider: string): boolean
}

export async function createPiSession(
  projectDir: string,
  options: {
    credentialProvider?: CredentialProvider
    modelRegistry?: ModelRegistry
    model?: Model<any>
  } = {},
) {
  const authStorage = (options.credentialProvider as AuthStorage) ?? AuthStorage.create()
  const modelRegistry = options.modelRegistry ?? ModelRegistry.create(authStorage)
  const eventBus = createEventBus()
  const resourceLoader = new DefaultResourceLoader({
    cwd: projectDir,
    eventBus,
  })

  await resourceLoader.reload()

  const awbSessionDir = path.join(projectDir, '.awb', 'pi-sessions')
  await fs.mkdir(awbSessionDir, { recursive: true })

  const result = await createAgentSession({
    cwd: projectDir,
    authStorage,
    modelRegistry,
    model: options.model,
    resourceLoader,
    sessionManager: SessionManager.continueRecent(projectDir, awbSessionDir),
  })

  return {
    ...result,
    eventBus,
    resourceLoader,
    awbSessionDir,
  }
}
