# WSF Chatrooms Migration - Remaining Work

## Data & Auth
- Wire PSA/NSA country validation against association records (country_code match).
- Seed baseline chatrooms (fans, students, club owners, committee) via migration or startup script.
- Backfill/migrate Firebase users to Supabase (mapping UIDs to auth.users) — upstream process noted.

## Storage & Files
- Create buckets in Supabase: `chat-attachments` (private) and `chat-public` (optional). Apply policies from `supabase/migrations/0002_storage.sql`.
- Enforce server-side size/type validation on uploads; consider antivirus/scanning if needed.
- Add per-room download rules in UI (private vs public).

## Messaging & Realtime
- Add optimistic UI for sends and a toast system (replace alert) using shadcn/ui.
- Support message edits/deletes with RLS updates (owner or moderator) and UI controls.
- Add pagination/infinite scroll for messages and an unread/mention badge pattern.

## Translation
- Integrate translation API on message insert; store `translated_content` keyed by language.
- UI toggles for language selection per user; cache translations per message.

## UI/UX Polish
- Replace remaining ad-hoc styles with shadcn primitives (inputs, alerts, toasts, skeletons).
- Add loading/empty/error states to discovery and chat pages.
- Add profile/avatar display and presence indicators (Supabase Realtime presence if desired).

## Policies & Roles
- Extend RLS to allow message edits/deletes for authors; moderators/admins can moderate.
- Add moderator/owner roles in `chatroom_members`; expose assignment flow (service role).
- Ensure PSA/NSA creation/joins require association membership in the specified country.

## Routes & Navigation
- Add chatroom index/list page for joined rooms; redirect to fans by default if none.
- Add shareable public view for fans posts (read-only) using `chat-public` when applicable.

## Testing & Ops
- Add e2e coverage for join flow and messaging (Playwright/Cypress).
- Add unit tests for eligibility logic and join API.
- Set up lint/format/test in CI; add preview deploy to Vercel with Supabase envs.
- Document environment variables (`env.example`) and deploy steps (Vercel + Supabase).

