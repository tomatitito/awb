import fs from 'node:fs/promises'
import path from 'node:path'
import {
  AuthStorage,
  createAgentSession,
  createEventBus,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent'

export async function createPiSession(projectDir: string) {
  const authStorage = AuthStorage.create()
  const modelRegistry = ModelRegistry.create(authStorage)
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
