-- Add password column to invites table
alter table public.invites
  add column if not exists password text;