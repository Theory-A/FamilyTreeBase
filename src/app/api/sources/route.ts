import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase, generateImagePath, uploadImage } from "@/lib/supabase";
import { SourceDocument } from "@/types/source";

async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("family-auth");
  return authCookie?.value === "authenticated";
}

// GET /api/sources - List all source documents
export async function GET(request: NextRequest) {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get("sort") || "uploaded_at";

    let query = supabase.from("source_documents").select("*");

    if (sortBy === "document_date") {
      query = query.order("document_date", {
        ascending: false,
        nullsFirst: false,
      });
    } else {
      query = query.order("uploaded_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching source documents:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    const documents: SourceDocument[] = (data || []).map((row) => ({
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

    return NextResponse.json({ success: true, documents });
  } catch (error) {
    console.error("Error in GET /api/sources:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/sources - Upload a new source document
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const documentDate = formData.get("document_date") as string | null;
    const sourceNotes = formData.get("source_notes") as string | null;
    const sourceLocation = formData.get("source_location") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!title || title.trim() === "") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP" },
        { status: 400 }
      );
    }

    // Validate file size (max 20MB for source documents)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 20MB" },
        { status: 400 }
      );
    }

    // Generate storage path with "sources/" prefix
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split(".").pop() || "jpg";
    const storagePath = `sources/${timestamp}-${randomSuffix}.${extension}`;

    const uploadResult = await uploadImage(file, storagePath);

    if ("error" in uploadResult) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadResult.error}` },
        { status: 500 }
      );
    }

    // Insert metadata into database
    const { data: documentData, error: dbError } = await supabase
      .from("source_documents")
      .insert({
        storage_path: uploadResult.path,
        storage_url: uploadResult.url,
        title: title.trim(),
        document_date: documentDate || null,
        source_notes: sourceNotes || null,
        source_location: sourceLocation || null,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error inserting document metadata:", dbError);
      // Clean up uploaded file
      await supabase.storage.from("family-images").remove([uploadResult.path]);
      return NextResponse.json(
        { error: "Failed to save document metadata" },
        { status: 500 }
      );
    }

    const document: SourceDocument = {
      id: documentData.id,
      storage_path: documentData.storage_path,
      storage_url: documentData.storage_url,
      thumbnail_url: documentData.thumbnail_url,
      title: documentData.title,
      document_date: documentData.document_date,
      is_approximate_date: documentData.is_approximate_date,
      source_notes: documentData.source_notes,
      source_location: documentData.source_location,
      width: documentData.width,
      height: documentData.height,
      file_size: documentData.file_size,
      mime_type: documentData.mime_type,
      uploaded_at: documentData.uploaded_at,
    };

    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error("Error in POST /api/sources:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
