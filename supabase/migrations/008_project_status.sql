-- Add 'project' to allowed status values and set default to 'project'

-- 1. Drop the existing check constraint
alter table public.projects drop constraint if exists projects_status_check;

-- 2. Add new check constraint with 'project' included, and set default
alter table public.projects
  alter column status set default 'project',
  add constraint projects_status_check check (status in ('project','planning','in-progress','review','completed','archived'));