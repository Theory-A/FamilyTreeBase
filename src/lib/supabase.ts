import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
  const { error } = await supabase.storage.from(IMAGES_BUCKET).remove([path]);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
