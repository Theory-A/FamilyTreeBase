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

// Helper to generate a UUID
function generateId(): string {
  return crypto.randomUUID();
}

// Helper to ensure bidirectional partner links
function ensureBidirectionalPartners(
  nodes: FamilyTreeData,
  nodeId: string,
  partnerIds: string[]
): FamilyTreeData {
  const updatedNodes = [...nodes];

  for (const partnerId of partnerIds) {
    const partnerIndex = updatedNodes.findIndex((n) => n.id === partnerId);
    if (partnerIndex === -1) continue;

    const partner = updatedNodes[partnerIndex];
    const existingPartnerIds = (partner.partner_ids || []).map((ref) =>
      getLinkId(ref)
    );

    // If nodeId is not already in partner's partner_ids, add it
    if (!existingPartnerIds.includes(nodeId)) {
      updatedNodes[partnerIndex] = {
        ...partner,
        partner_ids: [...(partner.partner_ids || []), nodeId],
      };
    }
  }

  return updatedNodes;
}

// POST - Create a new node
export async function POST(request: Request) {
  try {
    // Verify auth
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { node, childrenToLink = [] } = body as {
      node: Omit<FamilyNode, "id">;
      childrenToLink?: string[];
    };

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

    // Generate ID for new node
    const newId = generateId();
    const newNode: FamilyNode = {
      ...node,
      id: newId,
    };

    // Add the new node
    nodes.push(newNode);

    // Update children to have this node as parent
    if (childrenToLink.length > 0) {
      nodes = nodes.map((n) => {
        if (childrenToLink.includes(n.id)) {
          return {
            ...n,
            parent_ids: [...(n.parent_ids || []), newId],
          };
        }
        return n;
      });
    }

    // Handle partner bidirectionality
    const partnerIds = (newNode.partner_ids || []).map((ref) => getLinkId(ref));
    if (partnerIds.length > 0) {
      nodes = ensureBidirectionalPartners(nodes, newId, partnerIds);
    }

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

    return NextResponse.json({ success: true, id: newId, node: newNode });
  } catch (error) {
    console.error("Error creating node:", error);
    return NextResponse.json(
      { error: "Failed to create node" },
      { status: 500 }
    );
  }
}

// GET - Fetch all nodes (for client-side data fetching)
export async function GET() {
  try {
    if (!(await verifyAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nodes = await getFamilyData();
    return NextResponse.json({ nodes });
  } catch (error) {
    console.error("Error fetching nodes:", error);
    return NextResponse.json(
      { error: "Failed to fetch nodes" },
      { status: 500 }
    );
  }
}
