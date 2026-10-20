// confirm-payment (F-403, F-404, F-405, F-407)
// success.html이 paymentKey, orderId, amount를 넘기면
//   1) begin_payment(): 주문 상태·소유자·금액 확인 + 재고 차감 (한 트랜잭션)
//   2) 토스 결제 승인 API 호출 (Idempotency-Key로 중복 승인 방지)
//   3) 성공: complete_payment() → paid, 결제 저장, 장바구니 정리
//      실패: abort_payment()   → 재고 복원, failed
import { createClient } from "npm:@supabase/supabase-js@2.100.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// 토스 시크릿 키는 Edge Function Secret(TOSS_SECRET_KEY)으로 넣습니다.
// 설정 전에는 js/checkout.js의 문서용 클라이언트 키와 짝인 "문서용 공개 테스트 시크릿 키"를 씁니다.
// (토스페이먼츠 개발자 문서에 공개된 테스트 키라 실제 결제가 일어나지 않습니다.)
const TOSS_DOCS_TEST_SECRET_KEY = "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";
const TOSS_SECRET_KEY = Deno.env.get("TOSS_SECRET_KEY") || TOSS_DOCS_TEST_SECRET_KEY;
const TOSS_AUTH = "Basic " + btoa(TOSS_SECRET_KEY + ":");

const MESSAGES: Record<string, string> = {
  NOT_FOUND: "주문 정보를 찾을 수 없어요.",
  FORBIDDEN: "다른 회원의 주문이에요.",
  PROCESSING: "결제를 처리하고 있어요. 잠시 후 다시 확인해 주세요.",
  INVALID_STATUS: "이미 처리가 끝난 주문이에요.",
  AMOUNT_MISMATCH: "결제 금액이 주문 금액과 달라 결제를 취소했어요.",
  OUT_OF_STOCK: "재고가 부족한 상품이 있어 결제를 진행하지 못했어요.",
  PAYMENT_KEY_MISMATCH: "결제 정보가 주문과 일치하지 않아요.",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getUserId(req: Request): Promise<string | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user?.id ?? null;
}

async function loadOrder(orderId: string) {
  const { data } = await admin
    .from("orders")
    .select("id, order_name, status, source, total_amount, original_amount, discount_amount, shipping_fee, paid_at, order_items(product_id, product_name, brand, image_url, size, qty, line_amount, sort_order), payments(payment_key, method)")
    .eq("id", orderId)
    .order("sort_order", { referencedTable: "order_items" })
    .single();
  return data;
}

async function tossFetch(path: string, init: RequestInit = {}) {
  const res = await fetch("https://api.tosspayments.com" + path, {
    ...init,
    headers: { Authorization: TOSS_AUTH, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  if (TOSS_SECRET_KEY.startsWith("live_")) {
    // 이 샘플은 테스트 모드만 대상으로 합니다.
    return json({ code: "LIVE_KEY_NOT_ALLOWED", message: "테스트 키만 사용할 수 있어요." }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ code: "INVALID_JSON", message: "잘못된 요청이에요." }, 400);
  }
  const paymentKey = String(body?.paymentKey ?? "");
  const orderId = String(body?.orderId ?? "");
  const amount = Number(body?.amount);
  if (!paymentKey || !orderId || !Number.isInteger(amount)) {
    return json({ code: "INVALID_REQUEST", message: "결제 정보가 올바르지 않아요." }, 400);
  }

  const userId = await getUserId(req);

  // 1) 검증 + 재고 차감
  const { data: begin, error: beginError } = await admin.rpc("begin_payment", {
    p_order_id: orderId,
    p_amount: amount,
    p_user_id: userId,
  });
  if (beginError) {
    console.error("begin_payment error", orderId, beginError);
    return json({ code: "SERVER_ERROR", message: "결제를 확인하지 못했어요." }, 500);
  }

  if (!begin.ok) {
    // 새로고침 등으로 다시 들어온 경우: 같은 결제면 완료 결과를 그대로 돌려줌 (F-407)
    if (begin.code === "ALREADY_PAID") {
      const order = await loadOrder(orderId);
      const samePayment = order?.payments?.some((p: any) => p.payment_key === paymentKey);
      if (samePayment) return json({ status: "paid", order });
      return json({ code: "PAYMENT_KEY_MISMATCH", message: MESSAGES.PAYMENT_KEY_MISMATCH }, 409);
    }
    const status = begin.code === "NOT_FOUND" ? 404 : begin.code === "FORBIDDEN" ? 403 : begin.code === "PROCESSING" ? 409 : 400;
    if (begin.code === "AMOUNT_MISMATCH" || begin.code === "OUT_OF_STOCK") {
      console.warn("confirm rejected", { orderId, code: begin.code, amount });
    }
    return json({ code: begin.code, message: MESSAGES[begin.code] ?? "결제를 진행할 수 없어요.", items: begin.items }, status);
  }

  // 2) 토스 결제 승인
  let toss: { ok: boolean; status: number; body: any };
  try {
    toss = await tossFetch("/v1/payments/confirm", {
      method: "POST",
      headers: { "Idempotency-Key": `confirm-${orderId}` },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
  } catch (e) {
    console.error("toss confirm network error", { orderId, error: String(e) });
    await admin.rpc("abort_payment", { p_order_id: orderId, p_reason: "NETWORK_ERROR" });
    return json({ code: "NETWORK_ERROR", message: "결제 승인 요청에 실패했어요. 잠시 후 다시 시도해 주세요." }, 502);
  }

  // 이미 승인된 결제(이전 요청이 승인 후 DB 반영 전에 끊긴 경우)는 결제 조회로 확인
  if (!toss.ok && toss.body?.code === "ALREADY_PROCESSED_PAYMENT") {
    const found = await tossFetch(`/v1/payments/${encodeURIComponent(paymentKey)}`);
    if (found.ok && found.body?.orderId === orderId && found.body?.status === "DONE") toss = found;
  }

  if (!toss.ok) {
    console.error("toss confirm failed", { orderId, code: toss.body?.code, message: toss.body?.message });
    await admin.rpc("abort_payment", { p_order_id: orderId, p_reason: toss.body?.code ?? `HTTP_${toss.status}` });
    return json({ code: toss.body?.code ?? "CONFIRM_FAILED", message: toss.body?.message ?? "결제 승인에 실패했어요." }, 400);
  }

  // 3) 주문 확정
  const { error: completeError } = await admin.rpc("complete_payment", { p_order_id: orderId, p_payment: toss.body });
  if (completeError) {
    // 돈은 승인됐는데 DB 반영 실패: 주문이 processing으로 남으므로 이 로그로 찾아 보정합니다. (웹훅 F-410으로 자동화 예정)
    console.error("CRITICAL complete_payment failed", { orderId, paymentKey, error: completeError });
    return json({ code: "SERVER_ERROR", message: "결제는 승인됐지만 주문 저장에 실패했어요. 고객센터로 문의해 주세요." }, 500);
  }

  return json({ status: "paid", order: await loadOrder(orderId) });
});
