-- Minimal stand-in for what Supabase provides out of the box, so the
-- migration can be validated against plain PostgreSQL. Do NOT run this
-- against an actual Supabase project — it already has a real auth schema.
create extension if not exists "pgcrypto";

create schema if not exists auth;

create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text
);

create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ language sql stable;
