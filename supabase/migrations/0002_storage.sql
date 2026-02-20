-- First, drop existing storage policies to start fresh
drop policy if exists "chat-attachments upload by members" on storage.objects;
drop policy if exists "chat-attachments read by members" on storage.objects;
drop policy if exists "chat-public read for all" on storage.objects;
drop policy if exists "chat-public upload by authenticated" on storage.objects;
drop policy if exists "chat_uploads for members" on public.chat_uploads;

-- Ensure buckets exist
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-public', 'chat-public', true)
on conflict (id) do nothing;

-- Helper function to extract chatroom_id from storage object path
-- Expected format: {chatroom_id}/{user_id}/{filename}
create or replace function public.get_chatroom_id_from_path(path text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(path, '/', 1), '')::uuid;
$$;

-- CHAT-ATTACHMENTS BUCKET POLICIES (Private)

-- Upload policy: Only authenticated members of the chatroom can upload
create policy "chat-attachments upload by members"
on storage.objects for insert
with check (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and public.is_chat_member(
    public.get_chatroom_id_from_path(name),
    auth.uid()
  )
);

-- Select/Read policy: Only members of the chatroom can view files
create policy "chat-attachments read by members"
on storage.objects for select
using (
  bucket_id = 'chat-attachments'
  and (
    public.is_chat_member(
      public.get_chatroom_id_from_path(name),
      auth.uid()
    )
    or auth.role() = 'service_role'
  )
);

-- Update policy: Only members can update their own files (optional)
create policy "chat-attachments update by owners"
on storage.objects for update
using (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and public.is_chat_member(
    public.get_chatroom_id_from_path(name),
    auth.uid()
  )
  -- Optional: Ensure user can only update their own files
  and split_part(name, '/', 2) = auth.uid()::text
);

-- Delete policy: Only members can delete their own files
create policy "chat-attachments delete by owners"
on storage.objects for delete
using (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and public.is_chat_member(
    public.get_chatroom_id_from_path(name),
    auth.uid()
  )
  and split_part(name, '/', 2) = auth.uid()::text
);

-- CHAT-PUBLIC BUCKET POLICIES (Public)

-- Read: Anyone can read from public bucket
create policy "chat-public read for all"
on storage.objects for select
using (bucket_id = 'chat-public');

-- Upload: Authenticated users can upload to public bucket
create policy "chat-public upload by authenticated"
on storage.objects for insert
with check (
  bucket_id = 'chat-public' 
  and auth.role() = 'authenticated'
);

-- Optional: Users can only update/delete their own public files
create policy "chat-public update by owner"
on storage.objects for update
using (
  bucket_id = 'chat-public'
  and auth.role() = 'authenticated'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "chat-public delete by owner"
on storage.objects for delete
using (
  bucket_id = 'chat-public'
  and auth.role() = 'authenticated'
  and split_part(name, '/', 1) = auth.uid()::text
);