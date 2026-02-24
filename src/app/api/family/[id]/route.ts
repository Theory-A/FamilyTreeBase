import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { FamilyNode, FamilyTreeData } from "@/types/family";
import {
  validateParentRefsExist,
  validateNoCircularRefs,
  validateBidirectionalPartners,
  getLinkId,
} from "@/lib/validation";

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

// Helper to sync partner bidirectionality after update
function syncPartnerBidirectionality(
  nodes: FamilyTreeData,
  updatedNode: FamilyNode,
  oldPartnerIds: string[]
): FamilyTreeData {
  let result = [...nodes];
  const newPartnerIds = (updatedNode.partner_ids || []).map((ref) =>
    getLinkId(ref)
  );

  // Remove this node from old partners that are no longer partners
  const removedPartners = oldPartnerIds.filter((id) => !newPartnerIds.includes(id));
  for (const partnerId of removedPartners) {
    result = result.map((n) => {
      if (n.id === partnerId) {
        return {
          ...n,
          partner_ids: (n.partner_ids || []).filter(
            (ref) => getLinkId(ref) !== updatedNode.id
          ),
        };
      }
      return n;
    });
  }

  // Add this node to new partners
  const addedPartners = newPartnerIds.filter((id) => !oldPartnerIds.includes(id));
  for (const partnerId of addedPartners) {
    result = result.map((n) => {
      if (n.id === partnerId) {
        const existingPartnerIds = (n.partner_ids || []).map((ref) =>
          getLinkId(ref)
        );
        if (!existingPartnerIds.includes(updatedNode.id)) {
          return {
            ...n,
            partner_ids: [...(n.partner_ids || []), updatedNode.id],
          };
        }
      }
      return n;
    });
  }

  return result;
}

// PUT - Update a node
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify auth
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { node } = body as { node: FamilyNode };

    // Validate that the ID matches
    if (node.id !== id) {
      return NextResponse.json(
        { error: "Node ID mismatch" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!node.names?.primary_zh) {
      return NextResponse.json(
        { error: "primary_zh is required" },
        { status: 400 }
      );
    }

    if (!node.gender) {
      return NextResponse.json({ error: "gender is required" }, { status: 400 });
    }

    // Get current data
    let nodes = await getFamilyData();

    // Find the existing node
    const existingIndex = nodes.findIndex((n) => n.id === id);
    if (existingIndex === -1) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    const existingNode = nodes[existingIndex];
    const oldPartnerIds = (existingNode.partner_ids || []).map((ref) =>
      getLinkId(ref)
    );

    // Replace the node
    nodes[existingIndex] = node;

    // Handle partner bidirectionality changes
    nodes = syncPartnerBidirectionality(nodes, node, oldPartnerIds);

    // Validate the updated data
    const parentErrors = validateParentRefsExist(nodes);
    if (parentErrors.length > 0) {
      return NextResponse.json(
        { error: "Invalid parent references", details: parentErrors },
        { status: 400 }
      );
    }

    const circularErrors = validateNoCircularRefs(nodes);
    if (circularErrors.length > 0) {
      return NextResponse.json(
        { error: "Circular reference detected", details: circularErrors },
        { status: 400 }
      );
    }

    const partnerErrors = validateBidirectionalPartners(nodes);
    if (partnerErrors.length > 0) {
      return NextResponse.json(
        { error: "Partner link validation failed", details: partnerErrors },
        { status: 400 }
      );
    }

    // Save to database
    await updateFamilyData(nodes);

    return NextResponse.json({ success: true, node });
  } catch (error) {
    console.error("Error updating node:", error);
    return NextResponse.json(
      { error: "Failed to update node" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a node
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify auth
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get current data
    let nodes = await getFamilyData();

    // Find the node to delete
    const nodeToDelete = nodes.find((n) => n.id === id);
    if (!nodeToDelete) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    // Remove this node from any partner's partner_ids
    const partnerIds = (nodeToDelete.partner_ids || []).map((ref) => getLinkId(ref));
    for (const partnerId of partnerIds) {
      nodes = nodes.map((n) => {
        if (n.id === partnerId) {
          return {
            ...n,
            partner_ids: (n.partner_ids || []).filter(
              (ref) => getLinkId(ref) !== id
            ),
          };
        }
        return n;
      });
    }

    // Remove this node from any child's parent_ids
    nodes = nodes.map((n) => {
      if (n.parent_ids?.some((ref) => getLinkId(ref) === id)) {
        return {
          ...n,
          parent_ids: n.parent_ids.filter((ref) => getLinkId(ref) !== id),
        };
      }
      return n;
    });

    // Clean up empty parent_ids arrays
    nodes = nodes.map((n) => {
      if (n.parent_ids && n.parent_ids.length === 0) {
        const { parent_ids, ...rest } = n;
        return rest as FamilyNode;
      }
      return n;
    });

    // Clean up empty partner_ids arrays
    nodes = nodes.map((n) => {
      if (n.partner_ids && n.partner_ids.length === 0) {
        const { partner_ids, ...rest } = n;
        return rest as FamilyNode;
      }
      return n;
    });

    // Remove the node itself
    nodes = nodes.filter((n) => n.id !== id);

    // Save to database
    await updateFamilyData(nodes);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting node:", error);
    return NextResponse.json(
      { error: "Failed to delete node" },
      { status: 500 }
    );
  }
}

// GET - Fetch a single node
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const nodes = await getFamilyData();
    const node = nodes.find((n) => n.id === id);

    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    return NextResponse.json({ node });
  } catch (error) {
    console.error("Error fetching node:", error);
    return NextResponse.json(
      { error: "Failed to fetch node" },
      { status: 500 }
    );
  }
}
