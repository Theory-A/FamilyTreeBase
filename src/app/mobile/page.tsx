import { Metadata } from "next";
import { MobileFamilyTree } from "@/components";
import {
  supabase,
  isSupabaseConfigured,
  requiredSupabaseEnvVars,
} from "@/lib/supabase";
import { PREVIEW_FAMILY_DATA } from "@/lib/preview-data";
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
  if (!isSupabaseConfigured) {
    return PREVIEW_FAMILY_DATA;
  }

  try {
    const { data, error } = await supabase
      .from("family_tree")
      .select("data")
      .eq("id", 1)
      .single();

    if (error) throw error;
    return data.data as FamilyTreeData;
  } catch (error) {
    console.error("Failed to load mobile family data, using preview data:", error);
    return PREVIEW_FAMILY_DATA;
  }
}

export default async function MobilePage() {
  const nodes = await getFamilyData();
  const backendConfigured = isSupabaseConfigured;

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {!backendConfigured && (
        <section className="mx-auto max-w-7xl px-4 pt-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
            <p className="text-sm font-semibold">
              Preview mode: backend is not connected.
            </p>
            <p className="mt-1 text-sm">
              The mobile UI is rendering sample data. To connect real data, add these variables
              to
              <code className="mx-1 rounded bg-amber-100 px-1 py-0.5">.env.local</code>:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs sm:text-sm">
              {requiredSupabaseEnvVars.map((envVar) => (
                <li key={envVar}>
                  <code>{envVar}</code>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <MobileFamilyTree nodes={nodes} />
    </main>
  );
}
