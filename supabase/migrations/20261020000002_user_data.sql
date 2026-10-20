-- M3·M4: 배송지, 장바구니, 좋아요 (F-206, F-301, F-303, F-305)

-- ---------- addresses ----------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipient text not null check (length(recipient) between 1 and 50),
  phone text not null check (phone ~ '^01[0-9]{8,9}$'),
  zipcode text not null default '',
  address1 text not null check (length(address1) between 1 and 200),
  address2 text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index addresses_user_id_idx on public.addresses (user_id);
-- 기본 배송지는 사용자당 1개
create unique index addresses_one_default_idx on public.addresses (user_id) where is_default;

-- ---------- cart_items ----------
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id text not null,
  size text not null,
  qty int not null check (qty between 1 and 99),
  checked boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, product_id, size),
  foreign key (product_id, size) references public.product_sizes(product_id, size) on delete cascade
);

create index cart_items_product_idx on public.cart_items (product_id, size);

-- ---------- likes ----------
create table public.likes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index likes_product_id_idx on public.likes (product_id);

-- ---------- RLS: 본인 데이터만 ----------
alter table public.addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.likes enable row level security;

create policy "addresses: 본인 조회" on public.addresses for select to authenticated using ((select auth.uid()) = user_id);
create policy "addresses: 본인 추가" on public.addresses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "addresses: 본인 수정" on public.addresses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "addresses: 본인 삭제" on public.addresses for delete to authenticated using ((select auth.uid()) = user_id);

create policy "cart_items: 본인 조회" on public.cart_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "cart_items: 본인 추가" on public.cart_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cart_items: 본인 수정" on public.cart_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cart_items: 본인 삭제" on public.cart_items for delete to authenticated using ((select auth.uid()) = user_id);

create policy "likes: 본인 조회" on public.likes for select to authenticated using ((select auth.uid()) = user_id);
create policy "likes: 본인 추가" on public.likes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "likes: 본인 삭제" on public.likes for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- RPC (security invoker: RLS가 그대로 적용됨) ----------

-- 장바구니에 담기·병합. 같은 상품·사이즈면 수량을 더하고 최대 99개로 자릅니다.
-- p_items: [{id, size, qty, checked}]
create function public.merge_cart(p_items jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.cart_items (user_id, product_id, size, qty, checked)
  select (select auth.uid()), x.product_id, x.size, least(x.qty, 99), x.checked
  from (
    select e.v ->> 'id' as product_id,
           e.v ->> 'size' as size,
           sum(greatest(coalesce((e.v ->> 'qty')::int, 1), 1))::int as qty,
           bool_or(coalesce((e.v ->> 'checked')::boolean, true)) as checked
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as e(v)
    group by 1, 2
  ) x
  where exists (select 1 from public.product_sizes s where s.product_id = x.product_id and s.size = x.size)
  on conflict (user_id, product_id, size)
  do update set qty = least(public.cart_items.qty + excluded.qty, 99);
$$;

-- 좋아요 병합. p_ids는 최근 것이 앞에 오는 배열이라 순서대로 created_at을 조금씩 앞당깁니다.
create function public.merge_likes(p_ids text[])
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.likes (user_id, product_id, created_at)
  select (select auth.uid()), x.id, now() - (x.ord * interval '1 millisecond')
  from unnest(coalesce(p_ids, '{}')) with ordinality as x(id, ord)
  where exists (select 1 from public.products p where p.id = x.id)
  on conflict (user_id, product_id) do nothing;
$$;

-- 기본 배송지 지정 (기존 기본 배송지를 먼저 해제)
create function public.set_default_address(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.addresses set is_default = false
   where user_id = (select auth.uid()) and is_default and id <> p_id;
  update public.addresses set is_default = true
   where id = p_id and user_id = (select auth.uid());
end;
$$;

revoke execute on function public.merge_cart(jsonb) from public, anon;
revoke execute on function public.merge_likes(text[]) from public, anon;
revoke execute on function public.set_default_address(uuid) from public, anon;
grant execute on function public.merge_cart(jsonb) to authenticated;
grant execute on function public.merge_likes(text[]) to authenticated;
grant execute on function public.set_default_address(uuid) to authenticated;
