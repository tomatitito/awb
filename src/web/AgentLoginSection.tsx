import { useEffect, useState } from 'react'

import type { AgentAuthProviderState, AgentLoginFlowState } from '../agent/types'
import { cancelAgentLogin, fetchAgentAuthProviders, fetchAgentLoginFlow, startAgentLogin, submitAgentLoginInput } from './agentApi'

export function isSafeAuthUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://')
}

export function AgentLoginSection({
  authProviders: initialAuthProviders,
  loginFlow: initialLoginFlow,
  onRefreshState,
}: {
  authProviders: AgentAuthProviderState[]
  loginFlow: AgentLoginFlowState | undefined
  onRefreshState: () => Promise<void>
}) {
  const [authProviders, setAuthProviders] = useState<AgentAuthProviderState[]>(initialAuthProviders)
  const [loginFlow, setLoginFlow] = useState<AgentLoginFlowState | undefined>(initialLoginFlow)
  const [loginInput, setLoginInput] = useState('')
  const [loginError, setLoginError] = useState<string | undefined>()
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false)

  useEffect(() => {
    setAuthProviders(initialAuthProviders)
  }, [initialAuthProviders])

  useEffect(() => {
    setLoginFlow(initialLoginFlow)
  }, [initialLoginFlow])

  useEffect(() => {
    let disposed = false
    const load = async () => {
      try {
        const [providers, flow] = await Promise.all([fetchAgentAuthProviders(), fetchAgentLoginFlow()])
        if (!disposed) {
          setAuthProviders(providers)
          setLoginFlow(flow)
        }
      } catch (error) {
        if (!disposed) setLoginError(error instanceof Error ? error.message : String(error))
      }
    }
    void load()
    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (!loginFlow || !['authorizing', 'awaiting-input', 'running'].includes(loginFlow.status)) return

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const poll = async () => {
      try {
        const flow = await fetchAgentLoginFlow()
        if (cancelled) return
        setLoginFlow(flow)
        if (flow && ['completed', 'failed', 'cancelled'].includes(flow.status)) {
          void fetchAgentAuthProviders()
            .then(setAuthProviders)
            .catch(() => {})
          void onRefreshState().catch(() => {})
          return
        }
      } catch (error) {
        if (cancelled) return
        setLoginError(error instanceof Error ? error.message : String(error))
      }
      if (!cancelled) {
        timeoutId = setTimeout(poll, 1000)
      }
    }

    timeoutId = setTimeout(poll, 1000)

    return () => {
      cancelled = true
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }, [loginFlow?.status, onRefreshState])

  return (
    <section className="agent-panel-section">
      <strong>Subscriptions</strong>
      <div className="agent-tool-list">
        {authProviders.length === 0 ? <div className="empty-inline">No OAuth subscription providers are available.</div> : null}
        {authProviders.map((provider) => (
          <div key={provider.id} className="agent-tool-item">
            <div className="agent-tool-item-top">
              <span>{provider.name}</span>
              <span>{provider.isLoggedIn ? 'logged in' : 'logged out'}</span>
            </div>
            <code>
              {provider.id} · {provider.availableModelCount}/{provider.configuredModelCount} models ready
            </code>
            <div className="agent-run-controls">
              <button
                type="button"
                className="secondary-button"
                disabled={Boolean(loginFlow && ['authorizing', 'awaiting-input', 'running'].includes(loginFlow.status))}
                onClick={() => {
                  setLoginError(undefined)
                  setLoginInput('')
                  void startAgentLogin(provider.id)
                    .then(setLoginFlow)
                    .catch((error) => setLoginError(error instanceof Error ? error.message : String(error)))
                }}
              >
                {provider.isLoggedIn ? 'Reconnect' : 'Login'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {loginFlow ? (
        <div className="agent-composer">
          <strong>Login flow</strong>
          <div className="agent-composer-note">
            {loginFlow.providerName} · {loginFlow.status}
          </div>
          {loginFlow.authUrl && isSafeAuthUrl(loginFlow.authUrl) ? (
            <a href={loginFlow.authUrl} target="_blank" rel="noreferrer">
              Open authorization page
            </a>
          ) : null}
          {loginFlow.instructions ? <div className="agent-composer-note">{loginFlow.instructions}</div> : null}
          {loginFlow.progressMessages.length > 0 ? (
            <div className="agent-tool-list">
              {loginFlow.progressMessages.map((message, index) => (
                <div key={`${message}-${index}`} className="agent-tool-item">
                  <code>{message}</code>
                </div>
              ))}
            </div>
          ) : null}
          {loginFlow.prompt ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (isLoginSubmitting) return
                setIsLoginSubmitting(true)
                setLoginError(undefined)
                void submitAgentLoginInput(loginInput)
                  .then(() => setLoginInput(''))
                  .catch((error) => setLoginError(error instanceof Error ? error.message : String(error)))
                  .finally(() => setIsLoginSubmitting(false))
              }}
            >
              <div className="agent-composer-note">{loginFlow.prompt.message}</div>
              <textarea
                value={loginInput}
                onChange={(event) => setLoginInput(event.target.value)}
                placeholder={loginFlow.prompt.placeholder || 'Paste the requested value'}
                rows={3}
              />
              <div className="agent-run-controls">
                <button type="submit" className="primary-button" disabled={isLoginSubmitting}>
                  Submit
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={isLoginSubmitting}
                  onClick={() => {
                    setLoginError(undefined)
                    void cancelAgentLogin()
                      .then(async () => {
                        setLoginFlow(await fetchAgentLoginFlow())
                        setAuthProviders(await fetchAgentAuthProviders())
                        await onRefreshState()
                      })
                      .catch((error) => setLoginError(error instanceof Error ? error.message : String(error)))
                  }}
                >
                  Cancel login
                </button>
              </div>
            </form>
          ) : null}
          {loginFlow.error ? <div className="agent-panel-error">{loginFlow.error}</div> : null}
        </div>
      ) : null}
      {loginError ? <div className="agent-panel-error">{loginError}</div> : null}
    </section>
  )
}
