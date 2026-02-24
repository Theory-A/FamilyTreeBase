-- Migration: Create family_images table for storing image metadata
-- Run this in the Supabase SQL editor

-- Create the family_images table
CREATE TABLE IF NOT EXISTS family_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  thumbnail_url TEXT,
  tagged_node_ids TEXT[] NOT NULL DEFAULT '{}',
  caption TEXT,
  date_taken DATE,
  is_approximate_date BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  mime_type TEXT,
  CONSTRAINT tagged_node_ids_not_empty CHECK (array_length(tagged_node_ids, 1) > 0)
);

-- Create GIN index for efficient tag-based lookups
CREATE INDEX IF NOT EXISTS idx_family_images_tags ON family_images USING GIN (tagged_node_ids);

-- Create index on uploaded_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_family_images_uploaded_at ON family_images (uploaded_at DESC);

-- Create index on date_taken for historical queries
CREATE INDEX IF NOT EXISTS idx_family_images_date_taken ON family_images (date_taken DESC NULLS LAST);

-- Enable Row Level Security
ALTER TABLE family_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for family_images table
-- Note: Since this app uses a simple password-based auth stored in cookies,
-- we'll allow all operations. For more secure apps, you'd want proper user-based RLS.

-- Allow all authenticated reads (our auth is cookie-based, so this allows reads)
CREATE POLICY "Allow read access" ON family_images
  FOR SELECT
  USING (true);

-- Allow inserts
CREATE POLICY "Allow insert access" ON family_images
  FOR INSERT
  WITH CHECK (true);

-- Allow updates
CREATE POLICY "Allow update access" ON family_images
  FOR UPDATE
  USING (true);

-- Allow deletes
CREATE POLICY "Allow delete access" ON family_images
  FOR DELETE
  USING (true);

-- Storage bucket setup (run separately in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('family-images', 'family-images', false)
-- ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies (these need to be set up in Supabase dashboard)
-- CREATE POLICY "Auth users can upload" ON storage.objects
--   FOR INSERT TO authenticated WITH CHECK (bucket_id = 'family-images');
-- CREATE POLICY "Auth users can view" ON storage.objects
--   FOR SELECT TO authenticated USING (bucket_id = 'family-images');
-- CREATE POLICY "Auth users can delete" ON storage.objects
--   FOR DELETE TO authenticated USING (bucket_id = 'family-images');
