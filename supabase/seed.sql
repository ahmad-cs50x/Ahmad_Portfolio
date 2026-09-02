-- Seed data — run after 001_initial_schema.sql

insert into public.settings (key, value) values
  ('app', '{"siteName":"Ahmad Portfolio","supportEmail":"ahmad@example.com"}'::jsonb)
on conflict (key) do nothing;

insert into public.blog_categories (name, slug) values
  ('General', 'general'),
  ('Tutorials', 'tutorials'),
  ('Case Studies', 'case-studies')
on conflict (slug) do nothing;

-- NOTE:
-- Do NOT manually insert your SUPER_ADMIN here. The first account that
-- signs in becomes SUPER_ADMIN automatically, or list trusted emails in
-- SUPER_ADMIN_EMAILS env var to control it explicitly.
--
-- Example client seed (optional):
-- insert into public.clients (company_name, contact_email, storage_limit)
-- values ('Acme Ltd', 'owner@acme.com', 21474836480); -- 20 GB
