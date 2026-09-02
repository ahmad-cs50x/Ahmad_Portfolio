-- ============================================================
-- 002 — Invite-gated sign-in
--
-- Sign-in is no longer open. lib/auth.js refuses any email that does not have
-- an invite row that is accepted (or acceptable), and that applies to Google
-- as well as the email link — otherwise "invite only" would be decorative,
-- since anyone with a Google account could walk in.
--
-- Re-runnable: every statement is guarded.
-- ============================================================

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),

  -- Always stored lowercase. lib/invites.js normalizes before writing, and the
  -- sign-in gate lowercases before comparing, so the two can't disagree.
  email text not null,

  -- Only the SHA-256 of the invite token is stored. A leaked database therefore
  -- does not hand out working invite links.
  token_hash text not null unique,

  role text not null default 'CLIENT' check (role in ('CLIENT', 'SUPER_ADMIN')),

  -- Optional: attach the invitee to an existing client workspace. When null,
  -- accepting the invite creates a fresh client row named after company_name.
  client_id uuid references public.clients(id) on delete set null,
  company_name text,

  invited_by uuid references public.profiles(id) on delete set null,
  note text,

  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  last_sent_at timestamptz,
  send_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists invites_email_idx on public.invites (lower(email));
create index if not exists invites_token_idx on public.invites (token_hash);

-- At most one *live* invite per address. Accepted or revoked rows are excluded
-- from the constraint, so re-inviting someone later is still allowed.
create unique index if not exists invites_one_pending_per_email
  on public.invites (lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.invites enable row level security;
-- No policy is created on purpose: invites are reachable only through the
-- service-role key in /api/invites, never from the browser's anon key.
