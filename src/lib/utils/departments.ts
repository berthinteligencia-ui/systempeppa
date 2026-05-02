export function toTitleCase(str: string): string {
  return str.toLowerCase().split(" ").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ")
}

export type DeptRow = {
  id: string
  name: string
  cnpj?: string | null
  nivel?: string | null
  active: boolean
  parentId?: string | null
  _count: { employees: number }
  children?: DeptRow[]
}

// Build tree from flat list — exported for use in page.tsx
export function buildTree(flat: DeptRow[]): DeptRow[] {
  const map = new Map<string, DeptRow>()
  flat.forEach(d => map.set(d.id, { ...d, children: [] }))
  const roots: DeptRow[] = []
  map.forEach(d => {
    if (d.parentId && map.has(d.parentId)) {
      map.get(d.parentId)!.children!.push(d)
    } else {
      roots.push(d)
    }
  })
  // Sort each level by name
  const sort = (nodes: DeptRow[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    nodes.forEach(n => n.children && sort(n.children))
  }
  sort(roots)
  return roots
}

// Flatten tree preserving depth for indented selects
export function flattenTree(nodes: DeptRow[], depth = 0): (DeptRow & { depth: number })[] {
  const result: (DeptRow & { depth: number })[] = []
  for (const n of nodes) {
    result.push({ ...n, depth })
    if (n.children?.length) result.push(...flattenTree(n.children, depth + 1))
  }
  return result
}
