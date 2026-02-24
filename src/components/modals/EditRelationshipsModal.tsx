"use client";

import { useState, useEffect, useMemo } from "react";
import { FamilyNode } from "@/types/family";
import { useI18n } from "@/lib/i18n";
import { PersonSelector } from "@/components/forms";
import { computeGenerations } from "@/lib/validation";

interface EditRelationshipsModalProps {
  isOpen: boolean;
  person: FamilyNode | null;
  onClose: () => void;
  onSave: (params: {
    node: FamilyNode;
    childrenToLink?: string[];
    childrenToUnlink?: string[];
  }) => { success: boolean; error?: string };
  existingNodes: FamilyNode[];
}

function getParentId(ref: string | { id: string }): string {
  return typeof ref === "string" ? ref : ref.id;
}

export default function EditRelationshipsModal({
  isOpen,
  person,
  onClose,
  onSave,
  existingNodes,
}: EditRelationshipsModalProps) {
  const { t } = useI18n();
  const [parentIds, setParentIds] = useState<string[]>([]);
  const [childIds, setChildIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Calculate original children (nodes that have this person as a parent)
  const originalChildIds = useMemo(() => {
    if (!person) return [];
    return existingNodes
      .filter((n) =>
        n.parent_ids?.some((ref) => getParentId(ref) === person.id)
      )
      .map((n) => n.id);
  }, [person, existingNodes]);

  // Reset form when modal opens or person changes
  useEffect(() => {
    if (isOpen && person) {
      setParentIds(person.parent_ids?.map(getParentId) || []);
      setChildIds(originalChildIds);
      setError(null);
    }
  }, [isOpen, person, originalChildIds]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!person) return;

    setError(null);

    // Build updated node with new parent_ids
    const updatedNode: FamilyNode = {
      ...person,
      parent_ids: parentIds.length > 0 ? parentIds : undefined,
    };

    // Calculate children to link/unlink
    const childrenToLink = childIds.filter((id) => !originalChildIds.includes(id));
    const childrenToUnlink = originalChildIds.filter((id) => !childIds.includes(id));

    const result = onSave({
      node: updatedNode,
      childrenToLink: childrenToLink.length > 0 ? childrenToLink : undefined,
      childrenToUnlink: childrenToUnlink.length > 0 ? childrenToUnlink : undefined,
    });

    if (result.success) {
      onClose();
    } else {
      setError(result.error || t("failedToSave"));
    }
  };

  // Compute generations for sorting
  const generations = useMemo(() => {
    return computeGenerations(existingNodes);
  }, [existingNodes]);

  if (!isOpen || !person) return null;

  // Exclude self from selectable nodes
  const selectableNodes = existingNodes.filter((n) => n.id !== person.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {t("editRelationships")}
            </h2>
            <p className="text-sm text-gray-500">
              <span className="font-chinese">{person.names.primary_zh}</span>
              {person.names.pinyin && ` (${person.names.pinyin})`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            title={t("close")}
          >
            <span className="text-xl">&times;</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Help text */}
            <p className="text-sm text-gray-600">
              {t("editRelationshipsHelp")}
            </p>

            {/* Parents */}
            <PersonSelector
              label={t("parentsMax2")}
              nodes={selectableNodes}
              selectedIds={parentIds}
              onChange={setParentIds}
              excludeIds={childIds}
              multiple
              maxSelections={2}
              placeholder={t("searchParents")}
              generations={generations}
            />

            {/* Children */}
            <PersonSelector
              label={t("children")}
              nodes={selectableNodes}
              selectedIds={childIds}
              onChange={setChildIds}
              excludeIds={parentIds}
              multiple
              placeholder={t("searchChildren")}
              generations={generations}
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600"
            >
              {t("saveChanges")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
