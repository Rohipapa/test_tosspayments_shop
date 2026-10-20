/* ==========================================================
   공통: 헤더/푸터, 장바구니 저장소, 포맷, 상품 카드
   ========================================================== */
const SHIPPING_FEE = 3000;
const FREE_SHIPPING_OVER = 50000;

const won = (n) => n.toLocaleString("ko-KR") + "원";
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

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
const Cart = {
  KEY: "moosin_cart",
  items() { return store.get(this.KEY, []); },
  save(items) { store.set(this.KEY, items); updateCartBadge(); },
  add(id, size, qty) {
    const items = this.items();
    const found = items.find((i) => i.id === id && i.size === size);
    if (found) found.qty = Math.min(found.qty + qty, 99);
    else items.push({ id, size, qty, checked: true });
    this.save(items);
  },
  count() { return this.items().reduce((s, i) => s + i.qty, 0); },
};

/* 결제할 상품 목록(장바구니 선택분 또는 바로구매)을 checkout 페이지로 전달 */
const Checkout = {
  KEY: "moosin_checkout",
  set(items, from) { store.set(this.KEY, { items, from }); },
  get() { return store.get(this.KEY, null); },
  clear() { store.remove(this.KEY); },
};

function calcTotals(items) {
  const lines = items
    .map((i) => ({ ...i, product: getProduct(i.id) }))
    .filter((i) => i.product);
  const original = lines.reduce((s, i) => s + i.product.price * i.qty, 0);
  const subtotal = lines.reduce((s, i) => s + salePrice(i.product) * i.qty, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
  return { lines, original, discount: original - subtotal, subtotal, shipping, total: subtotal + shipping };
}

/* ---------- 좋아요 ---------- */
const Likes = {
  KEY: "moosin_likes",
  has(id) { return store.get(this.KEY, []).includes(id); },
  toggle(id) {
    const list = store.get(this.KEY, []);
    const i = list.indexOf(id);
    i >= 0 ? list.splice(i, 1) : list.push(id);
    store.set(this.KEY, list);
    return i < 0;
  },
};

/* ---------- 상품 카드 ---------- */
const HEART = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.1-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>`;

function productCard(p, rank) {
  const like = Likes.has(p.id);
  return `
    <a class="card" href="product.html?id=${p.id}">
      <div class="card__thumb">
        <img src="${productImage(p)}" alt="${p.name}" loading="lazy">
        ${rank ? `<span class="card__rank">${rank}</span>` : ""}
        <button type="button" class="card__like ${like ? "is-on" : ""}" data-like="${p.id}" aria-label="좋아요">${HEART}</button>
      </div>
      <div class="card__info">
        <p class="card__brand">${p.brand}</p>
        <p class="card__name">${p.name}</p>
        <p class="card__price">${p.sale ? `<span class="sale">${p.sale}%</span>` : ""}${won(salePrice(p))}</p>
        <p class="card__meta"><span class="star">★</span> ${p.rating} · 후기 ${p.review.toLocaleString()}</p>
        ${p.tag ? `<span class="tag">${p.tag}</span>` : ""}
      </div>
    </a>`;
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-like]");
  if (!btn) return;
  e.preventDefault();
  const on = Likes.toggle(btn.dataset.like);
  btn.classList.toggle("is-on", on);
  toast(on ? "좋아요 목록에 추가했어요" : "좋아요를 취소했어요");
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
        <a href="#" class="hide-m">좋아요</a>
        <a href="#" class="hide-m">마이페이지</a>
        <a href="cart.html">장바구니 <span class="cart-badge" id="cartBadge">0</span></a>
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
  updateCartBadge();
}

function renderFooter() {
  const el = $("#footer");
  if (!el) return;
  el.className = "footer";
  el.innerHTML = `
    <div class="inner">
      <strong>MOOSIN STORE</strong>
      <p>퍼블리싱 샘플 페이지입니다. 상품 정보와 이미지는 모두 더미 데이터입니다.</p>
      <p>결제는 토스페이먼츠 테스트 모드로 동작하며 실제 금액이 청구되지 않습니다.</p>
      <p>© MOOSIN STORE. All rights reserved.</p>
    </div>`;
}

function updateCartBadge() {
  const b = $("#cartBadge");
  if (b) b.textContent = Cart.count();
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
});
