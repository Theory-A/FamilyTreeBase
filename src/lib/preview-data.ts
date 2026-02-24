import { FamilyTreeData } from "@/types/family";
import { SourceDocument } from "@/types/source";

export const PREVIEW_FAMILY_DATA: FamilyTreeData = [
  {
    id: "preview-qi-root",
    names: {
      primary_zh: "戚预览",
      pinyin: "Qi Yulan",
      display_en: "Preview Root",
    },
    gender: "male",
    vital_stats: {
      birth: { date_iso: "1962-03-10" },
    },
    partner_ids: ["preview-li-partner"],
    attributes: {
      note: "Preview mode sample record",
    },
  },
  {
    id: "preview-li-partner",
    names: {
      primary_zh: "李示例",
      pinyin: "Li Shili",
      display_en: "Preview Partner",
    },
    gender: "female",
    vital_stats: {
      birth: { date_iso: "1964-08-21" },
    },
    partner_ids: ["preview-qi-root"],
    attributes: {
      note: "Preview mode sample record",
    },
  },
  {
    id: "preview-child",
    names: {
      primary_zh: "戚测试",
      pinyin: "Qi Ceshi",
      display_en: "Preview Child",
    },
    gender: "female",
    vital_stats: {
      birth: { date_iso: "1990-06-01" },
    },
    parent_ids: ["preview-qi-root", "preview-li-partner"],
    attributes: {
      note: "Connect Supabase in .env.local to load real family data",
    },
  },
];

const PREVIEW_UPLOAD_DATE = "2025-01-01T00:00:00.000Z";

export const PREVIEW_SOURCE_DOCUMENTS: SourceDocument[] = [
  {
    id: "preview-doc-1",
    storage_path: "preview/family-record-1.png",
    storage_url: "/logo.png",
    thumbnail_url: "/logo.png",
    title: "Preview Document",
    document_date: "1936",
    source_notes: "This is sample content shown while Supabase is not configured.",
    source_location: "Local preview mode",
    mime_type: "image/png",
    file_size: 0,
    uploaded_at: PREVIEW_UPLOAD_DATE,
  },
];
