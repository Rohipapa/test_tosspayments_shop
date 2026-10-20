-- Supabase advisor 보안 경고 정리
-- 1) 트리거 함수는 API로 직접 호출할 필요가 없음
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2) is_admin()은 본인 프로필만 읽으면 되므로 SECURITY INVOKER로 충분 (profiles RLS: 본인 조회)
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- 3) fail_order()는 비회원 결제 실패 처리(fail.html)를 위해 anon 실행을 의도적으로 허용합니다.
--    pending 주문만, 회원 주문은 본인만 바꿀 수 있어 다른 상태로는 바꿀 수 없습니다.
