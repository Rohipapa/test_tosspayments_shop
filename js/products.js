/* ==========================================================
   상품: 카테고리 상수, Supabase 상품 조회, 이미지·가격 헬퍼
   상품 데이터는 DB(products, product_sizes)에 있고 supabase/seed.sql로 넣습니다.
   ========================================================== */

/* 헤더 GNB를 동기로 그리기 위해 카테고리는 상수로 둡니다. (DB categories 테이블과 같은 값) */
const CATEGORIES = {
  tops:  { name: "상의", en: "TOPS",  page: "tops.html",  desc: "티셔츠 · 셔츠 · 니트 · 후드" },
  pants: { name: "바지", en: "PANTS", page: "pants.html", desc: "데님 · 슬랙스 · 카고 · 트레이닝" },
  shoes: { name: "신발", en: "SHOES", page: "shoes.html", desc: "스니커즈 · 러닝화 · 로퍼 · 부츠" },
};

/* ---------- DB 행 → 화면용 상품 객체 ----------
   기존 렌더링 코드가 쓰던 필드 이름(cat, sale, img, review)을 그대로 맞춥니다. */
const PRODUCT_COLUMNS = "id, category_id, brand, name, price, sale_rate, color, image_url, review_count, rating, tag";

function toProduct(row) {
  return {
    id: row.id,
    cat: row.category_id,
    brand: row.brand,
    name: row.name,
    price: row.price,
    sale: row.sale_rate,
    color: row.color,
    img: row.image_url,
    review: row.review_count,
    rating: Number(row.rating),
    tag: row.tag,
    // 상세 조회 때만 채워짐: [{size, stock}]
    sizes: row.product_sizes
      ? [...row.product_sizes].sort((a, b) => a.sort_order - b.sort_order).map(({ size, stock }) => ({ size, stock }))
      : undefined,
  };
}

/* ---------- 상품 조회 (한 번 받은 상품은 메모리에 캐시) ---------- */
const Products = {
  cache: new Map(),

  remember(rows) {
    return rows.map((row) => {
      const p = toProduct(row);
      const prev = this.cache.get(p.id);
      if (prev?.sizes && !p.sizes) p.sizes = prev.sizes;
      this.cache.set(p.id, p);
      return p;
    });
  },

  // 카테고리 목록(없으면 전체). 인기순(후기 수) 정렬
  async list({ category } = {}) {
    let q = sb.from("products").select(PRODUCT_COLUMNS).order("review_count", { ascending: false });
    if (category) q = q.eq("category_id", category);
    const { data, error } = await q;
    if (error) throw error;
    return this.remember(data);
  },

  // 장바구니·결제·좋아요용: id 목록을 한 번에(in 쿼리) 조회. 순서는 ids 순서를 따르고 없는 상품은 빠짐
  async byIds(ids) {
    const missing = [...new Set(ids)].filter((id) => !this.cache.has(id));
    if (missing.length) {
      const { data, error } = await sb.from("products").select(PRODUCT_COLUMNS).in("id", missing);
      if (error) throw error;
      this.remember(data);
    }
    return ids.map((id) => this.cache.get(id)).filter(Boolean);
  },

  // 상세: 사이즈별 재고까지. 없으면 null
  async get(id) {
    if (!id) return null;
    const { data, error } = await sb
      .from("products")
      .select(`${PRODUCT_COLUMNS}, product_sizes(size, stock, sort_order)`)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? this.remember([data])[0] : null;
  },

  // 이미 조회한 상품만 동기로 꺼냄 (calcTotals 등에서 사용)
  cached(id) {
    return this.cache.get(id);
  },
};

async function getProduct(id) {
  return Products.get(id);
}

/* ---------- 상품 썸네일 (SVG 플레이스홀더) ----------
   product.img 가 있으면 그걸 우선 사용하고, 없을 때만 SVG를 그립니다. */
const SILHOUETTE = {
  tops:  "M34 22 L46 15 Q50 21 54 15 L66 22 L80 36 L72 43 L67 37 L67 84 L33 84 L33 37 L28 43 L20 36 Z",
  pants: "M35 14 H65 L70 86 H56 L50 38 L44 86 H30 Z",
  shoes: "M14 62 Q16 47 27 46 L40 46 Q46 56 58 56 Q78 57 86 64 L86 70 L14 70 Z M14 70 H86 V74 H14 Z",
};

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function productImage(p) {
  if (p.img) return p.img;
  const light = luminance(p.color) > 0.75;
  const bg = light ? "#e4e4e4" : "#f3f3f3";
  const stroke = light ? "#c8c8c8" : "none";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120">` +
    `<rect width="100" height="120" fill="${bg}"/>` +
    `<g transform="translate(0 10)"><path d="${SILHOUETTE[p.cat]}" fill="${p.color}" stroke="${stroke}" stroke-width="0.8"/></g>` +
    `</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/* 화면 표시용 할인가. 결제 금액은 DB 함수 calc_order_amount()가 같은 규칙으로 다시 계산합니다. */
function salePrice(p) {
  return Math.round((p.price * (100 - p.sale)) / 100 / 100) * 100;
}
