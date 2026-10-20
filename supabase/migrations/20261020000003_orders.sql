-- M2 결제 완성: 주문, 주문 상품, 결제 (F-401 ~ F-408)
-- 주문·결제 데이터는 Edge Function(service_role)만 씁니다. 클라이언트는 본인 주문 조회만 합니다.

-- ---------- orders ----------
-- status: pending(결제 대기) → processing(재고 차감 후 승인 중) → paid
--         실패 시 failed, 사용자가 결제창을 닫으면 canceled, 30분 지난 pending은 expired
create table public.orders (
  id text primary key check (id ~ '^[A-Za-z0-9_=-]{6,64}$'),
  user_id uuid references auth.users(id) on delete set null,
  order_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'failed', 'canceled', 'expired')),
  source text not null check (source in ('cart', 'direct')),
  original_amount int not null,
  discount_amount int not null,
  shipping_fee int not null,
  total_amount int not null check (total_amount > 0),
  orderer_name text not null,
  orderer_phone text not null,
  orderer_email text not null,
  shipping_address jsonb,
  fail_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_id_created_at_idx on public.orders (user_id, created_at desc);
create index orders_pending_created_at_idx on public.orders (created_at) where status = 'pending';

-- ---------- order_items (주문 시점 스냅샷) ----------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id),
  product_name text not null,
  brand text not null,
  image_url text,
  size text not null,
  qty int not null check (qty between 1 and 99),
  unit_price int not null,
  line_amount int not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

-- ---------- payments ----------
create table public.payments (
  payment_key text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  method text,
  amount int not null,
  status text not null,
  approved_at timestamptz,
  raw jsonb not null,
  created_at timestamptz not null default now()
);

create index payments_order_id_idx on public.payments (order_id);

-- ---------- RLS ----------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

create policy "orders: 본인 조회" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "order_items: 본인 주문 조회" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );
create policy "payments: 본인 주문 조회" on public.payments
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

revoke insert, update, delete on public.orders, public.order_items, public.payments from anon, authenticated;

-- ==========================================================
-- 금액 계산 (F-402)
-- js/products.js salePrice(), js/common.js calcTotals()와 같은 규칙입니다.
--   할인가 = 정가 × (100 - 할인율) / 100 을 100원 단위 반올림
--   배송비 3,000원, 할인 후 금액 50,000원 이상이면 무료
-- 결제 금액의 기준은 이 함수 하나이고, 클라이언트 계산은 화면 표시용입니다.
-- p_items: [{product_id, size, qty}]
-- ==========================================================
create function public.calc_order_amount(p_items jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_requested int;
  v_bad_qty int;
  v_found int;
  v_original int;
  v_subtotal int;
  v_shipping int;
  v_lines jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ITEMS';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  -- 같은 상품·사이즈는 수량을 합쳐 한 줄로
  with req as (
    select e.v ->> 'product_id' as product_id, e.v ->> 'size' as size,
           sum((e.v ->> 'qty')::int)::int as qty, min(e.ord) as ord
    from jsonb_array_elements(p_items) with ordinality as e(v, ord)
    group by 1, 2
  )
  select count(*), count(*) filter (where qty is null or qty not between 1 and 99)
    into v_requested, v_bad_qty
  from req;

  if v_bad_qty > 0 then
    raise exception 'INVALID_QTY';
  end if;

  with req as (
    select e.v ->> 'product_id' as product_id, e.v ->> 'size' as size,
           sum((e.v ->> 'qty')::int)::int as qty, min(e.ord) as ord
    from jsonb_array_elements(p_items) with ordinality as e(v, ord)
    group by 1, 2
  ), line as (
    select r.ord, p.id as product_id, p.name as product_name, p.brand, p.image_url,
           r.size, r.qty, p.price,
           (round(p.price * (100 - p.sale_rate) / 10000.0) * 100)::int as unit_price
    from req r
    join public.products p on p.id = r.product_id and p.is_active
    join public.product_sizes s on s.product_id = r.product_id and s.size = r.size
  )
  select count(*),
         coalesce(sum(price * qty), 0),
         coalesce(sum(unit_price * qty), 0),
         coalesce(jsonb_agg(jsonb_build_object(
           'product_id', product_id, 'product_name', product_name, 'brand', brand,
           'image_url', image_url, 'size', size, 'qty', qty,
           'unit_price', unit_price, 'line_amount', unit_price * qty
         ) order by ord), '[]'::jsonb)
    into v_found, v_original, v_subtotal, v_lines
  from line;

  if v_found <> v_requested then
    raise exception 'INVALID_PRODUCT';
  end if;

  v_shipping := case when v_subtotal = 0 or v_subtotal >= 50000 then 0 else 3000 end;

  return jsonb_build_object(
    'lines', v_lines,
    'original', v_original,
    'discount', v_original - v_subtotal,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'total', v_subtotal + v_shipping
  );
end;
$$;

-- ==========================================================
-- 주문 생성 (F-401). Edge Function create-order가 호출합니다.
-- ==========================================================
create function public.create_order(
  p_user_id uuid,
  p_source text,
  p_items jsonb,
  p_orderer jsonb,
  p_shipping jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calc jsonb;
  v_order_id text;
  v_order_name text;
  v_count int;
  v_name text := btrim(coalesce(p_orderer ->> 'name', ''));
  v_phone text := regexp_replace(coalesce(p_orderer ->> 'phone', ''), '\D', '', 'g');
  v_email text := btrim(coalesce(p_orderer ->> 'email', ''));
begin
  if p_source not in ('cart', 'direct') then
    raise exception 'INVALID_SOURCE';
  end if;
  if length(v_name) not between 1 and 50
     or v_phone !~ '^01[0-9]{8,9}$'
     or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'INVALID_ORDERER';
  end if;

  v_calc := public.calc_order_amount(p_items);
  v_count := jsonb_array_length(v_calc -> 'lines');
  v_order_name := left(v_calc -> 'lines' -> 0 ->> 'product_name', 80)
    || case when v_count > 1 then ' 외 ' || (v_count - 1) || '건' else '' end;
  v_order_id := 'MOOSIN-' || (extract(epoch from clock_timestamp()) * 1000)::bigint
    || '-' || substr(md5(gen_random_uuid()::text), 1, 8);

  insert into public.orders (
    id, user_id, order_name, status, source,
    original_amount, discount_amount, shipping_fee, total_amount,
    orderer_name, orderer_phone, orderer_email, shipping_address
  ) values (
    v_order_id, p_user_id, v_order_name, 'pending', p_source,
    (v_calc ->> 'original')::int, (v_calc ->> 'discount')::int,
    (v_calc ->> 'shipping')::int, (v_calc ->> 'total')::int,
    v_name, v_phone, v_email, p_shipping
  );

  insert into public.order_items (
    order_id, product_id, product_name, brand, image_url, size, qty, unit_price, line_amount, sort_order
  )
  select v_order_id, l ->> 'product_id', l ->> 'product_name', l ->> 'brand', l ->> 'image_url',
         l ->> 'size', (l ->> 'qty')::int, (l ->> 'unit_price')::int, (l ->> 'line_amount')::int, ord
  from jsonb_array_elements(v_calc -> 'lines') with ordinality as x(l, ord);

  return jsonb_build_object(
    'orderId', v_order_id,
    'orderName', v_order_name,
    'amount', (v_calc ->> 'total')::int,
    'original', (v_calc ->> 'original')::int,
    'discount', (v_calc ->> 'discount')::int,
    'shipping', (v_calc ->> 'shipping')::int
  );
end;
$$;

-- ==========================================================
-- 승인 직전 검증·재고 차감 (F-403, F-404, F-407)
-- 한 트랜잭션에서 주문 행을 잠그고 상태·소유자·금액·재고를 확인한 뒤 재고를 차감하고
-- 주문을 processing으로 바꿉니다. 동시에 두 번 호출되어도 한 번만 통과합니다.
-- 반환: {ok: true} 또는 {ok: false, code}
-- ==========================================================
create function public.begin_payment(p_order_id text, p_amount int, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_short jsonb;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_order.user_id is not null and v_order.user_id is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if v_order.status = 'paid' then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_PAID');
  end if;
  if v_order.status = 'processing' then
    return jsonb_build_object('ok', false, 'code', 'PROCESSING');
  end if;
  if v_order.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATUS', 'status', v_order.status);
  end if;

  -- 금액 위변조: 클라이언트 값은 비교만 하고, 다르면 주문을 실패 처리
  if v_order.total_amount <> p_amount then
    update public.orders
       set status = 'failed', fail_reason = 'AMOUNT_MISMATCH', updated_at = now()
     where id = p_order_id;
    return jsonb_build_object('ok', false, 'code', 'AMOUNT_MISMATCH');
  end if;

  -- 재고 행을 일정한 순서로 잠가 교착 상태를 피함
  perform 1
    from public.product_sizes s
    join public.order_items i on i.product_id = s.product_id and i.size = s.size
   where i.order_id = p_order_id
   order by s.product_id, s.size
   for update of s;

  select jsonb_agg(jsonb_build_object('product_id', i.product_id, 'size', i.size, 'stock', s.stock, 'qty', i.qty))
    into v_short
    from public.order_items i
    join public.product_sizes s on s.product_id = i.product_id and s.size = i.size
   where i.order_id = p_order_id and s.stock < i.qty;

  if v_short is not null then
    update public.orders
       set status = 'failed', fail_reason = 'OUT_OF_STOCK', updated_at = now()
     where id = p_order_id;
    return jsonb_build_object('ok', false, 'code', 'OUT_OF_STOCK', 'items', v_short);
  end if;

  update public.product_sizes s
     set stock = s.stock - i.qty
    from public.order_items i
   where i.order_id = p_order_id and s.product_id = i.product_id and s.size = i.size;

  update public.orders set status = 'processing', updated_at = now() where id = p_order_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- 토스 승인 성공 후: 결제 저장, 주문 paid, 장바구니 정리 (F-403, F-405)
create function public.complete_payment(p_order_id text, p_payment jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  insert into public.payments (payment_key, order_id, method, amount, status, approved_at, raw)
  values (
    p_payment ->> 'paymentKey',
    p_order_id,
    p_payment ->> 'method',
    (p_payment ->> 'totalAmount')::int,
    p_payment ->> 'status',
    (p_payment ->> 'approvedAt')::timestamptz,
    p_payment
  )
  on conflict (payment_key) do nothing;

  update public.orders
     set status = 'paid',
         paid_at = coalesce((p_payment ->> 'approvedAt')::timestamptz, now()),
         fail_reason = null,
         updated_at = now()
   where id = p_order_id
  returning * into v_order;

  if v_order.source = 'cart' and v_order.user_id is not null then
    delete from public.cart_items c
     using public.order_items i
     where i.order_id = p_order_id
       and c.user_id = v_order.user_id
       and c.product_id = i.product_id
       and c.size = i.size;
  end if;
end;
$$;

-- 토스 승인 실패 시: 차감한 재고를 되돌리고 주문 failed (F-404)
create function public.abort_payment(p_order_id text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
     set status = 'failed', fail_reason = left(p_reason, 200), updated_at = now()
   where id = p_order_id and status = 'processing';

  if found then
    update public.product_sizes s
       set stock = s.stock + i.qty
      from public.order_items i
     where i.order_id = p_order_id and s.product_id = i.product_id and s.size = i.size;
  end if;
end;
$$;

-- 결제창에서 실패·취소된 주문 처리 (F-406). fail.html이 RPC로 직접 호출합니다.
-- pending 상태만 바꾸고, 회원 주문은 본인만 바꿀 수 있습니다.
create function public.fail_order(p_order_id text, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := case when p_code = 'PAY_PROCESS_CANCELED' then 'canceled' else 'failed' end;
begin
  update public.orders
     set status = v_status, fail_reason = left(p_code, 100), updated_at = now()
   where id = p_order_id
     and status = 'pending'
     and (user_id is null or user_id = (select auth.uid()));
  return case when found then v_status else null end;
end;
$$;

-- 30분 지난 pending 주문 만료 (F-406, D-7)
create function public.expire_pending_orders()
returns int
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.orders
       set status = 'expired', updated_at = now()
     where status = 'pending' and created_at < now() - interval '30 minutes'
    returning 1
  )
  select count(*)::int from expired;
$$;

-- 서버 전용 함수는 service_role만 실행
revoke execute on function public.create_order(uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.begin_payment(text, int, uuid) from public, anon, authenticated;
revoke execute on function public.complete_payment(text, jsonb) from public, anon, authenticated;
revoke execute on function public.abort_payment(text, text) from public, anon, authenticated;
revoke execute on function public.expire_pending_orders() from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.begin_payment(text, int, uuid) to service_role;
grant execute on function public.complete_payment(text, jsonb) to service_role;
grant execute on function public.abort_payment(text, text) to service_role;
grant execute on function public.expire_pending_orders() to service_role;

grant execute on function public.calc_order_amount(jsonb) to anon, authenticated, service_role;
grant execute on function public.fail_order(text, text) to anon, authenticated;

-- ---------- pg_cron: 30분마다 만료 처리 ----------
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule(
  'expire-pending-orders',
  '*/30 * * * *',
  $$select public.expire_pending_orders()$$
);
