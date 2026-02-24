"use client";

import { useState } from "react";
import { SourceDocument, SortOption } from "@/types/source";
import { I18nProvider, useI18n, LanguageToggle } from "@/lib/i18n";
import SourceGallery from "./SourceGallery";
import SourceUploader from "./SourceUploader";
import DocumentViewer from "./DocumentViewer";
import Link from "next/link";

interface SourceClientProps {
  initialDocuments: SourceDocument[];
}

function SourceContent({ initialDocuments }: SourceClientProps) {
  const { t } = useI18n();
  const [documents, setDocuments] = useState<SourceDocument[]>(initialDocuments);
  const [sortBy, setSortBy] = useState<SortOption>("uploaded_at");
  const [showUploader, setShowUploader] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<SourceDocument | null>(null);

  const handleUpload = (newDoc: SourceDocument) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setShowUploader(false);
  };

  const handleUpdate = (updated: SourceDocument) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === updated.id ? updated : doc))
    );
    setSelectedDocument(updated);
  };

  const handleDelete = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    setSelectedDocument(null);
  };

  const handleSortChange = async (newSort: SortOption) => {
    setSortBy(newSort);
    try {
      const res = await fetch(`/api/sources?sort=${newSort}`);
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Error sorting documents:", error);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 border-b border-amber-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back to tree + Logo */}
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-amber-700 hover:text-amber-900 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span className="hidden sm:inline text-sm font-medium">
                  {t("familyGenealogy")}
                </span>
              </Link>
              <div className="h-6 w-px bg-amber-300" />
              <div className="flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-amber-600"
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
                <h1 className="text-lg font-semibold text-amber-900">
                  {t("sourceDocuments")}
                </h1>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <button
                onClick={() => setShowUploader(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="hidden sm:inline">{t("uploadDocument")}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sort controls */}
        {documents.length > 0 && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-600">
              {documents.length} {documents.length === 1 ? "document" : "documents"}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as SortOption)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="uploaded_at">{t("sortByUpload")}</option>
                <option value="document_date">{t("sortByDocument")}</option>
              </select>
            </div>
          </div>
        )}

        {/* Gallery or empty state */}
        {documents.length > 0 ? (
          <SourceGallery
            documents={documents}
            onSelect={setSelectedDocument}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 mb-6 text-amber-200">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                <path d="M9 13h6v2H9zm0 4h6v2H9zm0-8h2v2H9z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              {t("noDocuments")}
            </h2>
            <p className="text-gray-500 mb-6 max-w-md">
              {t("noDocumentsDesc")}
            </p>
            <button
              onClick={() => setShowUploader(true)}
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t("uploadDocument")}
            </button>
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUploader && (
        <SourceUploader
          onClose={() => setShowUploader(false)}
          onUpload={handleUpload}
        />
      )}

      {/* Document viewer modal */}
      {selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

export default function SourceClient({ initialDocuments }: SourceClientProps) {
  return (
    <I18nProvider>
      <SourceContent initialDocuments={initialDocuments} />
    </I18nProvider>
  );
}
