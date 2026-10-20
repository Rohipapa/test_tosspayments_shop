/* ==========================================================
   Supabase 클라이언트, 인증 상태, Edge Function 호출
   supabase-js(CDN) 다음, products.js 앞에 로드합니다.
   ========================================================== */

/* publishable 키는 공개되어도 되는 키입니다(RLS로 보호).
   ⚠ service_role 키와 토스 시크릿 키는 절대 프론트엔드에 넣지 마세요. */
const SUPABASE_URL = "https://llqdfxmyyaqiawchdpdz.supabase.co";
const SUPABASE_KEY = "sb_publishable_je9__gzww0KGLIoPiklckA_yjIfa39H";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------- 인증 상태 ---------- */
const Auth = {
  user: null,
  // 저장된 세션을 읽어 user를 채웁니다. 페이지는 이 Promise를 기다린 뒤 로그인 여부를 판단합니다.
  ready: null,
  loginUrl(redirect) {
    const here = redirect || location.pathname.split("/").pop() + location.search;
    // 로그인·가입·재설정 페이지에서는 redirect를 중첩하지 않음
    if (!redirect && /^(login|signup|reset)\.html/.test(here)) return "login.html" + location.search;
    return `login.html?redirect=${encodeURIComponent(here || "index.html")}`;
  },
  // 로그인하지 않았으면 로그인 페이지로 보내고 false
  async requireLogin() {
    await this.ready;
    if (this.user) return true;
    location.replace(this.loginUrl());
    return false;
  },
};

Auth.ready = sb.auth
  .getSession()
  .then(({ data }) => (Auth.user = data.session?.user ?? null))
  .catch(() => (Auth.user = null));

/* 로그인 후 돌아갈 주소는 같은 사이트의 상대 경로만 허용 (오픈 리다이렉트 방지) */
function safeRedirect(value, fallback = "index.html") {
  if (!value || /^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith("/") || /^javascript:/i.test(value)) return fallback;
  return value;
}

/* ---------- Edge Function 호출 ----------
   실패하면 서버가 준 message를 담은 Error를 던집니다. (err.code, err.status) */
async function callFunction(name, body) {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || "요청을 처리하지 못했어요.");
    err.code = json.code;
    err.status = res.status;
    err.data = json;
    throw err;
  }
  return json;
}
