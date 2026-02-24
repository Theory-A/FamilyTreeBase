#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const requiredEnv = [
  "FAMILY_PASSWORD",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error("Missing required environment variables:");
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

async function checkTable(tableName) {
  const { error } = await supabase.from(tableName).select("*").limit(1);
  if (error) {
    throw new Error(`${tableName}: ${error.message}`);
  }
}

async function verifyFamilyTreeRow() {
  const { data, error } = await supabase
    .from("family_tree")
    .select("id, data")
    .eq("id", 1)
    .single();

  if (error) {
    throw new Error(`family_tree row id=1: ${error.message}`);
  }

  if (!Array.isArray(data?.data)) {
    throw new Error("family_tree row id=1 has invalid data shape. Expected JSON array.");
  }
}

async function checkBucket() {
  const { error } = await supabase.storage.from("family-images").list("", { limit: 1 });
  if (error) {
    throw new Error(`storage bucket family-images: ${error.message}`);
  }
}

async function main() {
  try {
    await checkTable("family_tree");
    await checkTable("family_images");
    await checkTable("source_documents");
    await verifyFamilyTreeRow();
    await checkBucket();

    console.log("Setup verification passed.");
    console.log("- Environment variables present");
    console.log("- family_tree, family_images, source_documents reachable");
    console.log("- family_tree row id=1 exists with JSON array data");
    console.log("- family-images storage bucket reachable");
  } catch (error) {
    console.error("Setup verification failed:");
    console.error(`- ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
