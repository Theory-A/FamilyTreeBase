"use client";

import { SourceDocument } from "@/types/source";
import DocumentCard from "./DocumentCard";

interface SourceGalleryProps {
  documents: SourceDocument[];
  onSelect: (doc: SourceDocument) => void;
}

export default function SourceGallery({ documents, onSelect }: SourceGalleryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onClick={() => onSelect(doc)}
        />
      ))}
    </div>
  );
}
