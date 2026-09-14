create table public.knowledge_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.knowledge_categories to authenticated;
grant all on public.knowledge_categories to service_role;

alter table public.knowledge_categories enable row level security;

create policy "Staff can read knowledge categories"
  on public.knowledge_categories for select to authenticated using (true);
create policy "Admins can insert knowledge categories"
  on public.knowledge_categories for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update knowledge categories"
  on public.knowledge_categories for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete knowledge categories"
  on public.knowledge_categories for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger knowledge_categories_set_updated_at
  before update on public.knowledge_categories
  for each row execute function public.set_updated_at();

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.knowledge_categories(id) on delete set null,
  title text not null,
  summary text,
  kind text not null default 'article' check (kind in ('article', 'file', 'embed')),
  body text,
  file_path text,
  file_name text,
  file_type text,
  file_size bigint,
  embed_url text,
  provider text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_items_category_idx on public.knowledge_items (category_id, sort_order);

grant select, insert, update, delete on public.knowledge_items to authenticated;
grant all on public.knowledge_items to service_role;

alter table public.knowledge_items enable row level security;

create policy "Staff can read published knowledge items"
  on public.knowledge_items for select to authenticated
  using (published or public.has_role(auth.uid(), 'admin'));
create policy "Admins can insert knowledge items"
  on public.knowledge_items for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update knowledge items"
  on public.knowledge_items for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete knowledge items"
  on public.knowledge_items for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger knowledge_items_set_updated_at
  before update on public.knowledge_items
  for each row execute function public.set_updated_at();

create policy "Staff can read knowledge assets"
  on storage.objects for select to authenticated
  using (bucket_id = 'knowledge-assets');
create policy "Admins can upload knowledge assets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'knowledge-assets' and public.has_role(auth.uid(), 'admin'));
create policy "Admins can replace knowledge assets"
  on storage.objects for update to authenticated
  using (bucket_id = 'knowledge-assets' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'knowledge-assets' and public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete knowledge assets"
  on storage.objects for delete to authenticated
  using (bucket_id = 'knowledge-assets' and public.has_role(auth.uid(), 'admin'));