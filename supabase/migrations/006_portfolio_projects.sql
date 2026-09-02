-- Add portfolio project support
-- Make client_id nullable so portfolio projects don't need a client
-- Add is_portfolio flag to distinguish portfolio vs client projects

alter table public.projects
  alter column client_id drop not null,
  add column if not exists is_portfolio boolean not null default false;

-- Index for portfolio queries
create index if not exists projects_portfolio_idx on public.projects(is_portfolio) where is_portfolio = true;