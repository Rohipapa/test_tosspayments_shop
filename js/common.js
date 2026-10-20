/* ==========================================================
   공통: 헤더/푸터, 장바구니·좋아요 저장소, 포맷, 상품 카드
   장바구니·좋아요는 로그인하면 DB(cart_items, likes), 아니면 localStorage에 저장합니다.
   두 객체 모두 메모리에 현재 목록을 들고 있어서 읽기는 동기, 쓰기는 비동기입니다.
   페이지는 App.ready를 기다린 뒤 Cart/Likes를 읽어야 합니다.
   ========================================================== */
const SHIPPING_FEE = 3000;
const FREE_SHIPPING_OVER = 50000;
const MAX_QTY = 99;

const won = (n) => n.toLocaleString("ko-KR") + "원";
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

/* ---------- localStorage (실패해도 동작하도록 감싸기) ---------- */
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* noop */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* noop */ }
  },
};

/* ---------- 장바구니 ---------- */
const cartKey = (i) => i.id + "|" + i.size;

const Cart = {
  KEY: "moosin_cart",
  list: [],

  async load() {
    if (!Auth.user) {
      this.list = store.get(this.KEY, []);
      return;
    }
    const { data, error } = await sb.from("cart_items").select("product_id, size, qty, checked").order("created_at");
    if (error) throw error;
    this.list = data.map((r) => ({ id: r.product_id, size: r.size, qty: r.qty, checked: r.checked }));
  },

  items() { return this.list.map((i) => ({ ...i })); },

  // 바뀐 목록 전체를 받아 저장. 로그인 상태면 이전 목록과 비교해 바뀐 행만 DB에 반영합니다.
  async save(items) {
    const prev = this.list;
    this.list = items.map((i) => ({ ...i }));
    updateCartBadge();
    if (!Auth.user) {
      store.set(this.KEY, this.list);
      return;
    }
    const before = new Map(prev.map((i) => [cartKey(i), i]));
    const after = new Set(this.list.map(cartKey));
    const changed = this.list.filter((i) => {
      const p = before.get(cartKey(i));
      return !p || p.qty !== i.qty || p.checked !== i.checked;
    });
    const removed = prev.filter((i) => !after.has(cartKey(i)));
    const ops = [];
    if (changed.length) {
      ops.push(sb.from("cart_items").upsert(
        changed.map((i) => ({ user_id: Auth.user.id, product_id: i.id, size: i.size, qty: i.qty, checked: i.checked })),
        { onConflict: "user_id,product_id,size" },
      ));
    }
    removed.forEach((i) => ops.push(sb.from("cart_items").delete().eq("product_id", i.id).eq("size", i.size)));
    const failed = (await Promise.all(ops)).find((r) => r.error);
    if (failed) {
      // 서버 상태로 되돌림
      toast("장바구니를 저장하지 못했어요");
      await this.load().catch(() => {});
      updateCartBadge();
      emit("cart:change");
      throw failed.error;
    }
  },

  async add(id, size, qty) {
    if (!Auth.user) {
      const items = this.items();
      const found = items.find((i) => i.id === id && i.size === size);
      if (found) found.qty = Math.min(found.qty + qty, MAX_QTY);
      else items.push({ id, size, qty, checked: true });
      return this.save(items);
    }
    const { error } = await sb.rpc("merge_cart", { p_items: [{ id, size, qty, checked: true }] });
    if (error) throw error;
    await this.load();
    updateCartBadge();
  },

  count() { return this.list.reduce((s, i) => s + i.qty, 0); },
};

/* 결제할 상품 목록(장바구니 선택분 또는 바로구매)을 checkout 페이지로 전달 */
const Checkout = {
  KEY: "moosin_checkout",
  set(items, from) { store.set(this.KEY, { items, from }); },
  get() { return store.get(this.KEY, null); },
  clear() { store.remove(this.KEY); },
};

/* 화면 표시용 금액 계산. items의 상품은 미리 Products.byIds()로 조회해 두어야 합니다.
   실제 결제 금액은 서버(calc_order_amount)가 같은 규칙으로 계산합니다. */
function calcTotals(items) {
  const lines = items
    .map((i) => ({ ...i, product: Products.cached(i.id) }))
    .filter((i) => i.product);
  const original = lines.reduce((s, i) => s + i.product.price * i.qty, 0);
  const subtotal = lines.reduce((s, i) => s + salePrice(i.product) * i.qty, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
  return { lines, original, discount: original - subtotal, subtotal, shipping, total: subtotal + shipping };
}

/* ---------- 좋아요 ---------- */
const Likes = {
  KEY: "moosin_likes",
  list: [],

  async load() {
    if (!Auth.user) {
      this.list = store.get(this.KEY, []);
      return;
    }
    const { data, error } = await sb.from("likes").select("product_id").order("created_at", { ascending: false });
    if (error) throw error;
    this.list = data.map((r) => r.product_id);
  },

  ids() { return [...this.list]; },
  has(id) { return this.list.includes(id); },

  // 화면은 바로 바꾸고(낙관적 업데이트) 저장 실패 시 되돌립니다. 반환값: 좋아요 여부
  toggle(id) {
    const on = !this.has(id);
    // 최근에 누른 상품이 앞에 오도록 저장
    this.list = on ? [id, ...this.list] : this.list.filter((x) => x !== id);
    if (!Auth.user) {
      store.set(this.KEY, this.list);
      return on;
    }
    const req = on
      ? sb.from("likes").insert({ user_id: Auth.user.id, product_id: id })
      : sb.from("likes").delete().eq("product_id", id);
    req.then(({ error }) => {
      if (!error) return;
      toast("좋아요를 저장하지 못했어요");
      this.list = on ? this.list.filter((x) => x !== id) : [id, ...this.list];
      syncLikeButtons(id, !on);
      updateLikeBadge();
      emit("likes:change", { id, on: !on });
    });
    return on;
  },
};

/* ---------- 로그인 상태 연동 ---------- */

// 로그인 순간 localStorage의 장바구니·좋아요를 DB로 합치고 비웁니다. (F-305)
// 동시에 여러 번 불려도 한 번만 병합되도록 진행 중인 작업을 공유합니다.
let mergeTask = null;
function mergeLocalData() {
  if (!Auth.user) return Promise.resolve();
  mergeTask ||= (async () => {
    const cart = store.get(Cart.KEY, []);
    const likes = store.get(Likes.KEY, []);
    if (!cart.length && !likes.length) return;
    // 먼저 비워서 다른 탭·이벤트가 같은 데이터를 두 번 합치지 않게 함. 실패하면 되돌림
    store.remove(Cart.KEY);
    store.remove(Likes.KEY);
    const [c, l] = await Promise.all([
      cart.length ? sb.rpc("merge_cart", { p_items: cart }) : { error: null },
      likes.length ? sb.rpc("merge_likes", { p_ids: likes }) : { error: null },
    ]);
    if (c.error) store.set(Cart.KEY, cart);
    if (l.error) store.set(Likes.KEY, likes);
    if (c.error || l.error) {
      console.error(c.error || l.error);
      toast("이전에 담은 상품을 계정에 옮기지 못했어요");
    }
  })().finally(() => { mergeTask = null; });
  return mergeTask;
}

async function loadUserData() {
  try {
    await Promise.all([Cart.load(), Likes.load()]);
  } catch (e) {
    console.error(e);
    toast("장바구니·좋아요를 불러오지 못했어요");
  }
  updateCartBadge();
  updateLikeBadge();
}

const App = {
  // 세션 확인 → (로그인 시) 병합 → 장바구니·좋아요 로드까지 끝나면 resolve
  ready: Auth.ready.then(async () => {
    await mergeLocalData();
    await loadUserData();
  }),
};

// 로그인·로그아웃이 일어나면 저장소를 바꾸고 화면에 알립니다.
// onAuthStateChange 콜백 안에서 Supabase를 await하면 교착될 수 있어 setTimeout으로 미룹니다.
sb.auth.onAuthStateChange((event, session) => {
  const prevId = Auth.user?.id ?? null;
  const user = session?.user ?? null;
  Auth.user = user;
  if (event === "INITIAL_SESSION" || prevId === (user?.id ?? null)) return;
  setTimeout(async () => {
    await App.ready;
    await mergeLocalData();
    await loadUserData();
    renderHeader();
    $$("[data-like]").forEach((b) => syncLikeButtons(b.dataset.like, Likes.has(b.dataset.like)));
    emit("auth:change", { user });
    emit("cart:change");
    emit("likes:change", {});
  }, 0);
});

async function logout() {
  const { error } = await sb.auth.signOut();
  if (error) return toast("로그아웃하지 못했어요");
  toast("로그아웃했어요");
}

/* ---------- 로딩·오류 표시 ---------- */
function skeletonCards(n = 5) {
  return `<div class="card card--skeleton"><div class="card__thumb"></div><div class="card__info"><p></p><p></p><p></p></div></div>`.repeat(n);
}
const skeletonGrid = (n = 5) => `<div class="grid">${skeletonCards(n)}</div>`;

/* el에 skeleton을 보여 주고 task를 실행. 실패하면 오류 메시지와 재시도 버튼을 그립니다. */
async function withLoading(el, skeleton, task) {
  if (skeleton) el.innerHTML = skeleton;
  try {
    await task();
  } catch (e) {
    console.error(e);
    el.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <strong>정보를 불러오지 못했어요</strong>
        <p>네트워크 상태를 확인하고 다시 시도해 주세요.</p>
        <button type="button" class="btn btn--black" data-retry>다시 시도</button>
      </div>`;
    $("[data-retry]", el).onclick = () => withLoading(el, skeleton, task);
    toast("정보를 불러오지 못했어요");
  }
}

/* ---------- 상품 카드 ---------- */
const HEART = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.1-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>`;

function productCard(p, rank) {
  const like = Likes.has(p.id);
  return `
    <a class="card" href="product.html?id=${p.id}">
      <div class="card__thumb">
        <img src="${productImage(p)}" alt="${esc(p.name)}" loading="lazy">
        ${rank ? `<span class="card__rank">${rank}</span>` : ""}
        <button type="button" class="card__like ${like ? "is-on" : ""}" data-like="${p.id}" aria-label="좋아요" aria-pressed="${like}">${HEART}</button>
      </div>
      <div class="card__info">
        <p class="card__brand">${esc(p.brand)}</p>
        <p class="card__name">${esc(p.name)}</p>
        <p class="card__price">${p.sale ? `<span class="sale">${p.sale}%</span>` : ""}${won(salePrice(p))}</p>
        <p class="card__meta"><span class="star">★</span> ${p.rating} · 후기 ${p.review.toLocaleString()}</p>
        ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}
      </div>
    </a>`;
}

// 같은 상품의 하트가 페이지에 여러 개 있을 수 있으니 모두 맞춰 줌
function syncLikeButtons(id, on) {
  $$(`[data-like="${id}"]`).forEach((b) => {
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", on);
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-like]");
  if (!btn) return;
  e.preventDefault();
  const id = btn.dataset.like;
  const on = Likes.toggle(id);
  syncLikeButtons(id, on);
  updateLikeBadge();
  toast(on ? "좋아요 목록에 추가했어요" : "좋아요를 취소했어요");
  emit("likes:change", { id, on });
});

/* ---------- 토스트 ---------- */
let toastTimer;
function toast(msg) {
  let el = $(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-show"), 1800);
}

/* ---------- 헤더 / 푸터 ---------- */
function renderHeader() {
  const active = document.body.dataset.category || "";
  const el = $("#header");
  if (!el) return;
  el.className = "header";
  el.innerHTML = `
    <div class="inner header__top">
      <a href="index.html" class="logo">MOOSIN</a>
      <form class="search" action="index.html" onsubmit="event.preventDefault(); toast('검색은 퍼블리싱 범위 밖이에요');">
        <input type="search" placeholder="브랜드, 상품, 프로필, 태그 등" aria-label="검색">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      </form>
      <nav class="header__util">
        <a href="likes.html" class="hide-m ${active === "likes" ? "is-active" : ""}">좋아요 <span class="cart-badge" id="likeBadge">0</span></a>
        ${Auth.user
          ? `<a href="mypage.html" class="${active === "mypage" ? "is-active" : ""}">마이페이지</a>
             <button type="button" id="logoutBtn" class="hide-m">로그아웃</button>`
          : `<a href="${Auth.loginUrl()}" class="${active === "login" ? "is-active" : ""}">로그인</a>`}
        <a href="cart.html" class="${active === "cart" ? "is-active" : ""}">장바구니 <span class="cart-badge" id="cartBadge">0</span></a>
      </nav>
    </div>
    <nav class="gnb">
      <ul class="inner">
        <li><a href="index.html" class="${active === "" ? "is-active" : ""}">홈</a></li>
        ${Object.entries(CATEGORIES)
          .map(([k, c]) => `<li><a href="${c.page}" class="${active === k ? "is-active" : ""}">${c.name}</a></li>`)
          .join("")}
        <li><a href="cart.html" class="${active === "cart" ? "is-active" : ""}">장바구니</a></li>
      </ul>
    </nav>`;
  const out = $("#logoutBtn");
  if (out) out.onclick = logout;
  updateCartBadge();
  updateLikeBadge();
}

function renderFooter() {
  const el = $("#footer");
  if (!el) return;
  el.className = "footer";
  el.innerHTML = `
    <div class="inner">
      <strong>MOOSIN STORE</strong>
      <p>퍼블리싱 샘플 페이지입니다. 상품 정보는 더미 데이터이고, 상품 사진은 <a href="https://unsplash.com/license" target="_blank" rel="noopener" style="text-decoration:underline">Unsplash 무료 라이선스</a> 사진입니다.</p>
      <p>결제는 토스페이먼츠 테스트 모드로 동작하며 실제 금액이 청구되지 않습니다.</p>
      <p>© MOOSIN STORE. All rights reserved.</p>
    </div>`;
}

function updateCartBadge() {
  const b = $("#cartBadge");
  if (b) b.textContent = Cart.count();
}

function updateLikeBadge() {
  const b = $("#likeBadge");
  if (b) b.textContent = Likes.ids().length;
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  // 세션을 읽은 뒤 로그인 상태로 헤더를 다시 그림
  App.ready.then(renderHeader);
});
