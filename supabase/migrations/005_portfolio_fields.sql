-- Add portfolio display fields to projects table
-- tech_stack: comma-separated list of technologies
-- cover_image: URL to project screenshot/hero image
-- featured: whether to highlight the project
-- gradient_index: unique gradient color index (0-7)

alter table public.projects
  add column if not exists tech_stack text,
  add column if not exists cover_image text,
  add column if not exists featured boolean not null default false,
  add column if not exists gradient_index integer not null default 0;
