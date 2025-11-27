create table if not exists ai_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete set null,
  context text not null,
  title text not null,
  layout text not null,
  filters jsonb not null default '[]'::jsonb,
  sorts jsonb not null default '[]'::jsonb,
  visible_properties jsonb not null default '[]'::jsonb,
  layout_options jsonb,
  metadata jsonb,
  signature text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_views_signature_idx on ai_views(signature);
create index if not exists ai_views_context_idx on ai_views(context);
