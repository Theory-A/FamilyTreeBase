-- Canonical bootstrap for a fresh Supabase project.
-- Safe to re-run.

create extension if not exists pgcrypto;

-- =========================
-- family_tree
-- =========================
create table if not exists public.family_tree (
  id integer primary key,
  data jsonb not null default '[]'::jsonb
);

insert into public.family_tree (id, data)
values (1, '[]'::jsonb)
on conflict (id) do nothing;

alter table public.family_tree enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_tree' and policyname = 'family_tree_select'
  ) then
    create policy family_tree_select on public.family_tree
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_tree' and policyname = 'family_tree_insert'
  ) then
    create policy family_tree_insert on public.family_tree
      for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_tree' and policyname = 'family_tree_update'
  ) then
    create policy family_tree_update on public.family_tree
      for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_tree' and policyname = 'family_tree_delete'
  ) then
    create policy family_tree_delete on public.family_tree
      for delete
      using (true);
  end if;
end
$$;

-- =========================
-- family_images
-- =========================
create table if not exists public.family_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  storage_url text not null,
  thumbnail_url text,
  tagged_node_ids text[] not null default '{}',
  caption text,
  date_taken date,
  is_approximate_date boolean default false,
  uploaded_at timestamptz default now(),
  width integer,
  height integer,
  file_size integer,
  mime_type text,
  constraint family_images_tagged_node_ids_not_empty
    check (array_length(tagged_node_ids, 1) > 0)
);

create index if not exists idx_family_images_tags
  on public.family_images using gin (tagged_node_ids);
create index if not exists idx_family_images_uploaded_at
  on public.family_images (uploaded_at desc);
create index if not exists idx_family_images_date_taken
  on public.family_images (date_taken desc nulls last);

alter table public.family_images enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_images' and policyname = 'family_images_select'
  ) then
    create policy family_images_select on public.family_images
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_images' and policyname = 'family_images_insert'
  ) then
    create policy family_images_insert on public.family_images
      for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_images' and policyname = 'family_images_update'
  ) then
    create policy family_images_update on public.family_images
      for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_images' and policyname = 'family_images_delete'
  ) then
    create policy family_images_delete on public.family_images
      for delete
      using (true);
  end if;
end
$$;

-- =========================
-- source_documents
-- =========================
create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  storage_url text not null,
  thumbnail_url text,
  title text not null,
  document_date date,
  is_approximate_date boolean default false,
  source_notes text,
  source_location text,
  width integer,
  height integer,
  file_size integer,
  mime_type text,
  uploaded_at timestamptz default now()
);

create index if not exists idx_source_documents_uploaded_at
  on public.source_documents (uploaded_at desc);
create index if not exists idx_source_documents_document_date
  on public.source_documents (document_date desc nulls last);

alter table public.source_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_documents' and policyname = 'source_documents_select'
  ) then
    create policy source_documents_select on public.source_documents
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_documents' and policyname = 'source_documents_insert'
  ) then
    create policy source_documents_insert on public.source_documents
      for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_documents' and policyname = 'source_documents_update'
  ) then
    create policy source_documents_update on public.source_documents
      for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'source_documents' and policyname = 'source_documents_delete'
  ) then
    create policy source_documents_delete on public.source_documents
      for delete
      using (true);
  end if;
end
$$;

-- =========================
-- Storage bucket + policies
-- =========================
insert into storage.buckets (id, name, public)
values ('family-images', 'family-images', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'family_images_bucket_select_anon'
  ) then
    create policy family_images_bucket_select_anon on storage.objects
      for select
      to anon
      using (bucket_id = 'family-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'family_images_bucket_insert_anon'
  ) then
    create policy family_images_bucket_insert_anon on storage.objects
      for insert
      to anon
      with check (bucket_id = 'family-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'family_images_bucket_update_anon'
  ) then
    create policy family_images_bucket_update_anon on storage.objects
      for update
      to anon
      using (bucket_id = 'family-images')
      with check (bucket_id = 'family-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'family_images_bucket_delete_anon'
  ) then
    create policy family_images_bucket_delete_anon on storage.objects
      for delete
      to anon
      using (bucket_id = 'family-images');
  end if;
end
$$;
