// create-order (F-401, F-402)
// 클라이언트는 [{product_id, size, qty}]와 주문자·배송지 정보만 보냅니다.
// 금액은 DB 함수 calc_order_amount()가 상품가 기준으로 계산하고, pending 주문을 저장합니다.
import { createClient } from "npm:@supabase/supabase-js@2.100.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MESSAGES: Record<string, string> = {
  EMPTY_ITEMS: "주문할 상품이 없어요.",
  TOO_MANY_ITEMS: "한 번에 주문할 수 있는 상품 수를 넘었어요.",
  INVALID_QTY: "수량은 1~99개만 주문할 수 있어요.",
  INVALID_PRODUCT: "판매하지 않는 상품이나 사이즈가 포함되어 있어요.",
  INVALID_SOURCE: "잘못된 주문 요청이에요.",
  INVALID_ORDERER: "주문자 정보를 확인해 주세요.",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 로그인 사용자의 JWT면 user id, 아니면(비회원) null
async function getUserId(req: Request): Promise<string | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ code: "INVALID_JSON", message: "잘못된 요청이에요." }, 400);
  }

  const items = Array.isArray(body?.items)
    ? body.items.map((i: any) => ({ product_id: String(i?.product_id ?? ""), size: String(i?.size ?? ""), qty: Number(i?.qty) }))
    : [];
  if (items.some((i: any) => !Number.isInteger(i.qty))) {
    return json({ code: "INVALID_QTY", message: MESSAGES.INVALID_QTY }, 400);
  }

  const shipping = body?.shipping && typeof body.shipping === "object"
    ? {
        recipient: String(body.shipping.recipient ?? "").slice(0, 50),
        phone: String(body.shipping.phone ?? "").replace(/\D/g, "").slice(0, 11),
        zipcode: String(body.shipping.zipcode ?? "").slice(0, 10),
        address1: String(body.shipping.address1 ?? "").slice(0, 200),
        address2: String(body.shipping.address2 ?? "").slice(0, 200),
      }
    : null;
  if (!shipping || !shipping.recipient.trim() || !/^01\d{8,9}$/.test(shipping.phone) || !shipping.address1.trim()) {
    return json({ code: "INVALID_SHIPPING", message: "배송지 정보를 확인해 주세요." }, 400);
  }

  const userId = await getUserId(req);

  const { data, error } = await admin.rpc("create_order", {
    p_user_id: userId,
    p_source: body?.source === "cart" ? "cart" : "direct",
    p_items: items,
    p_orderer: body?.orderer ?? {},
    p_shipping: shipping,
  });

  if (error) {
    const code = MESSAGES[error.message] ? error.message : "CREATE_FAILED";
    if (code === "CREATE_FAILED") console.error("create-order failed", error);
    return json({ code, message: MESSAGES[code] ?? "주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요." }, 400);
  }

  return json(data);
});
