import { Metadata } from "next";
import { MobileFamilyTree } from "@/components";
import { supabase } from "@/lib/supabase";
import { FamilyTreeData } from "@/types/family";

export const metadata: Metadata = {
  title: "戚氏家谱",
  description: "Qi Family Tree",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "戚氏家谱",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

async function getFamilyData(): Promise<FamilyTreeData> {
  const { data, error } = await supabase
    .from("family_tree")
    .select("data")
    .eq("id", 1)
    .single();

  if (error) throw error;
  return data.data as FamilyTreeData;
}

export default async function MobilePage() {
  const nodes = await getFamilyData();

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <MobileFamilyTree nodes={nodes} />
    </main>
  );
}
