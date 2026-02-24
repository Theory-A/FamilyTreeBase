"use client";

import { useState, useEffect, useMemo } from "react";
import { FamilyNode, Names, Gender, VitalStats, Attributes } from "@/types/family";
import { useI18n } from "@/lib/i18n";
import {
  DateInput,
  NameInputGroup,
  GenderSelector,
  PersonSelector,
  AttributesEditor,
} from "@/components/forms";
import { computeGenerations } from "@/lib/validation";

interface InitialValues {
  parent_ids?: string[];
  partner_ids?: string[];
  gender?: Gender;
}

interface AddPersonModalProps {
  isOpen: boolean;
  onClose: (resetForm?: boolean) => void;
  onSave: (params: {
    node: Omit<FamilyNode, "id">;
    childrenToLink?: string[];
  }) => Promise<{ success: boolean; error?: string; details?: string[] }>;
  existingNodes: FamilyNode[];
  initialValues?: InitialValues;
  formResetKey?: number;
}

interface FormState {
  names: Names;
  gender: Gender;
  vital_stats: VitalStats;
  parent_ids: string[];
  partner_ids: string[];
  childrenToLink: string[];
  attributes: Attributes;
}

const initialFormState: FormState = {
  names: { primary_zh: "", pinyin: "" },
  gender: "male",
  vital_stats: {},
  parent_ids: [],
  partner_ids: [],
  childrenToLink: [],
  attributes: {},
};

export default function AddPersonModal({
  isOpen,
  onClose,
  onSave,
  existingNodes,
  initialValues,
  formResetKey,
}: AddPersonModalProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<{
    names?: { primary_zh?: string; pinyin?: string };
    general?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset form only when formResetKey changes (explicit reset from parent)
  useEffect(() => {
    setForm({
      ...initialFormState,
      parent_ids: initialValues?.parent_ids || [],
      partner_ids: initialValues?.partner_ids || [],
      gender: initialValues?.gender || "male",
    });
    setErrors({});
  }, [formResetKey]); // Only reset when key changes, not on every open/close

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const newErrors: typeof errors = {};
    if (!form.names.primary_zh.trim()) {
      newErrors.names = { ...newErrors.names, primary_zh: t("chineseNameRequired") };
    }

    // Check that selected parents exist
    for (const parentId of form.parent_ids) {
      if (!existingNodes.find((n) => n.id === parentId)) {
        newErrors.general = t("failedToSave");
        break;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    setErrors({});

    // Build the node object
    const node: Omit<FamilyNode, "id"> = {
      names: {
        primary_zh: form.names.primary_zh.trim(),
        pinyin: form.names.pinyin.trim(),
      },
      gender: form.gender,
    };

    // Add optional fields
    if (form.vital_stats.birth?.date_iso || form.vital_stats.death?.date_iso) {
      node.vital_stats = form.vital_stats;
    }

    if (form.parent_ids.length > 0) {
      node.parent_ids = form.parent_ids;
    }

    if (form.partner_ids.length > 0) {
      node.partner_ids = form.partner_ids;
    }

    if (Object.keys(form.attributes).some((key) => form.attributes[key])) {
      node.attributes = form.attributes;
    }

    try {
      const result = await onSave({
        node,
        childrenToLink: form.childrenToLink,
      });

      if (result.success) {
        onClose(true); // Reset form on successful save
      } else {
        setErrors({
          general: result.error || t("failedToSave"),
        });
      }
    } catch (err) {
      setErrors({
        general: err instanceof Error ? err.message : t("failedToSave"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Compute generations for sorting
  const generations = useMemo(() => {
    return computeGenerations(existingNodes);
  }, [existingNodes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onClose()} // Don't reset form on backdrop click
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">{t("addNewPerson")}</h2>
          <button
            onClick={() => onClose()} // Don't reset form on X click
            className="text-gray-400 hover:text-gray-600"
            title={t("close")}
          >
            <span className="text-xl">&times;</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* General error */}
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {errors.general}
              </div>
            )}

            {/* Names */}
            <NameInputGroup
              value={form.names}
              onChange={(names) => setForm((f) => ({ ...f, names }))}
              errors={errors.names}
            />

            {/* Gender */}
            <GenderSelector
              value={form.gender}
              onChange={(gender) => setForm((f) => ({ ...f, gender }))}
            />

            {/* Dates */}
            <div>
              <h3 className="text-sm font-medium text-gray-800 mb-3">{t("dates")}</h3>
              <div className="grid grid-cols-2 gap-4">
                <DateInput
                  label={t("birthDate")}
                  value={form.vital_stats.birth}
                  onChange={(birth) =>
                    setForm((f) => ({
                      ...f,
                      vital_stats: { ...f.vital_stats, birth },
                    }))
                  }
                />
                <DateInput
                  label={t("deathDate")}
                  value={form.vital_stats.death}
                  onChange={(death) =>
                    setForm((f) => ({
                      ...f,
                      vital_stats: { ...f.vital_stats, death },
                    }))
                  }
                />
              </div>
            </div>

            {/* Relationships */}
            <div>
              <h3 className="text-sm font-medium text-gray-800 mb-3">{t("relationships")}</h3>
              <div className="space-y-4">
                <PersonSelector
                  label={t("parentsMax2")}
                  nodes={existingNodes}
                  selectedIds={form.parent_ids}
                  onChange={(ids) => setForm((f) => ({ ...f, parent_ids: ids }))}
                  multiple
                  maxSelections={2}
                  placeholder={t("searchParents")}
                  generations={generations}
                />

                <PersonSelector
                  label={t("partnerSpouse")}
                  nodes={existingNodes}
                  selectedIds={form.partner_ids}
                  onChange={(ids) => setForm((f) => ({ ...f, partner_ids: ids }))}
                  excludeIds={form.parent_ids}
                  placeholder={t("searchPartner")}
                  generations={generations}
                />

                <PersonSelector
                  label={t("children")}
                  nodes={existingNodes}
                  selectedIds={form.childrenToLink}
                  onChange={(ids) => setForm((f) => ({ ...f, childrenToLink: ids }))}
                  excludeIds={[...form.parent_ids, ...form.partner_ids]}
                  multiple
                  placeholder={t("searchChildren")}
                  generations={generations}
                />
              </div>
            </div>

            {/* Notes */}
            <AttributesEditor
              value={form.attributes}
              onChange={(attributes) => setForm((f) => ({ ...f, attributes }))}
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => onClose()} // Don't reset form on cancel
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              disabled={isSaving}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isSaving ? t("saving") : t("addPerson")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
