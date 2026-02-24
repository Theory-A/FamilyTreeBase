import { createClient } from "@supabase/supabase-js";

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configuredSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const requiredSupabaseEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export const supabaseNotConfiguredMessage =
  "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.";

export const isSupabaseConfigured = Boolean(
  configuredSupabaseUrl && configuredSupabaseAnonKey
);

// Use harmless local placeholders when env vars are missing so app boot does not crash.
const fallbackSupabaseUrl = "http://127.0.0.1:54321";
const fallbackSupabaseAnonKey = "preview-anon-key";

const supabaseUrl = configuredSupabaseUrl ?? fallbackSupabaseUrl;
const supabaseAnonKey = configuredSupabaseAnonKey ?? fallbackSupabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Storage bucket name for family images
export const IMAGES_BUCKET = "family-images";

/**
 * Generate a unique storage path for an uploaded image
 */
export function generateImagePath(filename: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = filename.split(".").pop() || "jpg";
  return `images/${timestamp}-${randomSuffix}.${extension}`;
}

/**
 * Get the public URL for an image in storage
 */
export function getImageUrl(storagePath: string): string {
  if (!isSupabaseConfigured) {
    return storagePath;
  }

  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Upload an image to Supabase storage
 */
export async function uploadImage(
  file: File | Blob,
  path: string
): Promise<{ path: string; url: string } | { error: string }> {
  if (!isSupabaseConfigured) {
    return { error: supabaseNotConfiguredMessage };
  }

  const { data, error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    return { error: error.message };
  }

  return {
    path: data.path,
    url: getImageUrl(data.path),
  };
}

/**
 * Delete an image from Supabase storage
 */
export async function deleteImage(path: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: supabaseNotConfiguredMessage };
  }

  const { error } = await supabase.storage.from(IMAGES_BUCKET).remove([path]);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
