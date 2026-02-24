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

// Helper to sync partner bidirectionality for a single node
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

// PUT - Batch update multiple nodes
export async function PUT(request: Request) {
  try {
    // Verify auth
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { nodes: updatedNodes } = body as {
      nodes: FamilyNode[];
      expectedVersions?: Record<string, number>;
    };

    if (!updatedNodes || !Array.isArray(updatedNodes) || updatedNodes.length === 0) {
      return NextResponse.json(
        { error: "No nodes provided for update" },
        { status: 400 }
      );
    }

    // Validate all nodes have required fields
    for (const node of updatedNodes) {
      if (!node.names?.primary_zh) {
        return NextResponse.json(
          { error: `Node ${node.id}: primary_zh is required` },
          { status: 400 }
        );
      }
      if (!node.gender) {
        return NextResponse.json(
          { error: `Node ${node.id}: gender is required` },
          { status: 400 }
        );
      }
    }

    // Get current data
    let nodes = await getFamilyData();

    // Track old partner IDs for each updated node (for bidirectionality sync)
    const oldPartnerIdsMap = new Map<string, string[]>();
    for (const updatedNode of updatedNodes) {
      const existingNode = nodes.find((n) => n.id === updatedNode.id);
      if (existingNode) {
        oldPartnerIdsMap.set(
          updatedNode.id,
          (existingNode.partner_ids || []).map((ref) => getLinkId(ref))
        );
      }
    }

    // Apply all node updates
    for (const updatedNode of updatedNodes) {
      const existingIndex = nodes.findIndex((n) => n.id === updatedNode.id);
      if (existingIndex === -1) {
        return NextResponse.json(
          { error: `Node ${updatedNode.id} not found` },
          { status: 404 }
        );
      }
      nodes[existingIndex] = updatedNode;
    }

    // Sync partner bidirectionality for all updated nodes
    for (const updatedNode of updatedNodes) {
      const oldPartnerIds = oldPartnerIdsMap.get(updatedNode.id) || [];
      nodes = syncPartnerBidirectionality(nodes, updatedNode, oldPartnerIds);
    }

    // Clean up empty partner_ids arrays
    nodes = nodes.map((n) => {
      if (n.partner_ids && n.partner_ids.length === 0) {
        const { partner_ids, ...rest } = n;
        return rest as FamilyNode;
      }
      return n;
    });

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

    // Return the complete updated nodes array
    return NextResponse.json({ success: true, nodes });
  } catch (error) {
    console.error("Error in batch update:", error);
    return NextResponse.json(
      { error: "Failed to update nodes" },
      { status: 500 }
    );
  }
}
