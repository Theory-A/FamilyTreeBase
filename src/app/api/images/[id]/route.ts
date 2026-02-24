import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase, deleteImage } from "@/lib/supabase";
import { ImageMetadata } from "@/types/image";

// Helper to verify authentication
async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("family-auth");
  return authCookie?.value === "authenticated";
}

// GET /api/images/[id] - Get a single image
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
      .from("family_images")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    const image: ImageMetadata = {
      id: data.id,
      storage_path: data.storage_path,
      storage_url: data.storage_url,
      thumbnail_url: data.thumbnail_url,
      tagged_node_ids: data.tagged_node_ids || [],
      caption: data.caption,
      date_taken: data.date_taken,
      is_approximate_date: data.is_approximate_date,
      uploaded_at: data.uploaded_at,
      width: data.width,
      height: data.height,
      file_size: data.file_size,
      mime_type: data.mime_type,
    };

    return NextResponse.json({ success: true, image });
  } catch (error) {
    console.error("Error in GET /api/images/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/images/[id] - Update image metadata
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
    const { tagged_node_ids, caption, date_taken, is_approximate_date } = body;

    // Validate tagged_node_ids if provided
    if (tagged_node_ids !== undefined) {
      if (!Array.isArray(tagged_node_ids) || tagged_node_ids.length === 0) {
        return NextResponse.json(
          { error: "At least one tagged person is required" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (tagged_node_ids !== undefined) updates.tagged_node_ids = tagged_node_ids;
    if (caption !== undefined) updates.caption = caption || null;
    if (date_taken !== undefined) updates.date_taken = date_taken || null;
    if (is_approximate_date !== undefined) updates.is_approximate_date = is_approximate_date;

    const { data, error } = await supabase
      .from("family_images")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Image not found" },
          { status: 404 }
        );
      }
      console.error("Error updating image:", error);
      return NextResponse.json(
        { error: "Failed to update image" },
        { status: 500 }
      );
    }

    const image: ImageMetadata = {
      id: data.id,
      storage_path: data.storage_path,
      storage_url: data.storage_url,
      thumbnail_url: data.thumbnail_url,
      tagged_node_ids: data.tagged_node_ids || [],
      caption: data.caption,
      date_taken: data.date_taken,
      is_approximate_date: data.is_approximate_date,
      uploaded_at: data.uploaded_at,
      width: data.width,
      height: data.height,
      file_size: data.file_size,
      mime_type: data.mime_type,
    };

    return NextResponse.json({ success: true, image });
  } catch (error) {
    console.error("Error in PUT /api/images/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/images/[id] - Delete an image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // First get the image to find the storage path
    const { data: imageData, error: fetchError } = await supabase
      .from("family_images")
      .select("storage_path")
      .eq("id", id)
      .single();

    if (fetchError || !imageData) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Delete from storage
    const storageResult = await deleteImage(imageData.storage_path);
    if (!storageResult.success) {
      console.warn("Failed to delete image from storage:", storageResult.error);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("family_images")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting image from database:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/images/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
