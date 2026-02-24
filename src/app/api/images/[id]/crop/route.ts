import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { AvatarCrop, FamilyNode, FamilyTreeData } from "@/types/family";

// Helper to verify authentication
async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("family-auth");
  return authCookie?.value === "authenticated";
}

// Helper to get current family data
async function getFamilyData(): Promise<FamilyTreeData> {
  const { data, error } = await supabase
    .from("family_tree")
    .select("data")
    .eq("id", 1)
    .single();

  if (error) throw error;
  return data.data as FamilyTreeData;
}

// Helper to update family data
async function updateFamilyData(nodes: FamilyTreeData): Promise<void> {
  const { data, error } = await supabase
    .from("family_tree")
    .update({ data: nodes })
    .eq("id", 1)
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Update failed: no rows affected. Check RLS policies.");
  }
}

// POST /api/images/[id]/crop - Set avatar crop for a person
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: imageId } = await params;
    const body = await request.json();
    const { node_id, cropX, cropY, cropWidth, cropHeight } = body;

    // Validate required fields
    if (!node_id) {
      return NextResponse.json(
        { error: "node_id is required" },
        { status: 400 }
      );
    }

    // Validate crop parameters
    if (
      typeof cropX !== "number" ||
      typeof cropY !== "number" ||
      typeof cropWidth !== "number" ||
      typeof cropHeight !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid crop parameters" },
        { status: 400 }
      );
    }

    // Validate crop values are in 0-100 range
    if (
      cropX < 0 || cropX > 100 ||
      cropY < 0 || cropY > 100 ||
      cropWidth < 0 || cropWidth > 100 ||
      cropHeight < 0 || cropHeight > 100
    ) {
      return NextResponse.json(
        { error: "Crop values must be between 0 and 100" },
        { status: 400 }
      );
    }

    // Verify image exists and get its URL
    const { data: imageData, error: imageError } = await supabase
      .from("family_images")
      .select("storage_url")
      .eq("id", imageId)
      .single();

    if (imageError || !imageData) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Get family data and find the node
    const nodes = await getFamilyData();
    const nodeIndex = nodes.findIndex((n: FamilyNode) => n.id === node_id);

    if (nodeIndex === -1) {
      return NextResponse.json(
        { error: "Person not found" },
        { status: 404 }
      );
    }

    // Create avatar crop data
    // Note: croppedUrl is generated client-side using CSS or canvas
    // We store the crop parameters so the UI can apply them
    const avatar: AvatarCrop = {
      imageId,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      // The actual cropped URL will be the original image URL
      // The client will apply CSS object-position/object-fit based on crop params
      croppedUrl: imageData.storage_url,
    };

    // Update the node with the avatar
    nodes[nodeIndex] = {
      ...nodes[nodeIndex],
      avatar,
    };

    // Save to database
    await updateFamilyData(nodes);

    return NextResponse.json({
      success: true,
      avatar,
    });
  } catch (error) {
    console.error("Error in POST /api/images/[id]/crop:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/images/[id]/crop - Remove avatar from a person
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get("node_id");

    if (!nodeId) {
      return NextResponse.json(
        { error: "node_id query parameter is required" },
        { status: 400 }
      );
    }

    // Get family data and find the node
    const nodes = await getFamilyData();
    const nodeIndex = nodes.findIndex((n: FamilyNode) => n.id === nodeId);

    if (nodeIndex === -1) {
      return NextResponse.json(
        { error: "Person not found" },
        { status: 404 }
      );
    }

    // Remove avatar from node
    const { avatar: _, ...nodeWithoutAvatar } = nodes[nodeIndex];
    nodes[nodeIndex] = nodeWithoutAvatar as FamilyNode;

    // Save to database
    await updateFamilyData(nodes);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/images/[id]/crop:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
