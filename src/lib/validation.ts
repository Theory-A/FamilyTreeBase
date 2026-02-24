import type { FamilyNode, ParentLink, PartnerLink } from "../types";

/**
 * Extract the ID from a parent or partner reference (handles both string and object forms)
 */
export function getLinkId(link: string | ParentLink | PartnerLink): string {
  return typeof link === "string" ? link : link.id;
}

/**
 * Find all root nodes (nodes with no parents)
 */
export function findRootNodes(nodes: FamilyNode[]): FamilyNode[] {
  return nodes.filter(
    (node) => !node.parent_ids || node.parent_ids.length === 0
  );
}

/**
 * Build a map of node ID to node for quick lookup
 */
export function buildNodeMap(nodes: FamilyNode[]): Map<string, FamilyNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

/**
 * Build a map of parent ID to child IDs (reverse lookup)
 */
export function buildChildrenMap(nodes: FamilyNode[]): Map<string, string[]> {
  const childrenMap = new Map<string, string[]>();

  for (const node of nodes) {
    if (node.parent_ids) {
      for (const parentRef of node.parent_ids) {
        const parentId = getLinkId(parentRef);
        const children = childrenMap.get(parentId) || [];
        children.push(node.id);
        childrenMap.set(parentId, children);
      }
    }
  }

  return childrenMap;
}

/**
 * Validate that there are no circular parent-child references
 * Returns an array of error messages (empty if valid)
 */
export function validateNoCircularRefs(nodes: FamilyNode[]): string[] {
  const errors: string[] = [];
  const nodeMap = buildNodeMap(nodes);

  function hasCircularRef(
    nodeId: string,
    visited: Set<string>,
    path: string[]
  ): boolean {
    if (visited.has(nodeId)) {
      errors.push(
        `Circular reference detected: ${[...path, nodeId].join(" -> ")}`
      );
      return true;
    }

    const node = nodeMap.get(nodeId);
    if (!node || !node.parent_ids || node.parent_ids.length === 0) {
      return false;
    }

    visited.add(nodeId);
    path.push(nodeId);

    for (const parentRef of node.parent_ids) {
      const parentId = getLinkId(parentRef);
      if (hasCircularRef(parentId, visited, path)) {
        return true;
      }
    }

    visited.delete(nodeId);
    path.pop();
    return false;
  }

  for (const node of nodes) {
    hasCircularRef(node.id, new Set(), []);
  }

  return errors;
}

/**
 * Validate that partner links are bidirectional (if A lists B as partner, B should list A)
 * Returns an array of error messages (empty if valid)
 */
export function validateBidirectionalPartners(nodes: FamilyNode[]): string[] {
  const errors: string[] = [];
  const nodeMap = buildNodeMap(nodes);

  for (const node of nodes) {
    if (!node.partner_ids) continue;

    for (const partnerRef of node.partner_ids) {
      const partnerId = getLinkId(partnerRef);
      const partner = nodeMap.get(partnerId);

      if (!partner) {
        errors.push(
          `Node "${node.id}" references non-existent partner "${partnerId}"`
        );
        continue;
      }

      if (!partner.partner_ids) {
        errors.push(
          `Partner link not bidirectional: "${node.id}" -> "${partnerId}" (partner has no partner_ids)`
        );
        continue;
      }

      const partnerLinksBack = partner.partner_ids.some(
        (ref) => getLinkId(ref) === node.id
      );

      if (!partnerLinksBack) {
        errors.push(
          `Partner link not bidirectional: "${node.id}" -> "${partnerId}"`
        );
      }
    }
  }

  return errors;
}

/**
 * Validate that all referenced parent IDs exist in the node list
 * Returns an array of error messages (empty if valid)
 */
export function validateParentRefsExist(nodes: FamilyNode[]): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    if (!node.parent_ids) continue;

    for (const parentRef of node.parent_ids) {
      const parentId = getLinkId(parentRef);
      if (!nodeIds.has(parentId)) {
        errors.push(
          `Node "${node.id}" references non-existent parent "${parentId}"`
        );
      }
    }
  }

  return errors;
}

/**
 * Compute generation numbers for all nodes (distance from root)
 * Root nodes are generation 0, their children are generation 1, etc.
 * Returns a map of node ID to generation number
 */
export function computeGenerations(nodes: FamilyNode[]): Map<string, number> {
  const generations = new Map<string, number>();
  const nodeMap = buildNodeMap(nodes);
  const childrenMap = buildChildrenMap(nodes);

  // Find roots and set their generation to 0
  const roots = findRootNodes(nodes);
  for (const root of roots) {
    generations.set(root.id, 0);
  }

  // BFS from roots to compute generations
  const queue = [...roots];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentGen = generations.get(current.id) ?? 0;

    const childIds = childrenMap.get(current.id) || [];
    for (const childId of childIds) {
      // If child already has a generation, keep the minimum (handles multiple parents)
      const existingGen = generations.get(childId);
      const newGen = currentGen + 1;

      if (existingGen === undefined || newGen < existingGen) {
        generations.set(childId, newGen);
        queue.push(nodeMap.get(childId)!);
      }
    }
  }

  // Handle nodes not connected to any root (shouldn't happen in valid data)
  for (const node of nodes) {
    if (!generations.has(node.id)) {
      generations.set(node.id, -1); // Mark as unconnected
    }
  }

  return generations;
}

/**
 * Run all validations and return combined errors
 */
export function validateFamilyTree(nodes: FamilyNode[]): string[] {
  return [
    ...validateParentRefsExist(nodes),
    ...validateNoCircularRefs(nodes),
    ...validateBidirectionalPartners(nodes),
  ];
}
