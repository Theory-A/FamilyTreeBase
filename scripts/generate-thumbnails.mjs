/**
 * Migration script to generate thumbnails for existing images
 * Run with: node --env-file=.env.local scripts/generate-thumbnails.mjs
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = "family-images";
const THUMB_SIZE = 200;
const THUMB_QUALITY = 70;

async function generateThumbnails() {
  console.log("Fetching images without thumbnails...\n");

  // Get all images without thumbnails
  const { data: images, error } = await supabase
    .from("family_images")
    .select("id, storage_path, storage_url")
    .is("thumbnail_url", null);

  if (error) {
    console.error("Error fetching images:", error);
    process.exit(1);
  }

  console.log(`Found ${images.length} images without thumbnails.\n`);

  let success = 0;
  let failed = 0;

  for (const image of images) {
    const { id, storage_path, storage_url } = image;
    console.log(`Processing: ${storage_path}`);

    try {
      // Fetch the original image
      const response = await fetch(storage_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());

      // Generate thumbnail with sharp
      const thumbnail = await sharp(buffer)
        .resize(THUMB_SIZE, THUMB_SIZE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: THUMB_QUALITY })
        .toBuffer();

      // Generate thumbnail path
      const thumbPath = storage_path.replace(/\.[^.]+$/, "_thumb.jpg");

      // Upload thumbnail to storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(thumbPath, thumbnail, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL for thumbnail
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(thumbPath);

      // Update database with thumbnail URL
      const { error: updateError } = await supabase
        .from("family_images")
        .update({ thumbnail_url: urlData.publicUrl })
        .eq("id", id);

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`);
      }

      console.log(`  -> Created: ${thumbPath} (${(thumbnail.length / 1024).toFixed(1)} KB)`);
      success++;
    } catch (err) {
      console.error(`  -> ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
}

generateThumbnails();
