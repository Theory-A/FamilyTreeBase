"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { FamilyTreeData, FamilyNode, PartnerLink } from "@/types/family";
import { useI18n } from "@/lib/i18n";
import { usePersonSelection } from "@/lib/PersonSelectionContext";
import NodeDetailPanel from "./NodeDetailPanel";
import Minimap from "./Minimap";
import { AvatarDisplay } from "./images";

interface FamilyTreeProps {
  nodes: FamilyTreeData;
  onUpdateNode?: (params: {
    node: FamilyNode;
    childrenToLink?: string[];
    childrenToUnlink?: string[];
  }) => { success: boolean; error?: string };
  onDeleteNode?: (nodeId: string) => Promise<{ success: boolean; error?: string }>;
  onEditRelationships?: (person: FamilyNode) => void;
  onAddChild?: (parent: FamilyNode) => void;
  onAddSpouse?: (partner: FamilyNode) => void;
  onRefresh?: () => Promise<void>;
  // Favorites
  favorites?: Set<string>;
  onToggleFavorite?: (nodeId: string) => void;
  // Navigation
  scrollToNodeId?: string | null;
  onScrollComplete?: () => void;
  // Image counts per node
  imageCounts?: Record<string, number>;
  // Culling - hide specific node and its descendants
  culledNodeId?: string;
}

interface SpouseGroup {
  spouse: FamilyNode;
  partnerLink: PartnerLink;  // Partnership info (married/divorced/etc)
  children: TreePerson[];  // Children of this specific spouse
}

interface TreePerson {
  person: FamilyNode;
  spouseGroups: SpouseGroup[];  // Each spouse with their children
  unattributedChildren: TreePerson[];  // Children with unknown/unlinked mother
}

interface FlatRow {
  depth: number;
  person: FamilyNode;
  spouse?: FamilyNode;  // For spouse rows, their partner; for main person, undefined
  isSpouse: boolean;
  isShellEntry?: boolean;  // True for shell entries in birth family
  shellAncestorId?: string;  // ID of the shell entry ancestor (for rows under a shell subtree)
  spouseIndex?: number;  // 0 for first wife, 1 for second, etc.
  partnerLink?: PartnerLink;  // Partnership info (married/divorced/etc)
  hasChildren: boolean;
  // For subtree collapse/expand
  familyHeadId: string;     // ID of the main person (family head) this row belongs to
  ancestorHeadIds: string[]; // Chain of ancestor family head IDs (for collapse checking)
  isLastOfFamily?: boolean;  // True if this is the last row of a family unit
  subtreeSize?: number;      // Number of descendants (only set when isLastOfFamily)
  // For multi-appearance nodes (appear in multiple places in the tree)
  multiAppearanceNav?: {
    nextRowKey: string;  // The row key to navigate to (cycles through all appearances)
    appearanceIndex: number;  // 1-based index of this appearance
    totalAppearances: number;  // Total number of appearances
  };
  // For tree separation
  treeIndex?: number;  // Index of the main tree this row belongs to
}

function getParentId(ref: string | { id: string }): string {
  return typeof ref === "string" ? ref : ref.id;
}

function getRowKey(row: { person: { id: string }; isSpouse?: boolean; isShellEntry?: boolean; shellAncestorId?: string }): string {
  const shellSuffix = row.isShellEntry ? "_shell" : (row.shellAncestorId ? `_under_${row.shellAncestorId}` : "");
  return row.person.id + (row.isSpouse ? "_spouse" : "") + shellSuffix;
}

function toPartnerLink(ref: string | PartnerLink): PartnerLink {
  return typeof ref === "string" ? { id: ref } : ref;
}

// Age threshold above which someone with unknown death date is presumed deceased
const PRESUMED_DEAD_AGE = 100;

function calculateAge(birthDateStr?: string, deathDateStr?: string): number | null {
  if (!birthDateStr) return null;

  // Parse year (handles both YYYY and YYYY-MM-DD formats)
  const birthYear = parseInt(birthDateStr.substring(0, 4), 10);
  if (isNaN(birthYear)) return null;

  const birthMonth = birthDateStr.length >= 7 ? parseInt(birthDateStr.substring(5, 7), 10) - 1 : 0;
  const birthDay = birthDateStr.length >= 10 ? parseInt(birthDateStr.substring(8, 10), 10) : 1;

  let endDate: Date;
  if (deathDateStr) {
    const deathYear = parseInt(deathDateStr.substring(0, 4), 10);
    const deathMonth = deathDateStr.length >= 7 ? parseInt(deathDateStr.substring(5, 7), 10) - 1 : 11;
    const deathDay = deathDateStr.length >= 10 ? parseInt(deathDateStr.substring(8, 10), 10) : 31;
    endDate = new Date(deathYear, deathMonth, deathDay);
  } else {
    endDate = new Date();
  }

  const birthDate = new Date(birthYear, birthMonth, birthDay);

  let age = endDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = endDate.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}

// Determines if person should be considered living (has birth date, no death date, and age <= 100)
function isPersonLiving(birthDateStr?: string, deathDateStr?: string): boolean {
  if (!birthDateStr || deathDateStr) return false;
  const age = calculateAge(birthDateStr);
  return age !== null && age <= PRESUMED_DEAD_AGE;
}

// Determines if person should be considered deceased (has death date, or born > 100 years ago)
function isPersonDeceased(birthDateStr?: string, deathDateStr?: string): boolean {
  if (deathDateStr) return true;
  if (!birthDateStr) return false;
  return !isPersonLiving(birthDateStr, deathDateStr);
}

export default function FamilyTree({ nodes, onUpdateNode, onDeleteNode, onEditRelationships, onAddChild, onAddSpouse, onRefresh, favorites, onToggleFavorite, scrollToNodeId, onScrollComplete, imageCounts, culledNodeId }: FamilyTreeProps) {
  const { t } = useI18n();
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsedSubtrees, setCollapsedSubtrees] = useState<Set<string>>(new Set());
  const { activeSelector, onPersonSelected } = usePersonSelection();

  // Refs for scrolling to nodes
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Ref for tracking scroll timeouts to clean up on unmount
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drag-to-scroll state
  const dragState = useRef({
    isMouseDown: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left-click
    if (e.button !== 0) return;
    // Don't drag on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, [role='button'], .detail-panel")) {
      return;
    }
    if (!containerRef.current) return;

    dragState.current = {
      isMouseDown: true,
      isDragging: false,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.isMouseDown || !containerRef.current) return;

    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;

    // Only start dragging after moving at least 5 pixels (prevents accidental drag on click)
    if (!dragState.current.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      dragState.current.isDragging = true;
      containerRef.current.style.cursor = "grabbing";
      containerRef.current.style.userSelect = "none";
    }

    if (dragState.current.isDragging) {
      containerRef.current.scrollLeft = dragState.current.scrollLeft - dx;
      containerRef.current.scrollTop = dragState.current.scrollTop - dy;
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragState.current.isMouseDown = false;
    dragState.current.isDragging = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = "";
      containerRef.current.style.userSelect = "";
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    dragState.current.isMouseDown = false;
    dragState.current.isDragging = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = "";
      containerRef.current.style.userSelect = "";
    }
  }, []);

  // Build tree and flatten to rows (separate row for each person)
  const { rows, maxDepth, floatingNodes, nodeMap } = useMemo(() => {
    // Build nodeMap inside useMemo to avoid dependency issues
    const nodeMap = new Map<string, FamilyNode>();
    nodes.forEach((node) => nodeMap.set(node.id, node));
    // Compute set of nodes to cull (culled node + all descendants, NOT spouse)
    const culledIds = new Set<string>();
    if (culledNodeId) {
      // Helper to recursively find all descendants
      const findDescendants = (nodeId: string) => {
        culledIds.add(nodeId);
        // Find children (but don't cull spouse)
        for (const node of nodes) {
          if (node.parent_ids?.some(ref => getParentId(ref) === nodeId)) {
            if (!culledIds.has(node.id)) {
              findDescendants(node.id);
            }
          }
        }
      };
      findDescendants(culledNodeId);
    }

    // Filter nodes to exclude culled ones
    const filteredNodes = culledNodeId
      ? nodes.filter(node => !culledIds.has(node.id))
      : nodes;

    const hasChildren = new Set<string>();
    filteredNodes.forEach((node) => {
      node.parent_ids?.forEach((ref) => hasChildren.add(getParentId(ref)));
    });

    // Pre-compute dual-appearance nodes: people who have parents AND a partner
    // These will appear in both their birth family tree (as child) and their spouse's tree
    const dualAppearanceNodes = new Set<string>();
    for (const node of filteredNodes) {
      if (
        node.parent_ids?.length &&
        node.partner_ids?.some((ref) => {
          const partner = nodeMap.get(getParentId(ref));
          return partner != null;
        })
      ) {
        dualAppearanceNodes.add(node.id);
      }
    }

    const rootNodes = filteredNodes.filter((node) => {
      if (node.parent_ids?.length) return false;
      if (hasChildren.has(node.id)) return true;
      if (node.partner_ids?.some((ref) => hasChildren.has(getParentId(ref)))) return false;
      return false;
    });

    const visited = new Set<string>();
    const shellEntriesCreated = new Set<string>();  // Track which dual-appearance nodes already have shell entries
    const builtTrees = new Map<string, TreePerson>();  // Store built trees for subtree copying
    const shellEntryTrees = new WeakSet<TreePerson>();  // Track shell entry TreePerson objects by reference

    const buildTree = (node: FamilyNode): TreePerson | null => {
      if (visited.has(node.id)) return null;

      // If this person is female and has an unvisited male partner,
      // redirect to build tree with male as the family head instead
      if (node.gender === "female") {
        for (const ref of node.partner_ids || []) {
          const partner = nodeMap.get(getParentId(ref));
          if (partner && partner.gender === "male" && !visited.has(partner.id)) {
            // Build tree with male partner as the head
            // The female will be added as a spouse when processing the male
            return buildTree(partner);
          }
        }
      }

      visited.add(node.id);

      // Collect all spouses (not just the first one) with their partner links
      const spousesWithLinks: { spouse: FamilyNode; link: PartnerLink }[] = [];
      for (const ref of node.partner_ids || []) {
        const link = toPartnerLink(ref);
        const partner = nodeMap.get(link.id);
        // Skip culled spouses
        if (partner && !visited.has(partner.id) && !culledIds.has(partner.id)) {
          spousesWithLinks.push({ spouse: partner, link });
          visited.add(partner.id);
        }
      }
      const spouses = spousesWithLinks.map(s => s.spouse);

      // Build a set of spouse IDs for child-linking
      const spouseIds = new Set(spouses.map(s => s.id));

      // Find all children of this family unit
      const childNodes = filteredNodes
        .filter((n) => {
          if (!n.parent_ids) return false;
          return n.parent_ids.some((ref) => {
            const pid = getParentId(ref);
            return pid === node.id || spouseIds.has(pid);
          });
        })
        .sort((a, b) => {
          // Males first, then by birth date (unknown first, then eldest)
          const aIsMale = a.gender === "male" ? 0 : 1;
          const bIsMale = b.gender === "male" ? 0 : 1;
          if (aIsMale !== bIsMale) return aIsMale - bIsMale;
          const ad = a.vital_stats?.birth?.date_iso || "";
          const bd = b.vital_stats?.birth?.date_iso || "";
          // Unknown birth dates go first
          if (!ad && bd) return -1;
          if (ad && !bd) return 1;
          return ad.localeCompare(bd);
        });

      // Group children by their mother (spouse)
      const spouseGroups: SpouseGroup[] = spousesWithLinks.map(({ spouse, link }) => ({
        spouse,
        partnerLink: link,
        children: [] as TreePerson[],
      }));

      const unattributedChildren: TreePerson[] = [];

      for (const child of childNodes) {
        if (visited.has(child.id)) {
          // For dual-appearance nodes already visited, create a shell entry
          // BUT skip if they're a spouse of a sibling (they'll already appear in this family as a spouse)
          if (dualAppearanceNodes.has(child.id) && !shellEntriesCreated.has(child.id)) {
            // Check if this child is a spouse of any sibling in this family
            const isSpouseOfSibling = childNodes.some(sibling => {
              if (sibling.id === child.id) return false;
              return sibling.partner_ids?.some(ref => getParentId(ref) === child.id);
            });

            if (!isSpouseOfSibling) {
              shellEntriesCreated.add(child.id);

              // Copy the full subtree from the already-built tree
              let originalTree = builtTrees.get(child.id);

              // For females who appear as spouses in their partner's tree,
              // construct their tree by inverting from the partner's tree
              if (!originalTree && child.gender === "female") {
                const shellSpouseGroups: SpouseGroup[] = [];
                for (const partnerRef of child.partner_ids || []) {
                  const partnerId = getParentId(partnerRef);
                  const partnerTree = builtTrees.get(partnerId);
                  if (partnerTree) {
                    // Find the spouseGroup where this female is the spouse
                    const groupWithChild = partnerTree.spouseGroups.find(g => g.spouse.id === child.id);
                    if (groupWithChild) {
                      // Create inverse: partner becomes spouse, children stay the same
                      const partner = nodeMap.get(partnerId);
                      if (partner) {
                        shellSpouseGroups.push({
                          spouse: partner,
                          partnerLink: toPartnerLink(partnerRef),
                          children: groupWithChild.children,
                        });
                      }
                    }
                  }
                }
                if (shellSpouseGroups.length > 0) {
                  originalTree = {
                    person: child,
                    spouseGroups: shellSpouseGroups,
                    unattributedChildren: [],
                  };
                }
              }

              const shellEntry: TreePerson = {
                person: child,
                spouseGroups: originalTree?.spouseGroups || [],
                unattributedChildren: originalTree?.unattributedChildren || [],
              };
              shellEntryTrees.add(shellEntry);  // Mark this as a shell entry

              const childParentIds = (child.parent_ids || []).map(getParentId);
              const motherSpouse = spouses.find(s => childParentIds.includes(s.id));

              if (motherSpouse) {
                const group = spouseGroups.find(g => g.spouse.id === motherSpouse.id);
                if (group) {
                  group.children.push(shellEntry);
                }
              } else {
                unattributedChildren.push(shellEntry);
              }
            }
          }
          continue;
        }

        const childTree = buildTree(child);
        if (!childTree) continue;

        // Find which spouse is the mother of this child
        const childParentIds = (child.parent_ids || []).map(getParentId);
        const motherSpouse = spouses.find(s => childParentIds.includes(s.id));

        if (motherSpouse) {
          // Add to the specific spouse's group
          const group = spouseGroups.find(g => g.spouse.id === motherSpouse.id);
          if (group) {
            group.children.push(childTree);
          }
        } else {
          // Child only has main person as parent, unknown mother
          unattributedChildren.push(childTree);
        }
      }

      const result = { person: node, spouseGroups, unattributedChildren };
      builtTrees.set(node.id, result);  // Store for potential shell entry copying
      return result;
    };

    rootNodes.sort((a, b) => {
      const ad = a.vital_stats?.birth?.date_iso || "";
      const bd = b.vital_stats?.birth?.date_iso || "";
      return ad.localeCompare(bd);
    });

    const trees: TreePerson[] = [];
    for (const root of rootNodes) {
      const t = buildTree(root);
      if (t) trees.push(t);
    }

    // Flatten tree to rows - each person gets their own row
    const flatRows: FlatRow[] = [];
    let maxD = 0;

    // First pass: compute subtree sizes
    const computeSubtreeSize = (tree: TreePerson): number => {
      let size = 1; // This person
      for (const group of tree.spouseGroups) {
        size += 1; // Spouse
        for (const child of group.children) {
          size += computeSubtreeSize(child);
        }
      }
      for (const child of tree.unattributedChildren) {
        size += computeSubtreeSize(child);
      }
      return size;
    };

    // Store subtree sizes keyed by person ID
    const subtreeSizes = new Map<string, number>();
    const computeAllSubtreeSizes = (tree: TreePerson) => {
      // Count only descendants (not the person+spouses themselves)
      let descendantCount = 0;
      for (const group of tree.spouseGroups) {
        for (const child of group.children) {
          descendantCount += computeSubtreeSize(child);
        }
      }
      for (const child of tree.unattributedChildren) {
        descendantCount += computeSubtreeSize(child);
      }
      subtreeSizes.set(tree.person.id, descendantCount);

      // Recurse
      for (const group of tree.spouseGroups) {
        for (const child of group.children) {
          computeAllSubtreeSizes(child);
        }
      }
      for (const child of tree.unattributedChildren) {
        computeAllSubtreeSizes(child);
      }
    };

    const flatten = (tree: TreePerson, depth: number, ancestorHeadIds: string[], treeIndex: number, shellAncestorId?: string) => {
      maxD = Math.max(maxD, depth);

      const totalChildren = tree.spouseGroups.reduce((sum, g) => sum + g.children.length, 0)
        + tree.unattributedChildren.length;
      const hasChildren = totalChildren > 0;
      const familyHeadId = tree.person.id;
      const newAncestorChain = [...ancestorHeadIds, familyHeadId];

      // Check if this is a shell entry (dual-appearance node in birth family)
      const isShellEntry = shellEntryTrees.has(tree);
      // If this is a shell entry, set the shellAncestorId for descendants
      const currentShellAncestorId = isShellEntry ? tree.person.id : shellAncestorId;

      // Main person row
      const mainRow: FlatRow = {
        depth,
        person: tree.person,
        spouse: undefined,
        isSpouse: false,
        isShellEntry,
        shellAncestorId,  // Set for rows that are under a shell entry (not the shell entry itself)
        hasChildren,
        familyHeadId,
        ancestorHeadIds,
        treeIndex,
      };

      flatRows.push(mainRow);

      // Each spouse row followed by their children
      for (let i = 0; i < tree.spouseGroups.length; i++) {
        const group = tree.spouseGroups[i];
        const isLastSpouse = i === tree.spouseGroups.length - 1;

        const spouseRow: FlatRow = {
          depth,
          person: group.spouse,
          spouse: tree.person,
          isSpouse: true,
          shellAncestorId: currentShellAncestorId,
          spouseIndex: i,
          partnerLink: group.partnerLink,
          hasChildren: group.children.length > 0,
          familyHeadId,
          ancestorHeadIds,
          // Last spouse gets the collapse button if family has any children
          isLastOfFamily: isLastSpouse && hasChildren,
          subtreeSize: isLastSpouse && hasChildren ? subtreeSizes.get(familyHeadId) : undefined,
          treeIndex,
        };

        flatRows.push(spouseRow);

        // Flatten this spouse's children immediately after
        for (const child of group.children) {
          flatten(child, depth + 1, newAncestorChain, treeIndex, currentShellAncestorId);
        }
      }

      // Handle unattributed children (unknown mother)
      if (tree.unattributedChildren.length > 0) {
        // Only show placeholder if no spouses exist and main person is male
        if (tree.spouseGroups.length === 0 && tree.person.gender === "male") {
          flatRows.push({
            depth,
            person: {
              id: `${tree.person.id}_spouse_placeholder`,
              names: { primary_zh: "氏", pinyin: "" },
              gender: "female" as const,
            },
            spouse: tree.person,
            isSpouse: true,
            shellAncestorId: currentShellAncestorId,
            hasChildren: false,
            familyHeadId,
            ancestorHeadIds,
            isLastOfFamily: hasChildren,
            subtreeSize: hasChildren ? subtreeSizes.get(familyHeadId) : undefined,
            treeIndex,
          });
        }

        for (const child of tree.unattributedChildren) {
          flatten(child, depth + 1, newAncestorChain, treeIndex, currentShellAncestorId);
        }
      }

      // Special case: children exist but no spouses (female with children, or male without placeholder)
      if (hasChildren && tree.spouseGroups.length === 0 && !(tree.person.gender === "male" && tree.unattributedChildren.length > 0)) {
        // Find the main person row we just added and mark it
        const mainRowIdx = flatRows.findIndex(r => r.person.id === tree.person.id && !r.isSpouse);
        if (mainRowIdx >= 0) {
          flatRows[mainRowIdx].isLastOfFamily = true;
          flatRows[mainRowIdx].subtreeSize = subtreeSizes.get(familyHeadId);
        }
      }
    };

    // Compute all subtree sizes first
    trees.forEach((tree) => {
      computeAllSubtreeSizes(tree);
    });

    trees.forEach((tree, treeIdx) => {
      flatten(tree, 0, [], treeIdx);
    });

    // Find floating nodes (nodes not visited during tree building)
    const floating = filteredNodes.filter((node) => !visited.has(node.id));

    // Post-process: add multi-appearance navigation for people who appear multiple times
    // Build a map of person ID -> all row indices where they appear
    const personAppearances = new Map<string, number[]>();
    for (let i = 0; i < flatRows.length; i++) {
      const row = flatRows[i];
      // Skip placeholder rows
      if (row.person.id.includes("_placeholder")) continue;

      const personId = row.person.id;
      if (!personAppearances.has(personId)) {
        personAppearances.set(personId, []);
      }
      personAppearances.get(personId)!.push(i);
    }

    // For each person with multiple appearances, add cycling navigation
    for (const [, indices] of personAppearances) {
      if (indices.length <= 1) continue;

      for (let i = 0; i < indices.length; i++) {
        const rowIndex = indices[i];
        const nextIndex = indices[(i + 1) % indices.length];
        const nextRow = flatRows[nextIndex];

        flatRows[rowIndex].multiAppearanceNav = {
          nextRowKey: getRowKey(nextRow),
          appearanceIndex: i + 1,
          totalAppearances: indices.length,
        };
      }
    }

    return { rows: flatRows, maxDepth: maxD, floatingNodes: floating, nodeMap };
  }, [nodes, culledNodeId]);

  const handleToggle = (rowKey: string, personId: string) => {
    // If there's an active selector, add this person to it instead of toggling
    if (activeSelector && onPersonSelected) {
      onPersonSelected(personId);
      return;
    }

    if (expandedRowKey === rowKey) {
      // Collapse the currently open row
      setExpandedRowKey(null);
      if (editingId === personId) {
        setEditingId(null);
      }
    } else {
      // Close any open row and open this one
      if (editingId && editingId !== personId) {
        setEditingId(null);
      }
      setExpandedRowKey(rowKey);
    }
  };

  const handleToggleSubtree = (familyHeadId: string) => {
    setCollapsedSubtrees(prev => {
      const next = new Set(prev);
      if (next.has(familyHeadId)) {
        next.delete(familyHeadId);
      } else {
        next.add(familyHeadId);
      }
      return next;
    });
  };

  // Navigate to another appearance of a multi-appearance person
  const handleNavigateToAppearance = useCallback((targetRowKey: string, colWidth: number) => {
    const SIDEBAR = 200;

    const targetRow = rows.find(r => getRowKey(r) === targetRowKey);

    if (targetRow) {
      // Expand collapsed ancestor if needed
      const collapsedAncestor = targetRow.ancestorHeadIds.find(id => collapsedSubtrees.has(id));
      if (collapsedAncestor) {
        setCollapsedSubtrees(prev => {
          const next = new Set(prev);
          next.delete(collapsedAncestor);
          return next;
        });
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => scrollToRow(targetRowKey, targetRow, colWidth), 100);
        return;
      }
      scrollToRow(targetRowKey, targetRow, colWidth);
    }

    function scrollToRow(rowKey: string, row: FlatRow, cw: number) {
      const rowElement = rowRefs.current.get(rowKey);
      if (rowElement && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const rowRect = rowElement.getBoundingClientRect();
        const sidebarWidth = floatingNodes.length > 0 ? SIDEBAR : 0;
        const cardLeft = sidebarWidth + 32 + row.depth * cw;
        containerRef.current.scrollTo({
          top: rowElement.offsetTop - containerRect.height / 2 + rowRect.height / 2,
          left: Math.max(0, cardLeft - containerRect.width / 4),
          behavior: "smooth",
        });
      }
    }
  }, [rows, collapsedSubtrees, floatingNodes.length]);

  const handleEditStart = (id: string) => {
    setEditingId(id);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const handleSave = (params: {
    node: FamilyNode;
    childrenToLink?: string[];
    childrenToUnlink?: string[];
  }) => {
    if (!onUpdateNode) {
      return { success: false, error: "Updates not supported" };
    }
    const result = onUpdateNode(params);
    if (result.success) {
      setEditingId(null);
    }
    return result;
  };

  // Calculate column width dynamically based on content
  const COL_WIDTH = useMemo(() => {
    const BASE_PADDING = 60; // Increased for larger cards

    let maxWidth = 200; // minimum (increased from 160)

    for (const node of nodes) {
      // Estimate name width (text-base = 16px, Chinese chars ~16px wide)
      const zhName = node.names.primary_zh || "";
      const nameWidth = zhName.length * 16;

      // Date line is text-xs (12px), so chars are slightly larger (~7px Latin, ~12px Chinese)
      const birthDate = node.vital_stats?.birth?.date_iso || "";
      const deathDate = node.vital_stats?.death?.date_iso || "";
      let dateWidth = birthDate.length * 7;
      if (deathDate) {
        dateWidth += 21 + deathDate.length * 7; // " - " + death date
      }
      if (birthDate) {
        dateWidth += deathDate ? 72 : 48; // age text: "(享年XX岁)" or "(XX岁)"
      }

      const totalWidth = Math.max(nameWidth, dateWidth) + BASE_PADDING;
      maxWidth = Math.max(maxWidth, totalWidth);
    }

    return Math.ceil(maxWidth / 10) * 10;
  }, [nodes]);
  const SIDEBAR_WIDTH = 200;
  const showSidebar = floatingNodes.length > 0;

  // Calculate minimum width needed for the tree content
  const treeMinWidth = useMemo(() => {
    return (maxDepth + 1) * COL_WIDTH + 100; // Extra padding for notes
  }, [maxDepth, COL_WIDTH]);

  // Total width needed for the entire layout (extra padding on right for detail panels)
  const totalContentWidth = (showSidebar ? SIDEBAR_WIDTH : 0) + treeMinWidth + 1000;

  // Prepare minimap data - only visible rows (accounting for collapsed subtrees)
  const minimapRows = useMemo(() => {
    return rows
      .filter((row) => !row.ancestorHeadIds.some((id) => collapsedSubtrees.has(id)))
      .map((row) => ({
        id: getRowKey(row),
        depth: row.depth,
        isMale: row.person.gender === "male",
        isFemale: row.person.gender === "female",
        isSpouse: row.isSpouse,
        isPlaceholder: row.person.id.includes("_placeholder"),
        treeIndex: row.treeIndex,
      }));
  }, [rows, collapsedSubtrees]);

  // Handle navigation from minimap
  const handleMinimapNavigate = useCallback((scrollTop: number, scrollLeft: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: scrollTop,
        left: scrollLeft,
        behavior: "smooth",
      });
    }
  }, []);

  // Scroll to node when scrollToNodeId changes
  useEffect(() => {
    if (!scrollToNodeId || !containerRef.current) return;

    // Find the row - prefer spouse view (where they appear as someone's partner)
    const targetRow = rows.find(r => r.person.id === scrollToNodeId && r.isSpouse)
      || rows.find(r => r.person.id === scrollToNodeId && !r.isSpouse);

    if (targetRow) {
      // Check if any ancestor is collapsed
      const collapsedAncestor = targetRow.ancestorHeadIds.find(id => collapsedSubtrees.has(id));
      if (collapsedAncestor) {
        // Expand the collapsed ancestor
        setCollapsedSubtrees(prev => {
          const next = new Set(prev);
          next.delete(collapsedAncestor);
          return next;
        });
        // Wait for DOM to update before scrolling
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          scrollToNode(scrollToNodeId);
        }, 100);
        return;
      }
    }

    scrollToNode(scrollToNodeId);

    function scrollToNode(nodeId: string) {
      // Find the row - prefer spouse view (where they appear as someone's partner), skip shell entries
      const targetRow = rows.find(r => r.person.id === nodeId && r.isSpouse && !r.isShellEntry)
        || rows.find(r => r.person.id === nodeId && !r.isSpouse && !r.isShellEntry)
        || rows.find(r => r.person.id === nodeId);

      // Get the element ref using the row key
      const refKey = targetRow ? getRowKey(targetRow) : nodeId;
      const rowElement = rowRefs.current.get(refKey);

      if (rowElement && containerRef.current && targetRow) {
        // Calculate position to center the node in view
        const containerRect = containerRef.current.getBoundingClientRect();
        const rowRect = rowElement.getBoundingClientRect();

        // Vertical: center the row
        const scrollTop = rowElement.offsetTop - containerRect.height / 2 + rowRect.height / 2;

        // Horizontal: calculate based on depth (32px base + depth * COL_WIDTH is where the card starts)
        // Account for sidebar if present
        const sidebarWidth = floatingNodes.length > 0 ? SIDEBAR_WIDTH : 0;
        const cardLeft = sidebarWidth + 32 + targetRow.depth * COL_WIDTH;
        const scrollLeft = cardLeft - containerRect.width / 4;

        containerRef.current.scrollTo({
          top: Math.max(0, scrollTop),
          left: Math.max(0, scrollLeft),
          behavior: "smooth",
        });

        // Expand the detail panel for this specific row
        setExpandedRowKey(refKey);

        // Clear the scroll target
        onScrollComplete?.();
      }
    }
  }, [scrollToNodeId, rows, collapsedSubtrees, onScrollComplete, floatingNodes.length, SIDEBAR_WIDTH, COL_WIDTH]);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto bg-amber-50/30"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Minimap - hidden on mobile */}
      <div className="hidden sm:block">
        <Minimap
          rows={minimapRows}
          maxDepth={maxDepth}
          containerRef={containerRef}
          colWidth={COL_WIDTH}
          onNavigate={handleMinimapNavigate}
        />
      </div>
      {/* Inner container with explicit width to force horizontal scroll */}
      <div style={{ width: Math.max(totalContentWidth, 100), minWidth: "100%", marginTop: '8px' }}>
        <div className="flex">
          {/* Floating nodes sidebar - only shown when there are unconnected nodes */}
          {showSidebar && (
            <div
              className="flex-shrink-0 border-r border-gray-200 bg-gray-50/50 p-4"
              style={{ width: SIDEBAR_WIDTH }}
            >
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                {t("unconnectedPeople")}
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                {t("unconnectedDescription")}
              </p>

              <div className="space-y-2">
                {floatingNodes.map((node) => {
                  const isMale = node.gender === "male";
                  const isFemale = node.gender === "female";
                  const borderColor = isMale
                    ? "border-blue-400"
                    : isFemale
                    ? "border-pink-400"
                    : "border-gray-400";
                  const bgColor = isMale
                    ? "bg-gradient-to-r from-blue-100 to-blue-50"
                    : isFemale
                    ? "bg-gradient-to-r from-pink-100 to-pink-50"
                    : "bg-gradient-to-r from-gray-100 to-gray-50";

                  return (
                    <div
                      key={node.id}
                      className={`
                        w-full px-2 py-1.5 rounded border-2 ${borderColor} ${bgColor}
                        shadow-sm relative group
                      `}
                    >
                      <button
                        onClick={() => onEditRelationships?.(node)}
                        className="w-full text-left hover:brightness-95 transition-all cursor-pointer"
                      >
                        <div className="font-medium text-gray-800 truncate pr-6">
                          <span className={`text-xl ${node.names.primary_zh ? "font-chinese" : ""}`}>{node.names.primary_zh || node.names.pinyin}</span>
                          {node.names.pinyin && (
                            <span className="ml-2 text-sm font-normal text-gray-400">{node.names.pinyin}</span>
                          )}
                          {(() => {
                            const birthDate = node.vital_stats?.birth?.date_iso;
                            const deathDate = node.vital_stats?.death?.date_iso;
                            const age = calculateAge(birthDate, deathDate);
                            if (age === null) return null;
                            const living = isPersonLiving(birthDate, deathDate);
                            if (living) {
                              return <span className="ml-1 text-[10px] text-emerald-600 font-normal">({age})</span>;
                            }
                            // Show age only if we have death date, otherwise just mark as deceased
                            if (deathDate) {
                              return <span className="ml-1 text-[10px] text-gray-400 font-normal">({age})</span>;
                            }
                            return null; // Presumed deceased - no age shown
                          })()}
                        </div>
                      </button>
                      {onDeleteNode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(t("confirmDelete"))) {
                              onDeleteNode(node.id);
                            }
                          }}
                          className="absolute top-1 right-1 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title={t("delete")}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* Main tree area */}
        <div className="flex-1" style={{ minWidth: treeMinWidth }}>
          {/* Tree as rows with generation column dividers */}
          <div className="relative pb-[500px]" style={{ minWidth: (maxDepth + 1) * COL_WIDTH }}>
          {/* Vertical dotted lines between generations */}
          {Array.from({ length: maxDepth + 1 }).map((_, i) => (
            <div
              key={`gen-line-${i}`}
              className="absolute top-0 bottom-0 border-l border-dashed border-gray-300 z-0 pointer-events-none"
              style={{ left: 32 + i * COL_WIDTH + COL_WIDTH - 10 }}
            />
          ))}

          {/* Rows */}
          {rows.map((row, rowIndex) => {
            const { depth, person, isSpouse, isShellEntry, ancestorHeadIds, familyHeadId, isLastOfFamily, subtreeSize, treeIndex } = row;
            const rowKey = getRowKey(row);

            // Check if any ancestor is collapsed - if so, skip this row
            const isHidden = ancestorHeadIds.some(id => collapsedSubtrees.has(id));
            if (isHidden) return null;

            // Check if this is the start of a new tree (need separator)
            const prevVisibleRow = rows.slice(0, rowIndex).reverse().find(r => !r.ancestorHeadIds.some(id => collapsedSubtrees.has(id)));
            const isNewTree = prevVisibleRow && prevVisibleRow.treeIndex !== treeIndex;

            const isMale = person.gender === "male";
            const isFemale = person.gender === "female";
            const isPlaceholder = person.id.includes("_placeholder");
            const isExpanded = expandedRowKey === rowKey;
            const isEditing = editingId === person.id;
            const isSubtreeCollapsed = collapsedSubtrees.has(familyHeadId);

            const isDivorced = isSpouse && row.partnerLink?.type === "divorced";
            const birthDate = person.vital_stats?.birth?.date_iso;
            const deathDate = person.vital_stats?.death?.date_iso;
            const isDeceased = isPersonDeceased(birthDate, deathDate);

            // Check if person is blood relative (has parents in ancestor chain) vs married-in
            const isBloodRelative = person.parent_ids?.some(ref => {
              const parentId = getParentId(ref);
              // Check if parent is a family head in ancestors
              if (ancestorHeadIds.includes(parentId)) return true;
              // Check if parent is a spouse of a family head in ancestors
              const parent = nodeMap.get(parentId);
              if (parent?.partner_ids?.some(pRef => ancestorHeadIds.includes(getParentId(pRef)))) return true;
              return false;
            }) ?? false;
            const isMarriedIn = !isBloodRelative && ancestorHeadIds.length > 0;  // Has ancestors but no parent link to them

            // Lighter colors for in-laws (married into family)
            const borderColor = isMale
              ? (isMarriedIn ? "border-blue-300" : "border-blue-400")
              : isFemale
              ? (isMarriedIn ? "border-pink-300" : "border-pink-400")
              : "border-gray-400";
            const bgColor = isMale
              ? (isMarriedIn ? "bg-gradient-to-r from-blue-50 to-white" : "bg-gradient-to-r from-blue-100 to-blue-50")
              : isFemale
              ? (isMarriedIn ? "bg-gradient-to-r from-pink-50 to-white" : "bg-gradient-to-r from-pink-100 to-pink-50")
              : "bg-gradient-to-r from-gray-100 to-gray-50";
            const roundedClass = isDeceased ? "rounded" : "rounded-l";
            const borderClass = isDeceased ? "border-2" : "border-2 border-r-0";

            return (
              <div
                key={rowKey}
                ref={(el) => {
                  if (el && !isPlaceholder) {
                    rowRefs.current.set(rowKey, el);
                  } else if (!el) {
                    // Element unmounted - clean up the ref to prevent memory leak
                    rowRefs.current.delete(rowKey);
                  }
                }}
              >
                {/* Tree separator - thick dotted line between separate family trees */}
                {isNewTree && (
                  <div className="my-16 mx-8 flex items-center">
                    <div className="flex-1 border-t-4 border-dotted border-amber-300/70" />
                  </div>
                )}
                {/* Main row */}
                <div
                  className={`flex items-start ${isSpouse ? "mb-2 mt-2" : "mb-2 mt-2"}`}
                  style={{ paddingLeft: 32 + depth * COL_WIDTH }}
                >
                  {/* Person card */}
                  {isPlaceholder ? (
                    <div
                      className="px-3 py-2.5 rounded border-2 border-dashed border-pink-300 bg-pink-50/50 relative z-10"
                      style={{ width: COL_WIDTH - 24 }}
                    >
                      <div className="text-base text-gray-400">氏</div>
                      <div className="text-xs text-gray-300">?</div>
                    </div>
                  ) : (
                    <div className={`relative group ${isMale && !isSpouse && ((person.partner_ids && person.partner_ids.length > 0) || row.hasChildren) ? "mt-6" : ""}`}>
                      {/* Dotted line spanning male's col and spouse col to the right (also for implied spouses via children) */}
                      {isMale && !isSpouse && ((person.partner_ids && person.partner_ids.length > 0) || row.hasChildren) && (
                        <div
                          className="absolute border-b-2 border-dotted border-gray-300 -top-3 left-0 pointer-events-none"
                          style={{ width: COL_WIDTH * 2 - 24 }}
                        />
                      )}
                      {/* Gradient connector for second+ wives */}
                      {isSpouse && isFemale && row.spouseIndex !== undefined && row.spouseIndex > 0 && (
                        <div
                          className="absolute w-1 rounded-full -left-3"
                          style={{
                            bottom: 0,
                            height: "calc(100% + 80px)",
                            background: "linear-gradient(to bottom, transparent, #f472b6)",
                          }}
                        />
                      )}
                      <button
                        onClick={() => handleToggle(rowKey, person.id)}
                        className={`
                          px-3 py-2.5 ${roundedClass} ${borderClass} ${borderColor} ${bgColor}
                          hover:brightness-95 transition-all duration-200 ease-out cursor-pointer text-left relative z-10 shadow-sm overflow-hidden
                          ${isExpanded ? "shadow-xl shadow-gray-400/50 -translate-y-0.5 scale-110" : ""}
                        `}
                        style={{ width: COL_WIDTH - 24 }}
                      >
                        {/* Chrysanthemum watermark for deceased */}
                        {isDeceased && (
                          <img
                            src="/chrysanthemum.png"
                            alt=""
                            className="absolute -right-3 -bottom-3 w-14 h-14 opacity-30 pointer-events-none"
                          />
                        )}
                        <div className="flex items-center gap-2 relative">
                          {person.avatar && (
                            <AvatarDisplay person={person} size="md" className="flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-base font-medium text-gray-800 flex items-baseline gap-1.5">
                              <span className={person.names.primary_zh ? "font-chinese" : ""}>
                                {person.names.primary_zh || person.names.pinyin}
                              </span>
                              {person.names.pinyin && (
                                <span className="text-xs font-normal text-gray-400">
                                  {person.names.pinyin}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                          {person.vital_stats?.birth?.date_iso?.replace(/-/g, ".") || "?"}
                          {person.vital_stats?.death?.date_iso && (
                            <span> - {person.vital_stats.death.date_iso.replace(/-/g, ".")}</span>
                          )}
                          {(() => {
                            const birthDate = person.vital_stats?.birth?.date_iso;
                            const deathDate = person.vital_stats?.death?.date_iso;
                            const age = calculateAge(birthDate, deathDate);
                            if (age === null) return null;
                            const living = isPersonLiving(birthDate, deathDate);
                            // If living, show current age in green
                            if (living) {
                              return <span className="ml-1.5 text-emerald-600 font-medium">({age}岁)</span>;
                            }
                            // If has death date, show age at death
                            if (deathDate) {
                              return <span className="ml-1.5 text-gray-400">(享年{age}岁)</span>;
                            }
                            // Presumed deceased (age > 100, no death date) - don't show age
                            return <span className="ml-1.5 text-gray-400">(已故)</span>;
                          })()}
                            </div>
                          </div>
                        </div>
                      </button>
                      {/* Image count badge */}
                      {imageCounts && imageCounts[person.id] > 0 && (
                        <div className="absolute bottom-1 right-1 flex items-center gap-px px-0.5 bg-gray-500/70 text-white text-[8px] rounded z-20">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {imageCounts[person.id]}
                        </div>
                      )}
                      {/* Favorite toggle button */}
                      {onToggleFavorite && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(person.id);
                          }}
                          className={`
                            absolute -top-1 -right-1 p-1 rounded-full transition-all z-20
                            ${favorites?.has(person.id)
                              ? "text-amber-500 bg-amber-100 hover:bg-amber-200"
                              : "text-gray-300 bg-white hover:text-amber-400 hover:bg-amber-50 opacity-0 group-hover:opacity-100"
                            }
                          `}
                          title={favorites?.has(person.id) ? t("removeFromFavorites") : t("addToFavorites")}
                        >
                          <svg
                            className="w-4 h-4"
                            fill={favorites?.has(person.id) ? "currentColor" : "none"}
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            />
                          </svg>
                        </button>
                      )}
                      {/* Multi-appearance navigation button */}
                      {row.multiAppearanceNav && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateToAppearance(row.multiAppearanceNav!.nextRowKey, COL_WIDTH);
                          }}
                          className="absolute -left-[34px] top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-full bg-amber-100 hover:bg-amber-300 hover:scale-110 text-amber-600 hover:text-amber-700 z-20 shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center gap-0.5 text-[10px] font-medium"
                          title={t("cycleAppearances")}
                        >
                          <span>{row.multiAppearanceNav.appearanceIndex}/{row.multiAppearanceNav.totalAppearances}</span>
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Notes floating to the right */}
                  {!isPlaceholder && person.attributes?.note && (
                    <div className="ml-5 pr-1 text-xs text-gray-500 italic max-w-xs truncate self-center leading-normal">
                      {String(person.attributes.note)}
                    </div>
                  )}
                </div>

                {/* Detail row - only rendered when expanded to avoid unnecessary API calls */}
                {!isPlaceholder && isExpanded && (
                  <div
                    className="detail-panel relative z-10 open"
                  >
                    <div>
                      <NodeDetailPanel
                        person={person}
                        existingNodes={nodes}
                        isEditing={isEditing}
                        onEditStart={() => handleEditStart(person.id)}
                        onEditCancel={handleEditCancel}
                        onSave={handleSave}
                        onDelete={onDeleteNode}
                        onAddChild={onAddChild}
                        onAddSpouse={onAddSpouse}
                        onRefresh={onRefresh}
                        contentIndent={depth * COL_WIDTH}
                      />
                    </div>
                  </div>
                )}

                {/* Collapse/Expand subtree button - appears after the last spouse of a family */}
                {isLastOfFamily && (subtreeSize ?? 0) > 0 && (
                  <div
                    className="mt-1 mb-6"
                    style={{ marginLeft: 32 + depth * COL_WIDTH, width: COL_WIDTH - 24 }}
                  >
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleToggleSubtree(familyHeadId)}
                        className={`
                          flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs
                          border transition-all shadow-sm
                          ${isSubtreeCollapsed
                            ? "bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200"
                            : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                          }
                        `}
                      >
                        <svg
                          className={`w-3 h-3 transition-transform ${isSubtreeCollapsed ? "" : "rotate-90"}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span>
                          {isSubtreeCollapsed ? t("expandSubtree") : t("collapseSubtree")}
                          <span className="ml-1 font-medium">({subtreeSize})</span>
                        </span>
                      </button>
                    </div>
                    <div className="border-b border-dashed border-gray-300 mt-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
    </div>
  );
}
