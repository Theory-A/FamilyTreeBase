import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase, generateImagePath, uploadImage } from "@/lib/supabase";
import { ImageMetadata } from "@/types/image";

// Helper to verify authentication
async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("family-auth");
  return authCookie?.value === "authenticated";
}

// GET /api/images - List images, optionally filtered by node_id
export async function GET(request: NextRequest) {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get("node_id");

    let query = supabase
      .from("family_images")
      .select("*")
      .order("date_taken", { ascending: false, nullsFirst: false });

    // Filter by tagged node if specified
    if (nodeId) {
      query = query.contains("tagged_node_ids", [nodeId]);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching images:", error);
      return NextResponse.json(
        { error: "Failed to fetch images" },
        { status: 500 }
      );
    }

    const images: ImageMetadata[] = (data || []).map((row) => ({
      id: row.id,
      storage_path: row.storage_path,
      storage_url: row.storage_url,
      thumbnail_url: row.thumbnail_url,
      tagged_node_ids: row.tagged_node_ids || [],
      caption: row.caption,
      date_taken: row.date_taken,
      is_approximate_date: row.is_approximate_date,
      uploaded_at: row.uploaded_at,
      width: row.width,
      height: row.height,
      file_size: row.file_size,
      mime_type: row.mime_type,
    }));

    return NextResponse.json({ success: true, images });
  } catch (error) {
    console.error("Error in GET /api/images:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/images - Upload a new image
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const thumbnail = formData.get("thumbnail") as File | null;
    const taggedNodeIds = formData.get("tagged_node_ids") as string | null;
    const caption = formData.get("caption") as string | null;
    const dateTaken = formData.get("date_taken") as string | null;
    const isApproximateDate = formData.get("is_approximate_date") === "true";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Parse tagged node IDs
    let parsedTaggedNodeIds: string[] = [];
    if (taggedNodeIds) {
      try {
        parsedTaggedNodeIds = JSON.parse(taggedNodeIds);
      } catch {
        parsedTaggedNodeIds = taggedNodeIds.split(",").filter(Boolean);
      }
    }

    if (parsedTaggedNodeIds.length === 0) {
      return NextResponse.json(
        { error: "At least one tagged person is required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Generate storage path and upload
    const storagePath = generateImagePath(file.name);
    const uploadResult = await uploadImage(file, storagePath);

    if ("error" in uploadResult) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadResult.error}` },
        { status: 500 }
      );
    }

    // Upload thumbnail if provided
    let thumbnailUrl: string | null = null;
    if (thumbnail) {
      // Generate thumbnail path based on main image path
      const thumbPath = storagePath.replace(/\.[^.]+$/, "_thumb.jpg");
      const thumbResult = await uploadImage(thumbnail, thumbPath);
      if (!("error" in thumbResult)) {
        thumbnailUrl = thumbResult.url;
      }
      // If thumbnail upload fails, we continue without it (non-fatal)
    }

    // Insert metadata into database
    const { data: imageData, error: dbError } = await supabase
      .from("family_images")
      .insert({
        storage_path: uploadResult.path,
        storage_url: uploadResult.url,
        thumbnail_url: thumbnailUrl,
        tagged_node_ids: parsedTaggedNodeIds,
        caption: caption || null,
        date_taken: dateTaken || null,
        is_approximate_date: isApproximateDate,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error inserting image metadata:", dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from("family-images").remove([uploadResult.path]);
      return NextResponse.json(
        { error: "Failed to save image metadata" },
        { status: 500 }
      );
    }

    const image: ImageMetadata = {
      id: imageData.id,
      storage_path: imageData.storage_path,
      storage_url: imageData.storage_url,
      thumbnail_url: imageData.thumbnail_url,
      tagged_node_ids: imageData.tagged_node_ids || [],
      caption: imageData.caption,
      date_taken: imageData.date_taken,
      is_approximate_date: imageData.is_approximate_date,
      uploaded_at: imageData.uploaded_at,
      width: imageData.width,
      height: imageData.height,
      file_size: imageData.file_size,
      mime_type: imageData.mime_type,
    };

    return NextResponse.json({ success: true, image });
  } catch (error) {
    console.error("Error in POST /api/images:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
