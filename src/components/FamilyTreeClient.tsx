"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { FamilyTreeData, FamilyNode, Gender, PartnerLink } from "@/types/family";
import { useFamilyData, useFavorites } from "@/hooks";
import { I18nProvider, useI18n, LanguageToggle } from "@/lib/i18n";
import { PersonSelectionProvider } from "@/lib/PersonSelectionContext";
import { validateBidirectionalPartners } from "@/lib/validation";
import FamilyTree from "./FamilyTree";
import FavoritesBar from "./FavoritesBar";
import UpcomingDatesBanner from "./UpcomingDatesBanner";
import { AddPersonModal, EditRelationshipsModal } from "./modals";
import Link from "next/link";

interface FamilyTreeClientProps {
  initialNodes: FamilyTreeData;
}

// Node ID to cull when secret mode is activated
const CULLED_NODE_ID = "fa20ece1-ae8b-41b9-a74e-217a552b6f68";

function FamilyTreeContent({ initialNodes }: FamilyTreeClientProps) {
  const { t } = useI18n();
  const { nodes, isLoading, error, saveStatus, pendingSaveCount, updateNode, createNode, deleteNode, retryFailedSaves, refetch } = useFamilyData(initialNodes);
  const { favorites, toggleFavorite, removeFavorite } = useFavorites();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialValues, setModalInitialValues] = useState<{
    parent_ids?: string[];
    partner_ids?: string[];
    gender?: Gender;
  } | undefined>(undefined);
  // Key to force form reset - only changes on successful submit or when opening with new context
  const [formResetKey, setFormResetKey] = useState(0);
  const [editRelationshipsPerson, setEditRelationshipsPerson] = useState<FamilyNode | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [scrollToNodeId, setScrollToNodeId] = useState<string | null>(null);
  const [imageCounts, setImageCounts] = useState<Record<string, number>>({});
  // Secret culling mode - active by default, triple-click logo to disable
  const [isCullingEnabled, setIsCullingEnabled] = useState(true);
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = useCallback(() => {
    logoClickCount.current += 1;

    if (logoClickTimer.current) {
      clearTimeout(logoClickTimer.current);
    }

    if (logoClickCount.current >= 3) {
      // Triple click detected - toggle culling mode
      setIsCullingEnabled(prev => !prev);
      logoClickCount.current = 0;
    } else {
      // Reset counter after 500ms
      logoClickTimer.current = setTimeout(() => {
        logoClickCount.current = 0;
      }, 500);
    }
  }, []);

  // Fetch image counts on mount
  useEffect(() => {
    const fetchImageCounts = async () => {
      try {
        const response = await fetch("/api/images/counts");
        const data = await response.json();
        if (data.success) {
          setImageCounts(data.counts);
        }
      } catch (error) {
        console.error("Failed to fetch image counts:", error);
      }
    };
    fetchImageCounts();
  }, []);

  const handleNavigateToNode = useCallback((nodeId: string) => {
    setScrollToNodeId(nodeId);
  }, []);

  const handleScrollComplete = useCallback(() => {
    setScrollToNodeId(null);
  }, []);

  // Validate data integrity
  const validationWarnings = useMemo(() => {
    const partnerErrors = validateBidirectionalPartners(nodes);
    return {
      partnerErrors,
      hasIssues: partnerErrors.length > 0,
    };
  }, [nodes]);

  const handleUpdateNode = (params: {
    node: FamilyNode;
    childrenToLink?: string[];
    childrenToUnlink?: string[];
  }) => {
    const { node, childrenToLink, childrenToUnlink } = params;

    // Helper to convert partner ref to PartnerLink
    const toPartnerLink = (ref: string | PartnerLink): PartnerLink =>
      typeof ref === "string" ? { id: ref } : ref;
    const getPartnerId = (ref: string | PartnerLink): string =>
      typeof ref === "string" ? ref : ref.id;

    // Update the main node (which updates parent_ids, partner_ids, etc.)
    const nodeResult = updateNode(node);
    if (!nodeResult.success) {
      return { success: false, error: nodeResult.error };
    }

    // Sync partner links bidirectionally
    // For each partner in node.partner_ids, update their link back to this node
    const currentPartnerLinks = (node.partner_ids || []).map(toPartnerLink);
    const currentPartnerIds = new Set(currentPartnerLinks.map(p => p.id));

    for (const link of currentPartnerLinks) {
      const partnerNode = nodes.find((n) => n.id === link.id);
      if (!partnerNode) continue;

      // Get partner's existing links
      const partnerLinks = (partnerNode.partner_ids || []).map(toPartnerLink);

      // Find or create the reverse link
      const existingLinkIndex = partnerLinks.findIndex(p => p.id === node.id);

      // Create the synced link (same type and dates, pointing back to this node)
      const syncedLink: PartnerLink = {
        id: node.id,
        type: link.type,
        marriage_date: link.marriage_date,
        divorce_date: link.divorce_date,
        order: link.order,
      };

      if (existingLinkIndex >= 0) {
        // Update existing link
        partnerLinks[existingLinkIndex] = syncedLink;
      } else {
        // Add new link
        partnerLinks.push(syncedLink);
      }

      const updatedPartner: FamilyNode = {
        ...partnerNode,
        partner_ids: partnerLinks,
      };
      updateNode(updatedPartner);
    }

    // Remove reverse links for partners that were removed
    // Find partners that existed before but are no longer in the list
    const oldNode = nodes.find((n) => n.id === node.id);
    if (oldNode?.partner_ids) {
      const oldPartnerIds = oldNode.partner_ids.map(getPartnerId);
      for (const oldPartnerId of oldPartnerIds) {
        if (!currentPartnerIds.has(oldPartnerId)) {
          // This partner was removed, remove the reverse link
          const partnerNode = nodes.find((n) => n.id === oldPartnerId);
          if (partnerNode?.partner_ids) {
            const updatedPartnerLinks = partnerNode.partner_ids
              .map(toPartnerLink)
              .filter(p => p.id !== node.id);
            const updatedPartner: FamilyNode = {
              ...partnerNode,
              partner_ids: updatedPartnerLinks.length > 0 ? updatedPartnerLinks : undefined,
            };
            updateNode(updatedPartner);
          }
        }
      }
    }

    // Update children to link (add this person as their parent)
    if (childrenToLink?.length) {
      for (const childId of childrenToLink) {
        const childNode = nodes.find((n) => n.id === childId);
        if (childNode) {
          const existingParents = childNode.parent_ids || [];
          const updatedChild: FamilyNode = {
            ...childNode,
            parent_ids: [...existingParents, node.id],
          };
          updateNode(updatedChild);
        }
      }
    }

    // Update children to unlink (remove this person as their parent)
    if (childrenToUnlink?.length) {
      for (const childId of childrenToUnlink) {
        const childNode = nodes.find((n) => n.id === childId);
        if (childNode && childNode.parent_ids) {
          const getParentIdFromRef = (ref: string | { id: string }) =>
            typeof ref === "string" ? ref : ref.id;
          const updatedParentIds = childNode.parent_ids.filter(
            (ref) => getParentIdFromRef(ref) !== node.id
          );
          const updatedChild: FamilyNode = {
            ...childNode,
            parent_ids: updatedParentIds.length > 0 ? updatedParentIds : undefined,
          };
          updateNode(updatedChild);
        }
      }
    }

    return { success: true };
  };

  const handleCreateNode = async (params: Parameters<typeof createNode>[0]) => {
    const result = await createNode(params);

    // If creation succeeded and the new node has partners, sync bidirectional links
    if (result.success && result.data?.id && params.node.partner_ids?.length) {
      const newNodeId = result.data.id;
      const toPartnerLink = (ref: string | PartnerLink): PartnerLink =>
        typeof ref === "string" ? { id: ref } : ref;

      for (const partnerRef of params.node.partner_ids) {
        const partnerId = typeof partnerRef === "string" ? partnerRef : partnerRef.id;
        const partnerNode = nodes.find((n) => n.id === partnerId);
        if (!partnerNode) continue;

        // Get partner's existing links
        const partnerLinks = (partnerNode.partner_ids || []).map(toPartnerLink);

        // Check if reverse link already exists
        const existingLinkIndex = partnerLinks.findIndex(p => p.id === newNodeId);
        if (existingLinkIndex < 0) {
          // Add reverse link to the existing partner
          const partnerRefLink = toPartnerLink(partnerRef);
          const syncedLink: PartnerLink = {
            id: newNodeId,
            type: partnerRefLink.type,
            marriage_date: partnerRefLink.marriage_date,
            divorce_date: partnerRefLink.divorce_date,
            order: partnerRefLink.order,
          };
          partnerLinks.push(syncedLink);

          const updatedPartner: FamilyNode = {
            ...partnerNode,
            partner_ids: partnerLinks,
          };
          updateNode(updatedPartner);
        }
      }
    }

    return { success: result.success, error: result.error, details: result.details };
  };

  const handleEditRelationships = (params: {
    node: FamilyNode;
    childrenToLink?: string[];
    childrenToUnlink?: string[];
  }) => {
    // Reuse handleUpdateNode which includes partner sync logic
    return handleUpdateNode(params);
  };

  const handleAddChild = (parent: FamilyNode) => {
    // Get the parent's spouse if any to include both as parents
    const spouseId = parent.partner_ids?.[0];
    const parentIds = spouseId
      ? [parent.id, typeof spouseId === "string" ? spouseId : spouseId.id]
      : [parent.id];

    setModalInitialValues({
      parent_ids: parentIds,
    });
    setFormResetKey((k) => k + 1); // Reset form for new context
    setIsModalOpen(true);
  };

  const handleAddSpouse = (partner: FamilyNode) => {
    // Set opposite gender as default
    const defaultGender: Gender = partner.gender === "male" ? "female" : "male";

    setModalInitialValues({
      partner_ids: [partner.id],
      gender: defaultGender,
    });
    setFormResetKey((k) => k + 1); // Reset form for new context
    setIsModalOpen(true);
  };

  const handleDeleteNode = async (nodeId: string) => {
    const result = await deleteNode(nodeId);
    return { success: result.success, error: result.error };
  };

  const handleCloseModal = (resetForm?: boolean) => {
    setIsModalOpen(false);
    // Only reset form state on explicit request (successful save)
    if (resetForm) {
      setModalInitialValues(undefined);
      setFormResetKey((k) => k + 1);
    }
  };

  const handleOpenModal = () => {
    setModalInitialValues(undefined);
    setIsModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-amber-200 bg-white/80 backdrop-blur-sm flex-shrink-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />
            <img
              src="/logo.png"
              alt="Qi Family"
              className="w-8 h-8 sm:w-12 sm:h-12 rounded-full object-cover cursor-pointer select-none"
              onClick={handleLogoClick}
            />
            <h1 className="text-base sm:text-lg font-bold text-gray-800">{t("familyName")}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {saveStatus === "error" && (
              <span className="text-sm text-red-500 flex items-center gap-2">
                {t("saveFailed")}
                <button
                  onClick={retryFailedSaves}
                  className="underline hover:no-underline"
                >
                  {t("retry")}
                </button>
              </span>
            )}
            {error && saveStatus !== "error" && (
              <span className="text-sm text-red-500">{error}</span>
            )}
            <Link
              href="/mobile"
              className="hidden sm:flex px-3 py-2 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-md text-sm font-medium transition-colors items-center gap-1.5"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              {t("mobileView")}
            </Link>
            <Link
              href="/source"
              className="hidden sm:flex px-3 py-2 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-md text-sm font-medium transition-colors items-center gap-1.5"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {t("sourceDocuments")}
            </Link>
            <button
              onClick={handleOpenModal}
              className="hidden sm:flex px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors items-center gap-2"
            >
              <span>+</span>
              {t("addPerson")}
            </button>
          </div>
        </div>
      </header>

      {/* Upcoming birthdays and memorials banner */}
      <UpcomingDatesBanner nodes={nodes} onNavigateToNode={handleNavigateToNode} />

      {/* Data integrity warning */}
      {validationWarnings.hasIssues && !warningDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-start gap-3">
            <span className="text-amber-600 text-lg">⚠</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-800">
                {t("dataIntegrityWarning")}
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                {t("partnerLinkIssues")}
              </p>
              <ul className="mt-2 text-xs text-amber-600 space-y-1">
                {validationWarnings.partnerErrors.map((err, i) => (
                  <li key={i} className="font-mono">{err}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setWarningDismissed(true)}
              className="text-amber-600 hover:text-amber-800 text-sm"
            >
              {t("dismiss")}
            </button>
          </div>
        </div>
      )}

      {/* Favorites bar */}
      <FavoritesBar
        nodes={nodes}
        favorites={favorites}
        onNavigateToNode={handleNavigateToNode}
        onRemoveFavorite={removeFavorite}
      />

      {/* Tree visualization - fills remaining viewport height */}
      <div className="flex-1 min-h-0">
        <FamilyTree
          nodes={nodes}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onEditRelationships={setEditRelationshipsPerson}
          onAddChild={handleAddChild}
          onAddSpouse={handleAddSpouse}
          onRefresh={refetch}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          scrollToNodeId={scrollToNodeId}
          onScrollComplete={handleScrollComplete}
          imageCounts={imageCounts}
          culledNodeId={isCullingEnabled ? CULLED_NODE_ID : undefined}
        />
      </div>

      {/* Add Person Modal */}
      <AddPersonModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleCreateNode}
        existingNodes={nodes}
        initialValues={modalInitialValues}
        formResetKey={formResetKey}
      />

      {/* Edit Relationships Modal */}
      <EditRelationshipsModal
        isOpen={editRelationshipsPerson !== null}
        person={editRelationshipsPerson}
        onClose={() => setEditRelationshipsPerson(null)}
        onSave={handleEditRelationships}
        existingNodes={nodes}
      />


      {/* Modals rendered outside flex container */}
    </div>
  );
}

export default function FamilyTreeClient({ initialNodes }: FamilyTreeClientProps) {
  return (
    <I18nProvider>
      <PersonSelectionProvider>
        <FamilyTreeContent initialNodes={initialNodes} />
      </PersonSelectionProvider>
    </I18nProvider>
  );
}
