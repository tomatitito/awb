import type { AuthStorage, ModelRegistry } from '@mariozechner/pi-coding-agent'
import type { AgentAuthProviderState, AgentLoginFlowState } from './types.js'

const LOGIN_PROGRESS_LIMIT = 12

type DeferredInput = {
  resolve: (value: string) => void
  reject: (error: Error) => void
  kind: 'prompt' | 'manual-code'
}

export type LoginControllerOptions = {
  authStorage: AuthStorage
  modelRegistry: ModelRegistry
  now: () => number
}

export class LoginController {
  private readonly authStorage: AuthStorage
  private readonly modelRegistry: ModelRegistry
  private readonly now: () => number
  private loginFlow?: AgentLoginFlowState
  private pendingLoginInput?: DeferredInput
  private loginAbortController?: AbortController

  constructor(options: LoginControllerOptions) {
    this.authStorage = options.authStorage
    this.modelRegistry = options.modelRegistry
    this.now = options.now
  }

  getAuthProviders(): AgentAuthProviderState[] {
    this.modelRegistry.refresh()
    const allModels = this.modelRegistry.getAll()
    return this.authStorage
      .getOAuthProviders()
      .map((provider) => {
        const providerModels = allModels.filter((model) => model.provider === provider.id)
        return {
          id: provider.id,
          name: provider.name,
          usesCallbackServer: Boolean(provider.usesCallbackServer),
          isLoggedIn: this.authStorage.get(provider.id)?.type === 'oauth',
          availableModelCount: providerModels.filter((model) => this.modelRegistry.hasConfiguredAuth(model)).length,
          configuredModelCount: providerModels.length,
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  async startLogin(providerId: string): Promise<AgentLoginFlowState> {
    if (this.loginAbortController) {
      throw new Error('A login flow is already in progress.')
    }

    const provider = this.authStorage.getOAuthProviders().find((entry) => entry.id === providerId)
    if (!provider) {
      throw new Error(`Unknown login provider: ${providerId}`)
    }

    const abortController = new AbortController()
    this.loginAbortController = abortController
    this.loginFlow = {
      providerId: provider.id,
      providerName: provider.name,
      status: 'running',
      progressMessages: [],
    }

    void this.runLogin(provider.id, provider.name, abortController)
    return this.loginFlow
  }

  getLoginFlow(): AgentLoginFlowState | undefined {
    return this.loginFlow
  }

  async submitLoginInput(value: string): Promise<void> {
    if (!this.pendingLoginInput) {
      throw new Error('The current login flow is not waiting for input.')
    }

    const input = this.pendingLoginInput
    this.pendingLoginInput = undefined
    input.resolve(value)
  }

  async cancelLogin(): Promise<void> {
    this.pendingLoginInput?.reject(new Error('Login cancelled.'))
    this.pendingLoginInput = undefined
    this.loginAbortController?.abort()
    if (this.loginFlow) {
      this.loginFlow = {
        ...this.loginFlow,
        status: 'cancelled',
        error: 'Login cancelled.',
        completedAt: this.now(),
      }
    }
    this.loginAbortController = undefined
  }

  private async runLogin(providerId: string, providerName: string, abortController: AbortController): Promise<void> {
    try {
      await this.authStorage.login(providerId, {
        signal: abortController.signal,
        onAuth: ({ url, instructions }) => {
          if (!this.loginFlow || this.loginFlow.providerId !== providerId) return
          this.loginFlow = {
            ...this.loginFlow,
            status: 'authorizing',
            authUrl: url,
            instructions,
          }
        },
        onPrompt: async (prompt) => {
          if (!this.loginFlow || this.loginFlow.providerId !== providerId) {
            throw new Error('Login flow was reset.')
          }
          this.loginFlow = {
            ...this.loginFlow,
            status: 'awaiting-input',
            prompt: {
              message: prompt.message,
              placeholder: prompt.placeholder,
              allowEmpty: prompt.allowEmpty,
              kind: 'prompt',
            },
          }
          return await this.waitForLoginInput('prompt', abortController.signal)
        },
        onManualCodeInput: async () => {
          if (!this.loginFlow || this.loginFlow.providerId !== providerId) {
            throw new Error('Login flow was reset.')
          }
          this.loginFlow = {
            ...this.loginFlow,
            status: 'awaiting-input',
            prompt: {
              message: 'Paste the callback URL or authorization code from the provider.',
              kind: 'manual-code',
            },
          }
          return await this.waitForLoginInput('manual-code', abortController.signal)
        },
        onProgress: (message) => {
          this.appendLoginProgress(message)
        },
      })

      this.modelRegistry.refresh()
      this.loginFlow = {
        providerId,
        providerName,
        status: 'completed',
        progressMessages: this.loginFlow?.progressMessages ?? [],
        completedAt: this.now(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.loginFlow = {
        providerId,
        providerName,
        status: abortController.signal.aborted ? 'cancelled' : 'failed',
        progressMessages: this.loginFlow?.progressMessages ?? [],
        error: message,
        completedAt: this.now(),
      }
    } finally {
      this.pendingLoginInput = undefined
      this.loginAbortController = undefined
    }
  }

  private appendLoginProgress(message: string): void {
    if (!this.loginFlow) return
    this.loginFlow = {
      ...this.loginFlow,
      status: this.loginFlow.status === 'awaiting-input' ? this.loginFlow.status : 'running',
      progressMessages: [...this.loginFlow.progressMessages, message].slice(-LOGIN_PROGRESS_LIMIT),
    }
  }

  private waitForLoginInput(kind: DeferredInput['kind'], signal: AbortSignal): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const onAbort = () => {
        this.pendingLoginInput = undefined
        reject(new Error('Login cancelled.'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
      this.pendingLoginInput = {
        kind,
        resolve: (value) => {
          signal.removeEventListener('abort', onAbort)
          resolve(value)
        },
        reject: (error) => {
          signal.removeEventListener('abort', onAbort)
          reject(error)
        },
      }
    })
  }
}
