import { FamilyTreeClient } from "@/components";
import { supabase } from "@/lib/supabase";
import { FamilyTreeData } from "@/types/family";

// Disable caching to always fetch fresh data
export const dynamic = "force-dynamic";

async function getFamilyData(): Promise<FamilyTreeData> {
  const { data, error } = await supabase
    .from("family_tree")
    .select("data")
    .eq("id", 1)
    .single();

  if (error) throw error;
  return data.data as FamilyTreeData;
}

export default async function Home() {
  const nodes = await getFamilyData();

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <FamilyTreeClient initialNodes={nodes} />
    </main>
  );
}
