import type { TabKey } from './workspace'

export type MobileWorkspaceState = {
  tab: TabKey
  selectedId?: string
  isAgentPanelOpen: boolean
  lastActiveWorkspaceTab: TabKey
}

export function openMobileDetailsForTicket(id: string): Pick<MobileWorkspaceState, 'tab' | 'selectedId'> {
  return {
    selectedId: id,
    tab: 'details',
  }
}

export function closeMobileAgentOverlay(
  state: Pick<MobileWorkspaceState, 'isAgentPanelOpen' | 'lastActiveWorkspaceTab'>,
): Pick<MobileWorkspaceState, 'tab' | 'isAgentPanelOpen'> {
  return {
    tab: state.lastActiveWorkspaceTab,
    isAgentPanelOpen: false,
  }
}

export function openAgentPanelFromHeader(
  state: Pick<MobileWorkspaceState, 'tab'>,
): Pick<MobileWorkspaceState, 'isAgentPanelOpen' | 'lastActiveWorkspaceTab'> {
  return {
    isAgentPanelOpen: true,
    lastActiveWorkspaceTab: state.tab,
  }
}
