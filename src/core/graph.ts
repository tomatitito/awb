import type { DerivedTicket } from './types.js'

export type GraphCycle = {
  nodeIds: string[]
  edgeIds: string[]
}

export type GraphDependencyEdge = {
  id: string
  source: string
  target: string
  isCritical: boolean
}

export type GraphRelatedEdge = {
  id: string
  source: string
  target: string
}

export type GraphNodeLayout = {
  id: string
  layer: number
  order: number
  critical: boolean
}

export type GraphDerivation = {
  hasCycle: boolean
  cycle?: GraphCycle
  nodes: GraphNodeLayout[]
  dependencyEdges: GraphDependencyEdge[]
  criticalPath: {
    nodeIds: string[]
    edgeIds: string[]
    length: number
  }
}

export type VisibleGraphDerivation = {
  hasCycle: boolean
  cycle?: GraphCycle
  nodes: GraphNodeLayout[]
  dependencyEdges: GraphDependencyEdge[]
  relatedEdges: GraphRelatedEdge[]
  criticalPath: {
    nodeIds: string[]
    edgeIds: string[]
    length: number
  }
}

function compareIds(a: string, b: string): number {
  return a.localeCompare(b)
}

function edgeId(source: string, target: string): string {
  return `${source}->${target}`
}

function buildAdjacency(tickets: DerivedTicket[]): {
  nodes: string[]
  outgoing: Map<string, string[]>
  incoming: Map<string, string[]>
} {
  const ids = tickets.map((ticket) => ticket.id).sort(compareIds)
  const known = new Set(ids)
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()

  for (const id of ids) {
    outgoing.set(id, [])
    incoming.set(id, [])
  }

  for (const ticket of tickets) {
    const uniqueDeps = Array.from(new Set(ticket.blockedBy.filter((dep) => known.has(dep)))).sort(compareIds)
    for (const dep of uniqueDeps) {
      outgoing.get(dep)?.push(ticket.id)
      incoming.get(ticket.id)?.push(dep)
    }
  }

  for (const id of ids) {
    outgoing.get(id)?.sort(compareIds)
    incoming.get(id)?.sort(compareIds)
  }

  return { nodes: ids, outgoing, incoming }
}

function detectCycle(nodes: string[], outgoing: Map<string, string[]>): GraphCycle | undefined {
  const state = new Map<string, number>()
  const stack: string[] = []
  let found: GraphCycle | undefined

  const visit = (nodeId: string) => {
    if (found) return
    state.set(nodeId, 1)
    stack.push(nodeId)

    for (const nextId of outgoing.get(nodeId) ?? []) {
      const nextState = state.get(nextId) ?? 0
      if (nextState === 0) {
        visit(nextId)
        if (found) return
      } else if (nextState === 1) {
        const startIndex = stack.indexOf(nextId)
        const nodeIds = [...stack.slice(startIndex), nextId]
        found = {
          nodeIds,
          edgeIds: nodeIds.slice(0, -1).map((current, index) => edgeId(current, nodeIds[index + 1])),
        }
        return
      }
    }

    stack.pop()
    state.set(nodeId, 2)
  }

  for (const nodeId of nodes) {
    if ((state.get(nodeId) ?? 0) === 0) {
      visit(nodeId)
      if (found) break
    }
  }

  return found
}

function deriveLayers(nodes: string[], incoming: Map<string, string[]>, outgoing: Map<string, string[]>): GraphNodeLayout[] {
  const inDegree = new Map<string, number>()
  const longestIncomingDepth = new Map<string, number>()

  for (const nodeId of nodes) {
    inDegree.set(nodeId, incoming.get(nodeId)?.length ?? 0)
    longestIncomingDepth.set(nodeId, 0)
  }

  const ready = nodes.filter((nodeId) => (inDegree.get(nodeId) ?? 0) === 0).sort(compareIds)
  const order: string[] = []

  while (ready.length > 0) {
    const nodeId = ready.shift()!
    order.push(nodeId)

    for (const nextId of outgoing.get(nodeId) ?? []) {
      const nextDepth = Math.max(longestIncomingDepth.get(nextId) ?? 0, (longestIncomingDepth.get(nodeId) ?? 0) + 1)
      longestIncomingDepth.set(nextId, nextDepth)
      const remaining = (inDegree.get(nextId) ?? 0) - 1
      inDegree.set(nextId, remaining)
      if (remaining === 0) {
        ready.push(nextId)
        ready.sort(compareIds)
      }
    }
  }

  const layerGroups = new Map<number, string[]>()
  for (const nodeId of order) {
    const layer = longestIncomingDepth.get(nodeId) ?? 0
    const group = layerGroups.get(layer) ?? []
    group.push(nodeId)
    layerGroups.set(layer, group)
  }

  return order.map((nodeId) => {
    const layer = longestIncomingDepth.get(nodeId) ?? 0
    const siblings = layerGroups.get(layer) ?? []
    return {
      id: nodeId,
      layer,
      order: siblings.indexOf(nodeId),
      critical: false,
    }
  })
}

function hasAlternatePath(source: string, target: string, outgoing: Map<string, string[]>): boolean {
  const queue = [...(outgoing.get(source) ?? []).filter((candidate) => candidate !== target)]
  const visited = new Set<string>([source])

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (nodeId === target) return true
    if (visited.has(nodeId)) continue
    visited.add(nodeId)
    for (const nextId of outgoing.get(nodeId) ?? []) {
      if (!visited.has(nextId)) {
        queue.push(nextId)
      }
    }
  }

  return false
}

function deriveReducedEdges(nodes: string[], outgoing: Map<string, string[]>): GraphDependencyEdge[] {
  const edges: GraphDependencyEdge[] = []
  for (const source of nodes) {
    for (const target of outgoing.get(source) ?? []) {
      if (!hasAlternatePath(source, target, outgoing)) {
        edges.push({
          id: edgeId(source, target),
          source,
          target,
          isCritical: false,
        })
      }
    }
  }

  return edges.sort((left, right) => left.id.localeCompare(right.id))
}

function deriveCriticalPath(nodes: string[], incoming: Map<string, string[]>, outgoing: Map<string, string[]>): GraphDerivation['criticalPath'] {
  const distances = new Map<string, number>()
  const previous = new Map<string, string | undefined>()
  const remaining = new Map<string, number>()
  const ready: string[] = []

  for (const nodeId of nodes) {
    remaining.set(nodeId, incoming.get(nodeId)?.length ?? 0)
    distances.set(nodeId, 0)
    if ((incoming.get(nodeId)?.length ?? 0) === 0) {
      ready.push(nodeId)
    }
  }
  ready.sort(compareIds)

  const topo: string[] = []
  while (ready.length > 0) {
    const nodeId = ready.shift()!
    topo.push(nodeId)
    for (const nextId of outgoing.get(nodeId) ?? []) {
      const candidateDistance = (distances.get(nodeId) ?? 0) + 1
      const currentDistance = distances.get(nextId) ?? 0
      const currentPrevious = previous.get(nextId)
      if (
        candidateDistance > currentDistance ||
        (candidateDistance === currentDistance && currentPrevious !== undefined && nodeId.localeCompare(currentPrevious) < 0)
      ) {
        distances.set(nextId, candidateDistance)
        previous.set(nextId, nodeId)
      } else if (candidateDistance === currentDistance && currentPrevious === undefined) {
        previous.set(nextId, nodeId)
      }

      const nextRemaining = (remaining.get(nextId) ?? 0) - 1
      remaining.set(nextId, nextRemaining)
      if (nextRemaining === 0) {
        ready.push(nextId)
        ready.sort(compareIds)
      }
    }
  }

  let endNode = nodes[0]
  for (const nodeId of nodes) {
    const bestDistance = distances.get(endNode) ?? 0
    const distance = distances.get(nodeId) ?? 0
    if (distance > bestDistance || (distance === bestDistance && nodeId.localeCompare(endNode) < 0)) {
      endNode = nodeId
    }
  }

  if (!endNode) {
    return { nodeIds: [], edgeIds: [], length: 0 }
  }

  const nodeIds: string[] = []
  let current: string | undefined = endNode
  while (current) {
    nodeIds.push(current)
    current = previous.get(current)
  }
  nodeIds.reverse()

  return {
    nodeIds,
    edgeIds: nodeIds.slice(1).map((nodeId, index) => edgeId(nodeIds[index], nodeId)),
    length: Math.max(0, nodeIds.length - 1),
  }
}

export function deriveGraph(tickets: DerivedTicket[]): GraphDerivation {
  const { nodes, outgoing, incoming } = buildAdjacency(tickets)
  const cycle = detectCycle(nodes, outgoing)

  if (cycle) {
    return {
      hasCycle: true,
      cycle,
      nodes: [],
      dependencyEdges: [],
      criticalPath: {
        nodeIds: [],
        edgeIds: [],
        length: 0,
      },
    }
  }

  const criticalPath = deriveCriticalPath(nodes, incoming, outgoing)
  const criticalNodeIds = new Set(criticalPath.nodeIds)
  const criticalEdgeIds = new Set(criticalPath.edgeIds)
  const layeredNodes = deriveLayers(nodes, incoming, outgoing).map((node) => ({
    ...node,
    critical: criticalNodeIds.has(node.id),
  }))
  const reducedEdges = deriveReducedEdges(nodes, outgoing).map((edge) => ({
    ...edge,
    isCritical: criticalEdgeIds.has(edge.id),
  }))

  return {
    hasCycle: false,
    nodes: layeredNodes,
    dependencyEdges: reducedEdges,
    criticalPath,
  }
}

function compactVisibleNodes(nodes: GraphNodeLayout[]): GraphNodeLayout[] {
  const layerGroups = new Map<number, GraphNodeLayout[]>()

  for (const node of nodes) {
    const group = layerGroups.get(node.layer) ?? []
    group.push(node)
    layerGroups.set(node.layer, group)
  }

  const compactedById = new Map<string, GraphNodeLayout>()
  for (const [layer, group] of layerGroups) {
    group
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      .forEach((node, order) => {
        compactedById.set(node.id, {
          ...node,
          layer,
          order,
        })
      })
  }

  return nodes.map((node) => compactedById.get(node.id) ?? node)
}

export function deriveVisibleGraph(
  graph: GraphDerivation,
  visibleTickets: DerivedTicket[],
  selectedTicket?: DerivedTicket,
): VisibleGraphDerivation {
  if (graph.hasCycle) {
    return {
      hasCycle: true,
      cycle: graph.cycle,
      nodes: [],
      dependencyEdges: [],
      relatedEdges: [],
      criticalPath: graph.criticalPath,
    }
  }

  const visibleIds = new Set(visibleTickets.map((ticket) => ticket.id))
  const selectedLinks = new Set(selectedTicket?.links ?? [])
  const selectedDependencies = new Set(selectedTicket?.blockedBy ?? [])
  const selectedDependents = new Set(selectedTicket?.unblocks ?? [])
  const nodes = compactVisibleNodes(graph.nodes.filter((node) => visibleIds.has(node.id)))
  const dependencyEdges = graph.dependencyEdges.filter(
    (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
  )
  const relatedEdges: GraphRelatedEdge[] = selectedTicket
    ? Array.from(selectedLinks)
        .filter((target) => (
          target !== selectedTicket.id &&
          visibleIds.has(target) &&
          !selectedDependencies.has(target) &&
          !selectedDependents.has(target)
        ))
        .sort(compareIds)
        .map((target) => ({
          id: `${selectedTicket.id}~>${target}`,
          source: selectedTicket.id,
          target,
        }))
    : []

  return {
    hasCycle: false,
    nodes,
    dependencyEdges,
    relatedEdges,
    criticalPath: {
      nodeIds: graph.criticalPath.nodeIds.filter((id) => visibleIds.has(id)),
      edgeIds: graph.criticalPath.edgeIds.filter((id) => {
        const [source, target] = id.split('->')
        return visibleIds.has(source) && visibleIds.has(target)
      }),
      length: graph.criticalPath.length,
    },
  }
}
