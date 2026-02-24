import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { SourceDocument } from "@/types/source";

async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("family-auth");
  return authCookie?.value === "authenticated";
}

// GET /api/sources/[id] - Get a single source document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from("source_documents")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching document:", error);
      return NextResponse.json(
        { error: "Failed to fetch document" },
        { status: 500 }
      );
    }

    const document: SourceDocument = {
      id: data.id,
      storage_path: data.storage_path,
      storage_url: data.storage_url,
      thumbnail_url: data.thumbnail_url,
      title: data.title,
      document_date: data.document_date,
      is_approximate_date: data.is_approximate_date,
      source_notes: data.source_notes,
      source_location: data.source_location,
      width: data.width,
      height: data.height,
      file_size: data.file_size,
      mime_type: data.mime_type,
      uploaded_at: data.uploaded_at,
    };

    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error("Error in GET /api/sources/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/sources/[id] - Update source document metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, document_date, source_notes, source_location } = body;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (document_date !== undefined) updates.document_date = document_date;
    if (source_notes !== undefined) updates.source_notes = source_notes;
    if (source_location !== undefined) updates.source_location = source_location;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("source_documents")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }
      console.error("Error updating document:", error);
      return NextResponse.json(
        { error: "Failed to update document" },
        { status: 500 }
      );
    }

    const document: SourceDocument = {
      id: data.id,
      storage_path: data.storage_path,
      storage_url: data.storage_url,
      thumbnail_url: data.thumbnail_url,
      title: data.title,
      document_date: data.document_date,
      is_approximate_date: data.is_approximate_date,
      source_notes: data.source_notes,
      source_location: data.source_location,
      width: data.width,
      height: data.height,
      file_size: data.file_size,
      mime_type: data.mime_type,
      uploaded_at: data.uploaded_at,
    };

    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error("Error in PUT /api/sources/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/sources/[id] - Delete a source document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // First get the document to find the storage path
    const { data: document, error: fetchError } = await supabase
      .from("source_documents")
      .select("storage_path")
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching document:", fetchError);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("family-images")
      .remove([document.storage_path]);

    if (storageError) {
      console.error("Error deleting from storage:", storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("source_documents")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("Error deleting document:", dbError);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/sources/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
