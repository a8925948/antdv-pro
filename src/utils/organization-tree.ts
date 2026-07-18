import type { OrganizationNode } from '~@/api/system'

export interface OrganizationTreeNode extends OrganizationNode {
  key: string
  title: string
  memberCount: number
  children: OrganizationTreeNode[]
}

export function getOrganizationTreeKey(item: Pick<OrganizationNode, 'id' | 'type'>) {
  return `${item.type}:${item.id}`
}

export function buildOrganizationTree(
  list: OrganizationNode[],
  getMemberCount: (item: OrganizationNode) => number,
): OrganizationTreeNode[] {
  const nodesByParent = new Map<string, OrganizationNode[]>()

  for (const item of list) {
    const parentKey = getExpectedParentKey(item)
    const siblings = nodesByParent.get(parentKey) || []
    siblings.push(item)
    nodesByParent.set(parentKey, siblings)
  }

  const buildChildren = (parentKey: string): OrganizationTreeNode[] => (nodesByParent.get(parentKey) || [])
    .sort((a, b) => a.sortNo - b.sortNo)
    .map(item => ({
      ...item,
      key: getOrganizationTreeKey(item),
      title: item.name,
      memberCount: getMemberCount(item),
      children: buildChildren(getOrganizationTreeKey(item)),
    }))

  return buildChildren('root')
}

function getExpectedParentKey(item: OrganizationNode) {
  if (item.type === 'company' || !item.parentId)
    return 'root'
  return `${item.type === 'department' ? 'company' : 'department'}:${item.parentId}`
}
