-- Storage buckets and policies for chat attachments
-- Buckets:
-- 1) chat-attachments (private) for room-restricted files
-- 2) chat-public (optional) if fans/public posts need public assets

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-public', 'chat-public', true)
on conflict (id) do nothing;

-- Helper to ensure a user is a member of the chatroom for the given object path.
-- Expected object path format: {chatroomId}/{userId}/{filename}
create or replace function public.is_member_for_object(object_name text)
returns boolean
language sql
as $$
  select exists (
    select 1
    from public.chatroom_members m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and object_name like (m.chatroom_id::text || '/%')
  );
$$;

-- chat-attachments policies (private)
-- Upload: authenticated and member of chatroom (path must start with chatroom_id/)
create policy "chat-attachments upload by members"
on storage.objects for insert
with check (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and public.is_member_for_object(name)
);

-- Read: members of the chatroom
create policy "chat-attachments read by members"
on storage.objects for select
using (
  bucket_id = 'chat-attachments'
  and (
    public.is_member_for_object(name)
    or auth.role() = 'service_role'
  )
);

-- chat-public policies (public, for shareable fans content if needed)
create policy "chat-public read for all"
on storage.objects for select
using (bucket_id = 'chat-public');

create policy "chat-public upload by authenticated"
on storage.objects for insert
with check (bucket_id = 'chat-public' and auth.role() = 'authenticated');

-- NOTE: enforce file size limits and MIME checks in application layer.

