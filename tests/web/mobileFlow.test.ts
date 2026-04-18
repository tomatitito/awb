import { describe, expect, test } from 'bun:test'
import {
  closeMobileAgentOverlay,
  openAgentPanelFromHeader,
  openMobileDetailsForTicket,
  type MobileWorkspaceState,
} from '../../src/web/mobileFlow'

describe('mobile workspace flow helpers', () => {
  test('opens details when a graph ticket is selected on mobile', () => {
    expect(openMobileDetailsForTicket('awb-1234')).toEqual({
      selectedId: 'awb-1234',
      tab: 'details',
    })
  })

  test('returning from details to graph preserves the selected ticket', () => {
    const state: MobileWorkspaceState = {
      tab: 'details',
      selectedId: 'awb-1234',
      isAgentPanelOpen: false,
      lastActiveWorkspaceTab: 'graph',
    }

    const next = {
      ...state,
      tab: 'graph' as const,
    }

    expect(next.selectedId).toBe('awb-1234')
    expect(next.tab).toBe('graph')
  })

  test('opening the agent from the mobile header remembers the current view', () => {
    expect(openAgentPanelFromHeader({ tab: 'kanban' })).toEqual({
      isAgentPanelOpen: true,
      lastActiveWorkspaceTab: 'kanban',
    })
  })

  test('closing the agent overlay returns to the previously active view', () => {
    expect(closeMobileAgentOverlay({
      isAgentPanelOpen: true,
      lastActiveWorkspaceTab: 'details',
    })).toEqual({
      tab: 'details',
      isAgentPanelOpen: false,
    })
  })

  test('closing the agent overlay does not mutate the selected ticket or run state', () => {
    const state: MobileWorkspaceState & { agentRun: { isStreaming: boolean } } = {
      tab: 'details',
      selectedId: 'awb-1234',
      isAgentPanelOpen: true,
      lastActiveWorkspaceTab: 'graph',
      agentRun: { isStreaming: true },
    }

    const next = {
      ...state,
      ...closeMobileAgentOverlay(state),
    }

    expect(next.selectedId).toBe('awb-1234')
    expect(next.agentRun.isStreaming).toBe(true)
    expect(next.tab).toBe('graph')
    expect(next.isAgentPanelOpen).toBe(false)
  })
})
