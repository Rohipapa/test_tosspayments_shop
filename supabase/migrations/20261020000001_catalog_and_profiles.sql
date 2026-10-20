-- M1 기반: 회원 프로필, 상품 카탈로그(F-102, F-106, F-204)

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: 본인 조회" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: 본인 수정" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- role 컬럼은 클라이언트가 바꿀 수 없도록 컬럼 단위로 권한을 줍니다.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name, phone) on public.profiles to authenticated;

-- 가입 시 프로필 자동 생성
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ---------- categories ----------
create table public.categories (
  id text primary key,
  name text not null,
  name_en text not null,
  description text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- products ----------
create table public.products (
  id text primary key,
  category_id text not null references public.categories(id),
  brand text not null,
  name text not null,
  price int not null check (price >= 0),
  sale_rate int not null default 0 check (sale_rate between 0 and 100),
  color text not null default '#cccccc',
  image_url text,
  review_count int not null default 0,
  rating numeric(2,1) not null default 0,
  tag text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);

-- ---------- product_sizes ----------
create table public.product_sizes (
  product_id text not null references public.products(id) on delete cascade,
  size text not null,
  stock int not null default 0 check (stock >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, size)
);

-- ---------- RLS: 누구나 읽기, admin만 쓰기 ----------
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_sizes enable row level security;

create policy "categories: 누구나 조회" on public.categories
  for select to anon, authenticated using (true);
create policy "products: 판매 중 상품 조회" on public.products
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "product_sizes: 판매 중 상품 조회" on public.product_sizes
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
    or (select public.is_admin())
  );

create policy "categories: admin 추가" on public.categories for insert to authenticated with check ((select public.is_admin()));
create policy "categories: admin 수정" on public.categories for update to authenticated using ((select public.is_admin()));
create policy "categories: admin 삭제" on public.categories for delete to authenticated using ((select public.is_admin()));
create policy "products: admin 추가" on public.products for insert to authenticated with check ((select public.is_admin()));
create policy "products: admin 수정" on public.products for update to authenticated using ((select public.is_admin()));
create policy "products: admin 삭제" on public.products for delete to authenticated using ((select public.is_admin()));
create policy "product_sizes: admin 추가" on public.product_sizes for insert to authenticated with check ((select public.is_admin()));
create policy "product_sizes: admin 수정" on public.product_sizes for update to authenticated using ((select public.is_admin()));
create policy "product_sizes: admin 삭제" on public.product_sizes for delete to authenticated using ((select public.is_admin()));
