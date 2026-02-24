import { FamilyNode, FamilyTreeData } from "@/types/family";

export type RecommendationPriority = "high" | "medium" | "low";

export interface TagRecommendation {
  person: FamilyNode;
  priority: RecommendationPriority;
  relationship: string; // e.g., "Spouse", "Father", "Son"
}

/**
 * Get parent ID from either string or ParentLink object
 */
function getParentId(ref: string | { id: string }): string {
  return typeof ref === "string" ? ref : ref.id;
}

/**
 * Get partner ID from either string or PartnerLink object
 */
function getPartnerId(ref: string | { id: string }): string {
  return typeof ref === "string" ? ref : ref.id;
}

/**
 * Get recommended people to tag in a photo based on the currently tagged person
 *
 * Priority levels:
 * - High: Spouses, children, parents
 * - Medium: Siblings, grandparents, grandchildren, in-laws
 * - Low: Cousins, aunts/uncles, other relatives
 */
export function getTagRecommendations(
  currentNodeId: string,
  allNodes: FamilyTreeData,
  alreadyTaggedIds: string[]
): TagRecommendation[] {
  const recommendations: TagRecommendation[] = [];
  const seenIds = new Set([currentNodeId, ...alreadyTaggedIds]);

  const nodeMap = new Map<string, FamilyNode>();
  allNodes.forEach(node => nodeMap.set(node.id, node));

  const currentNode = nodeMap.get(currentNodeId);
  if (!currentNode) return recommendations;

  // Helper to add recommendation if not already added
  const addRecommendation = (
    person: FamilyNode,
    priority: RecommendationPriority,
    relationship: string
  ) => {
    if (!seenIds.has(person.id)) {
      seenIds.add(person.id);
      recommendations.push({ person, priority, relationship });
    }
  };

  // HIGH PRIORITY: Spouses
  const spouseIds = (currentNode.partner_ids || []).map(getPartnerId);
  for (const spouseId of spouseIds) {
    const spouse = nodeMap.get(spouseId);
    if (spouse) {
      addRecommendation(spouse, "high", "Spouse");
    }
  }

  // HIGH PRIORITY: Parents
  const parentIds = (currentNode.parent_ids || []).map(getParentId);
  for (const parentId of parentIds) {
    const parent = nodeMap.get(parentId);
    if (parent) {
      const relationship = parent.gender === "male" ? "Father" :
                          parent.gender === "female" ? "Mother" : "Parent";
      addRecommendation(parent, "high", relationship);
    }
  }

  // HIGH PRIORITY: Children
  const children = allNodes.filter(n =>
    n.parent_ids?.some(ref => getParentId(ref) === currentNodeId)
  );
  for (const child of children) {
    const relationship = child.gender === "male" ? "Son" :
                        child.gender === "female" ? "Daughter" : "Child";
    addRecommendation(child, "high", relationship);
  }

  // MEDIUM PRIORITY: Siblings (share at least one parent)
  const siblings = allNodes.filter(n => {
    if (n.id === currentNodeId) return false;
    const nParentIds = (n.parent_ids || []).map(getParentId);
    return parentIds.some(pid => nParentIds.includes(pid));
  });
  for (const sibling of siblings) {
    const relationship = sibling.gender === "male" ? "Brother" :
                        sibling.gender === "female" ? "Sister" : "Sibling";
    addRecommendation(sibling, "medium", relationship);
  }

  // MEDIUM PRIORITY: Grandparents
  for (const parentId of parentIds) {
    const parent = nodeMap.get(parentId);
    if (parent) {
      const grandparentIds = (parent.parent_ids || []).map(getParentId);
      for (const gpId of grandparentIds) {
        const grandparent = nodeMap.get(gpId);
        if (grandparent) {
          const relationship = grandparent.gender === "male" ? "Grandfather" :
                              grandparent.gender === "female" ? "Grandmother" : "Grandparent";
          addRecommendation(grandparent, "medium", relationship);
        }
      }
    }
  }

  // MEDIUM PRIORITY: Grandchildren
  for (const child of children) {
    const grandchildren = allNodes.filter(n =>
      n.parent_ids?.some(ref => getParentId(ref) === child.id)
    );
    for (const gc of grandchildren) {
      const relationship = gc.gender === "male" ? "Grandson" :
                          gc.gender === "female" ? "Granddaughter" : "Grandchild";
      addRecommendation(gc, "medium", relationship);
    }
  }

  // MEDIUM PRIORITY: In-laws (spouse's parents and siblings)
  for (const spouseId of spouseIds) {
    const spouse = nodeMap.get(spouseId);
    if (spouse) {
      // Spouse's parents
      const spouseParentIds = (spouse.parent_ids || []).map(getParentId);
      for (const spId of spouseParentIds) {
        const inLaw = nodeMap.get(spId);
        if (inLaw) {
          const relationship = inLaw.gender === "male" ? "Father-in-law" :
                              inLaw.gender === "female" ? "Mother-in-law" : "Parent-in-law";
          addRecommendation(inLaw, "medium", relationship);
        }
      }

      // Spouse's siblings
      const spouseSiblings = allNodes.filter(n => {
        if (n.id === spouseId) return false;
        const nParentIds = (n.parent_ids || []).map(getParentId);
        return spouseParentIds.some(pid => nParentIds.includes(pid));
      });
      for (const sib of spouseSiblings) {
        const relationship = sib.gender === "male" ? "Brother-in-law" :
                            sib.gender === "female" ? "Sister-in-law" : "Sibling-in-law";
        addRecommendation(sib, "medium", relationship);
      }
    }
  }

  // LOW PRIORITY: Aunts/Uncles (parent's siblings)
  for (const parentId of parentIds) {
    const parent = nodeMap.get(parentId);
    if (parent) {
      const parentParentIds = (parent.parent_ids || []).map(getParentId);
      const auntsUncles = allNodes.filter(n => {
        if (n.id === parentId) return false;
        const nParentIds = (n.parent_ids || []).map(getParentId);
        return parentParentIds.some(pid => nParentIds.includes(pid));
      });
      for (const au of auntsUncles) {
        const relationship = au.gender === "male" ? "Uncle" :
                            au.gender === "female" ? "Aunt" : "Aunt/Uncle";
        addRecommendation(au, "low", relationship);
      }
    }
  }

  // LOW PRIORITY: Cousins (aunt/uncle's children)
  for (const parentId of parentIds) {
    const parent = nodeMap.get(parentId);
    if (parent) {
      const parentParentIds = (parent.parent_ids || []).map(getParentId);
      const auntsUncles = allNodes.filter(n => {
        if (n.id === parentId) return false;
        const nParentIds = (n.parent_ids || []).map(getParentId);
        return parentParentIds.some(pid => nParentIds.includes(pid));
      });
      for (const au of auntsUncles) {
        const cousins = allNodes.filter(n =>
          n.parent_ids?.some(ref => getParentId(ref) === au.id)
        );
        for (const cousin of cousins) {
          addRecommendation(cousin, "low", "Cousin");
        }
      }
    }
  }

  // Sort by priority (high first, then medium, then low)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

/**
 * Get all people not yet tagged, sorted by name
 */
export function getUntaggedPeople(
  allNodes: FamilyTreeData,
  alreadyTaggedIds: string[]
): FamilyNode[] {
  const taggedSet = new Set(alreadyTaggedIds);
  return allNodes
    .filter(n => !taggedSet.has(n.id) && !n.id.includes("_placeholder"))
    .sort((a, b) => {
      const aName = a.names.primary_zh || a.names.pinyin;
      const bName = b.names.primary_zh || b.names.pinyin;
      return aName.localeCompare(bName);
    });
}
