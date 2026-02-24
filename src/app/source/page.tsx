import { supabase } from "@/lib/supabase";
import { SourceDocument } from "@/types/source";
import SourceClient from "@/components/source/SourceClient";

async function getSourceDocuments(): Promise<SourceDocument[]> {
  const { data, error } = await supabase
    .from("source_documents")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("Error fetching source documents:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    storage_path: row.storage_path,
    storage_url: row.storage_url,
    thumbnail_url: row.thumbnail_url,
    title: row.title,
    document_date: row.document_date,
    is_approximate_date: row.is_approximate_date,
    source_notes: row.source_notes,
    source_location: row.source_location,
    width: row.width,
    height: row.height,
    file_size: row.file_size,
    mime_type: row.mime_type,
    uploaded_at: row.uploaded_at,
  }));
}

export default async function SourcePage() {
  const documents = await getSourceDocuments();

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <SourceClient initialDocuments={documents} />
    </main>
  );
}
