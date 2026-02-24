import {
  supabase,
  isSupabaseConfigured,
  requiredSupabaseEnvVars,
} from "@/lib/supabase";
import { PREVIEW_SOURCE_DOCUMENTS } from "@/lib/preview-data";
import { SourceDocument } from "@/types/source";
import SourceClient from "@/components/source/SourceClient";

async function getSourceDocuments(): Promise<SourceDocument[]> {
  if (!isSupabaseConfigured) {
    return PREVIEW_SOURCE_DOCUMENTS;
  }

  try {
    const { data, error } = await supabase
      .from("source_documents")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching source documents:", error);
      return PREVIEW_SOURCE_DOCUMENTS;
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
  } catch (error) {
    console.error("Error fetching source documents, using preview data:", error);
    return PREVIEW_SOURCE_DOCUMENTS;
  }
}

export default async function SourcePage() {
  const documents = await getSourceDocuments();
  const backendConfigured = isSupabaseConfigured;

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {!backendConfigured && (
        <section className="mx-auto max-w-7xl px-4 pt-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
            <p className="text-sm font-semibold">
              Preview mode: source archive is read-only until backend setup is complete.
            </p>
            <p className="mt-1 text-sm">
              Add these variables to
              <code className="mx-1 rounded bg-amber-100 px-1 py-0.5">.env.local</code>:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs sm:text-sm">
              {requiredSupabaseEnvVars.map((envVar) => (
                <li key={envVar}>
                  <code>{envVar}</code>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <SourceClient initialDocuments={documents} />
    </main>
  );
}
