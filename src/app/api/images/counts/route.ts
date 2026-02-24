import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

// Helper to verify authentication
async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("family-auth");
  return authCookie?.value === "authenticated";
}

// GET /api/images/counts - Get image counts per node
export async function GET() {
  const isAuthenticated = await verifyAuth();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all tagged_node_ids arrays from images
    const { data, error } = await supabase
      .from("family_images")
      .select("tagged_node_ids");

    if (error) throw error;

    // Count images per node
    const counts: Record<string, number> = {};

    for (const row of data || []) {
      const nodeIds = row.tagged_node_ids || [];
      for (const nodeId of nodeIds) {
        counts[nodeId] = (counts[nodeId] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      counts,
    });
  } catch (error) {
    console.error("Error fetching image counts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch image counts" },
      { status: 500 }
    );
  }
}
