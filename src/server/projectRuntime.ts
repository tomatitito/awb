import type fs from 'node:fs'
import path from 'node:path'
import type { AgentController } from '../agent/AgentController.js'
import type { createPiSession } from '../agent/createPiSession.js'
import type { LoginController } from '../agent/LoginController.js'
import type { AgentRunEvent, SelectedTicketContext } from '../agent/types.js'
import type { GitWorktreeManager } from '../agent/worktree.js'
import type { loadAwbSettings } from '../config.js'
import type { loadTickets } from '../core/loadTickets.js'

export type RuntimeReloadPayload = {
  ticketCount: number
  ticketsDir: string
  projectDir: string
  updatedAt: string
  switched?: boolean
}

export type RuntimeReloadErrorPayload = {
  message: string
  updatedAt: string
}

type RuntimeState = {
  projectDir: string
  ticketsDir: string
  absoluteTicketsDir: string
  data: Awaited<ReturnType<typeof loadTickets>>
  watcher: fs.FSWatcher
  agentController: AgentController
  unsubscribeAgent: () => void
}

export type ProjectRuntimeManagerOptions = {
  projectDir: string
  ticketsDir: string
  editorCommand?: string
}

export type ProjectRuntimeManagerDeps = {
  loadTickets: typeof loadTickets
  loadAwbSettings: typeof loadAwbSettings
  watch: typeof fs.watch
  createAgentController: (projectDir: string, options: ConstructorParameters<typeof AgentController>[1]) => AgentController
  createWorktreeManager: (projectDir: string, options: ConstructorParameters<typeof GitWorktreeManager>[1]) => GitWorktreeManager
  createLoginController: (options: ConstructorParameters<typeof LoginController>[0]) => LoginController
  createSession: typeof createPiSession
  createRunId: () => string
  now: () => number
  toIsoString: () => string
  authStorage: ConstructorParameters<typeof LoginController>[0]['authStorage']
  modelRegistry: ConstructorParameters<typeof LoginController>[0]['modelRegistry']
  onReload: (payload: RuntimeReloadPayload) => void
  onReloadError: (payload: RuntimeReloadErrorPayload) => void
  onAgentEvent: (event: AgentRunEvent) => void
  onReloadFailure?: (absoluteTicketsDir: string, message: string) => void
}

export class ProjectRuntimeManager {
  private runtime: RuntimeState | undefined
  private reloadTimer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly options: ProjectRuntimeManagerOptions,
    private readonly deps: ProjectRuntimeManagerDeps,
  ) {}

  static async create(options: ProjectRuntimeManagerOptions, deps: ProjectRuntimeManagerDeps): Promise<ProjectRuntimeManager> {
    const manager = new ProjectRuntimeManager(options, deps)
    await manager.initialize()
    return manager
  }

  get data() {
    return this.requireRuntime().data
  }

  get projectDir() {
    return this.requireRuntime().projectDir
  }

  get ticketsDir() {
    return this.requireRuntime().ticketsDir
  }

  get agentController() {
    return this.requireRuntime().agentController
  }

  async reloadTickets() {
    const runtime = this.requireRuntime()
    try {
      runtime.data = await this.deps.loadTickets(runtime.projectDir, runtime.ticketsDir)
      this.deps.onReload(this.createReloadPayload(runtime))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.deps.onReloadFailure?.(runtime.absoluteTicketsDir, message)
      this.deps.onReloadError({
        message,
        updatedAt: this.deps.toIsoString(),
      })
    }
  }

  scheduleReload() {
    this.clearReloadTimer()
    this.reloadTimer = setTimeout(() => {
      void this.reloadTickets()
    }, 100)
  }

  async switchProject(projectDir: string): Promise<RuntimeReloadPayload> {
    const nextRuntime = await this.createRuntime(projectDir, this.options.ticketsDir)
    const previousRuntime = this.requireRuntime()
    this.runtime = nextRuntime
    this.clearReloadTimer()
    this.disposeRuntime(previousRuntime)
    return this.createReloadPayload(nextRuntime, { switched: true })
  }

  getTicketContext(ticketId: string): SelectedTicketContext | undefined {
    const ticket = this.data.tickets.find((entry) => entry.id === ticketId)
    if (!ticket) return undefined
    return {
      ticketId: ticket.id,
      title: ticket.title,
      body: ticket.body,
      filePath: ticket.filePath,
    }
  }

  dispose() {
    this.clearReloadTimer()
    if (this.runtime) {
      this.disposeRuntime(this.runtime)
      this.runtime = undefined
    }
  }

  private async initialize() {
    this.runtime = await this.createRuntime(this.options.projectDir, this.options.ticketsDir)
  }

  private async createRuntime(projectDir: string, ticketsDir: string): Promise<RuntimeState> {
    const data = await this.deps.loadTickets(projectDir, ticketsDir)
    const settings = await this.deps.loadAwbSettings({ projectDir })
    const absoluteTicketsDir = path.resolve(projectDir, ticketsDir)
    const worktreeManager = this.deps.createWorktreeManager(projectDir, {
      enabled: Boolean(settings.worktreeIsolationEnabled),
      now: this.deps.now,
    })
    const agentController = this.deps.createAgentController(projectDir, {
      createSession: this.deps.createSession,
      createRunId: this.deps.createRunId,
      now: this.deps.now,
      loginController: this.deps.createLoginController({ authStorage: this.deps.authStorage, modelRegistry: this.deps.modelRegistry, now: this.deps.now }),
      credentialProvider: this.deps.authStorage,
      modelRegistry: this.deps.modelRegistry,
      worktreeManager,
      editorCommand: this.options.editorCommand ?? settings.editorCommand,
    })
    await agentController.ensureStarted()
    const watcher = this.deps.watch(absoluteTicketsDir, (_eventType, filename) => {
      const runtime = this.runtime
      if (!runtime || runtime.projectDir !== projectDir || runtime.ticketsDir !== ticketsDir) return
      if (!filename || filename.toString().endsWith('.md')) {
        this.scheduleReload()
      }
    })
    const unsubscribeAgent = agentController.subscribe((event) => {
      this.deps.onAgentEvent(event)
    })

    return {
      projectDir,
      ticketsDir,
      absoluteTicketsDir,
      data,
      watcher,
      agentController,
      unsubscribeAgent,
    }
  }

  private disposeRuntime(state: RuntimeState) {
    state.watcher.close()
    state.unsubscribeAgent()
    state.agentController.dispose()
  }

  private clearReloadTimer() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer)
    this.reloadTimer = undefined
  }

  private createReloadPayload(runtime: RuntimeState, extra: Pick<RuntimeReloadPayload, 'switched'> = {}): RuntimeReloadPayload {
    return {
      ticketCount: runtime.data.tickets.length,
      ticketsDir: runtime.data.ticketsDir,
      projectDir: runtime.data.projectDir,
      updatedAt: this.deps.toIsoString(),
      ...extra,
    }
  }

  private requireRuntime(): RuntimeState {
    if (!this.runtime) throw new Error('Project runtime is not initialized.')
    return this.runtime
  }
}
