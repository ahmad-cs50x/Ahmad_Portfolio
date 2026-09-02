-- ============================================================
-- Ahmad Portfolio — Initial schema (Supabase PostgreSQL)
-- All timestamps are stored in UTC (timestamptz).
-- Run this in the Supabase SQL editor or via the Supabase CLI.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Auth.js (next-auth v4) tables — column names match adapter
-- ------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key,
  name text,
  email text unique,
  "emailVerified" timestamptz,
  image text
);

create table if not exists public.accounts (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade deferrable initially deferred,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  unique (provider, "providerAccountId")
);

create table if not exists public.sessions (
  id uuid primary key,
  "sessionToken" text unique not null,
  user_id uuid not null references public.users(id) on delete cascade deferrable initially deferred,
  expires timestamptz not null
);

create table if not exists public.verification_tokens (
  identifier text not null,
  token text unique not null,
  expires timestamptz not null,
  primary key (identifier, token)
);

create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists sessions_user_id_idx on public.sessions(user_id);

-- ------------------------------------------------------------
-- Core application tables
-- ------------------------------------------------------------

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_email text,
  storage_limit bigint not null default 5368709120,          -- 5 GB
  storage_used bigint not null default 0,
  no_portal_limit boolean not null default false,            -- admin-controlled override
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  avatar_url text,
  role text not null default 'CLIENT' check (role in ('SUPER_ADMIN','CLIENT')),
  client_id uuid references public.clients(id) on delete set null,
  timezone text not null default 'Asia/Karachi',
  created_at timestamptz not null default now()
);
create index if not exists profiles_client_idx on public.profiles(client_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'planning' check (status in ('planning','in-progress','review','completed','archived')),
  progress integer not null default 0 check (progress between 0 and 100),
  live_demo_url text,
  video_explanation_url text,
  source_zip_url text,
  github_url text,
  documentation_url text,
  drive_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_client_idx on public.projects(client_id);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (project_id, profile_id)
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position integer not null default 0,
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists milestones_project_idx on public.milestones(project_id);

-- Files: metadata only — binaries live in Backblaze B2
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,  -- null for site assets (e.g. blog images)
  project_id uuid references public.projects(id) on delete set null,
  file_name text not null,
  file_type text not null default 'application/octet-stream',
  file_size bigint not null default 0,
  storage_provider text not null default 'backblaze-b2',
  storage_path text not null,
  b2_file_id text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  purpose text not null default 'shared' check (purpose in ('shared','message','deliverable','blog','archive')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists files_client_idx on public.files(client_id);
create index if not exists files_project_idx on public.files(project_id);

create table if not exists public.storage_usage (
  id bigint generated always as identity primary key,
  file_id uuid references public.files(id) on delete set null,
  client_id uuid not null,
  delta_bytes bigint not null,
  reason text not null default 'upload' check (reason in ('upload','delete','quota_change','admin_adjust')),
  created_at timestamptz not null default now()
);

-- Messages: async conversations per client (text / audio / video / file)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('SUPER_ADMIN','CLIENT')),
  message_type text not null default 'text' check (message_type in ('text','audio','video','file')),
  body text,
  attachment_id uuid references public.files(id) on delete set null,
  recorded_at timestamptz,
  uploaded_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()   -- sent_at
);
create index if not exists messages_client_created_idx on public.messages(client_id, created_at desc);

create table if not exists public.message_attachments (
  message_id uuid not null references public.messages(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  primary key (message_id, file_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  type text not null default 'message',
  title text not null,
  body text,
  link_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_profile_idx on public.notifications(profile_id, created_at desc);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  client_id uuid references public.clients(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_client_idx on public.activity_logs(client_id, created_at desc);

-- ------------------------------------------------------------
-- Blog
-- ------------------------------------------------------------

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null default '',
  cover_image text,
  category_id uuid references public.blog_categories(id) on delete set null,
  seo_title text,
  seo_description text,
  status text not null default 'draft' check (status in ('draft','published','scheduled','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blog_posts_status_idx on public.blog_posts(status, published_at desc);

create table if not exists public.blog_post_tags (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

-- ------------------------------------------------------------
-- Settings
-- ------------------------------------------------------------

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Triggers & helpers
-- ------------------------------------------------------------

create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists blog_posts_updated_at on public.blog_posts;
create trigger blog_posts_updated_at before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security:
-- The application server always talks to Supabase with the
-- service-role key (which bypasses RLS) after verifying roles
-- and ownership in code. RLS stays ON everywhere so that even
-- leaked anon keys can read nothing by default.
-- ------------------------------------------------------------

alter table public.users enable row level security;
alter table public.accounts enable row level security;
alter table public.sessions enable row level security;
alter table public.verification_tokens enable row level security;
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.files enable row level security;
alter table public.storage_usage enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_tags enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_post_tags enable row level security;
alter table public.settings enable row level security;

-- Public, published blog posts are readable via the anon key.
-- (drop-then-create so this migration stays re-runnable)
drop policy if exists "public read published posts" on public.blog_posts;
create policy "public read published posts" on public.blog_posts
  for select using (status = 'published');

drop policy if exists "public read categories" on public.blog_categories;
create policy "public read categories" on public.blog_categories
  for select using (true);

drop policy if exists "public read tags" on public.blog_tags;
create policy "public read tags" on public.blog_tags
  for select using (true);

drop policy if exists "public read post tags" on public.blog_post_tags;
create policy "public read post tags" on public.blog_post_tags
  for select using (true);
