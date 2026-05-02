import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SelectableProject } from '../../src/projects'
import { createDefaultSidebarFilters } from '../../src/web/filtering'
import { formatProjectDisplayPath, getProjectOptionLabel, MobileWorkspaceHeader, WorkspaceTopBar } from '../../src/web/workspace'

const projects: SelectableProject[] = [
  { root: '/Users/jens/projects/awb', label: 'AWB' },
  { root: '/Users/jens/projects/really/long/path/to/another-project-with-a-very-long-name' },
]

describe('project selector helpers', () => {
  test('prefers the configured label and falls back to the directory name', () => {
    expect(getProjectOptionLabel(projects[0])).toBe('AWB')
    expect(getProjectOptionLabel(projects[1])).toBe('another-project-with-a-very-long-name')
  })

  test('shortens long project paths without losing the tail', () => {
    expect(formatProjectDisplayPath('/short/path')).toBe('/short/path')
    expect(formatProjectDisplayPath('/Users/jens/projects/really/long/path/to/another-project-with-a-very-long-name', 30)).toBe('…/to/another-project-with-a-very-long-name')
  })
})

describe('project selector UI', () => {
  test('renders a desktop selector with active, loading, and error state details', () => {
    const html = renderToStaticMarkup(
      <WorkspaceTopBar
        projectDir="/Users/jens/projects/really/long/path/to/another-project-with-a-very-long-name"
        projects={projects}
        activeProjectRoot="/Users/jens/projects/really/long/path/to/another-project-with-a-very-long-name"
        isSwitchingProject={true}
        projectSwitchError="Switch failed"
        onProjectChange={() => {}}
        search=""
        onSearchChange={() => {}}
        hideClosed={false}
        onHideClosedChange={() => {}}
        activeAgentRunCount={2}
        onOpenAgentsTab={() => {}}
        isAgentPanelOpen={false}
        onToggleAgentPanel={() => {}}
        agentToggleLabel="Show agent panel"
      />,
    )

    expect(html).toContain('Project')
    expect(html).toContain('project-selector')
    expect(html).toContain('Switching project…')
    expect(html).toContain('Switch failed')
    expect(html).toContain('title="/Users/jens/projects/really/long/path/to/another-project-with-a-very-long-name"')
    expect(html).toContain('selected=""')
  })

  test('renders an equivalent mobile project selector without affecting existing controls', () => {
    const html = renderToStaticMarkup(
      <MobileWorkspaceHeader
        projectDir="/Users/jens/projects/awb"
        projects={projects}
        activeProjectRoot="/Users/jens/projects/awb"
        isSwitchingProject={false}
        onProjectChange={() => {}}
        search="find me"
        onSearchChange={() => {}}
        hideClosed={true}
        onHideClosedChange={() => {}}
        activeAgentRunCount={1}
        onOpenAgentsTab={() => {}}
        isAgentPanelOpen={false}
        onToggleAgentPanel={() => {}}
        agentToggleLabel="Open agent"
        tab="graph"
        onTabChange={() => {}}
        total={1}
        open={1}
        closed={0}
        ready={1}
        hasCycle={false}
        criticalPathLength={0}
        epics={[]}
        filters={createDefaultSidebarFilters()}
        onFiltersChange={() => {}}
      />,
    )

    expect(html).toContain('mobile-project-selector')
    expect(html).toContain('Search id or title')
    expect(html).toContain('hide closed')
    expect(html).toContain('Agents · 1')
  })
})
