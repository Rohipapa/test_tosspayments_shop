/* ==========================================================
   상품 데이터 (퍼블리싱용 더미 데이터)
   실제 서비스에서는 API 응답으로 교체하세요.
   ========================================================== */
const CATEGORIES = {
  tops:  { name: "상의", en: "TOPS",  page: "tops.html",  desc: "티셔츠 · 셔츠 · 니트 · 후드" },
  pants: { name: "바지", en: "PANTS", page: "pants.html", desc: "데님 · 슬랙스 · 카고 · 트레이닝" },
  shoes: { name: "신발", en: "SHOES", page: "shoes.html", desc: "스니커즈 · 러닝화 · 로퍼 · 부츠" },
};

const SIZES = {
  tops:  ["S", "M", "L", "XL", "XXL"],
  pants: ["28", "30", "32", "34", "36"],
  shoes: ["240", "250", "260", "270", "280", "290"],
};

const PRODUCTS = [
  // ---------- 상의 ----------
  { id: "t01", cat: "tops", brand: "ARCHIVE LAB", name: "오버핏 헤비웨이트 반팔 티셔츠 블랙", price: 39000, sale: 25, color: "#1f1f1f", review: 12840, rating: 4.9, tag: "무료배송" },
  { id: "t02", cat: "tops", brand: "NORTH MOOD", name: "베이직 옥스퍼드 버튼다운 셔츠 스카이블루", price: 59000, sale: 30, color: "#a9c6e8", review: 5321, rating: 4.8, tag: "단독" },
  { id: "t03", cat: "tops", brand: "SLOWDAY", name: "램스울 라운드 니트 오트밀", price: 79000, sale: 40, color: "#d8c8ad", review: 3412, rating: 4.9, tag: "무료배송" },
  { id: "t04", cat: "tops", brand: "URBAN FIELD", name: "스웨트 후드 집업 멜란지 그레이", price: 69000, sale: 20, color: "#a7a7a7", review: 8920, rating: 4.8, tag: "" },
  { id: "t05", cat: "tops", brand: "ARCHIVE LAB", name: "피그먼트 롱슬리브 티셔츠 차콜", price: 45000, sale: 15, color: "#4a4a4a", review: 2210, rating: 4.7, tag: "" },
  { id: "t06", cat: "tops", brand: "COASTLINE", name: "릴렉스드 린넨 셔츠 아이보리", price: 65000, sale: 35, color: "#efe9dc", review: 1876, rating: 4.8, tag: "단독" },
  { id: "t07", cat: "tops", brand: "NORTH MOOD", name: "케이블 니트 가디건 네이비", price: 89000, sale: 45, color: "#2c3e5c", review: 4432, rating: 4.9, tag: "무료배송" },
  { id: "t08", cat: "tops", brand: "SLOWDAY", name: "에센셜 크루넥 맨투맨 버건디", price: 49000, sale: 10, color: "#7a2633", review: 990, rating: 4.6, tag: "" },
  { id: "t09", cat: "tops", brand: "URBAN FIELD", name: "그래픽 프린트 반팔 티셔츠 화이트", price: 35000, sale: 0, color: "#f4f4f4", review: 760, rating: 4.7, tag: "" },
  { id: "t10", cat: "tops", brand: "COASTLINE", name: "스트라이프 보트넥 티셔츠 네이비", price: 42000, sale: 20, color: "#5a77a6", review: 1320, rating: 4.8, tag: "" },

  // ---------- 바지 ----------
  { id: "p01", cat: "pants", brand: "DENIM WORKS", name: "와이드 스트레이트 데님 팬츠 미드블루", price: 69000, sale: 30, color: "#5b7fa8", review: 15402, rating: 4.9, tag: "무료배송" },
  { id: "p02", cat: "pants", brand: "SLOWDAY", name: "세미 와이드 투턱 슬랙스 블랙", price: 55000, sale: 25, color: "#222222", review: 10233, rating: 4.9, tag: "단독" },
  { id: "p03", cat: "pants", brand: "URBAN FIELD", name: "나일론 카고 조거 팬츠 올리브", price: 72000, sale: 35, color: "#5e6b45", review: 4521, rating: 4.8, tag: "" },
  { id: "p04", cat: "pants", brand: "NORTH MOOD", name: "코튼 치노 팬츠 베이지", price: 59000, sale: 20, color: "#c9b38e", review: 3876, rating: 4.8, tag: "무료배송" },
  { id: "p05", cat: "pants", brand: "DENIM WORKS", name: "빈티지 워싱 루즈핏 데님 라이트블루", price: 75000, sale: 40, color: "#9fbbd6", review: 6712, rating: 4.8, tag: "" },
  { id: "p06", cat: "pants", brand: "ARCHIVE LAB", name: "스웨트 와이드 트레이닝 팬츠 그레이", price: 49000, sale: 15, color: "#9a9a9a", review: 2903, rating: 4.7, tag: "" },
  { id: "p07", cat: "pants", brand: "COASTLINE", name: "린넨 이지 밴딩 팬츠 크림", price: 52000, sale: 30, color: "#ece3cf", review: 1450, rating: 4.7, tag: "단독" },
  { id: "p08", cat: "pants", brand: "SLOWDAY", name: "핀턱 테이퍼드 울 슬랙스 차콜", price: 89000, sale: 45, color: "#3d3d3d", review: 2088, rating: 4.9, tag: "무료배송" },
  { id: "p09", cat: "pants", brand: "URBAN FIELD", name: "파라슈트 와이드 팬츠 블랙", price: 68000, sale: 0, color: "#141414", review: 880, rating: 4.6, tag: "" },
  { id: "p10", cat: "pants", brand: "DENIM WORKS", name: "블랙 생지 스트레이트 데님", price: 79000, sale: 20, color: "#2a2d33", review: 1764, rating: 4.8, tag: "" },

  // ---------- 신발 ----------
  { id: "s01", cat: "shoes", brand: "RUNWAY ONE", name: "클래식 레더 로우 스니커즈 화이트", price: 99000, sale: 20, color: "#f2f2f2", review: 21034, rating: 4.9, tag: "무료배송" },
  { id: "s02", cat: "shoes", brand: "STRIDE", name: "데일리 쿠셔닝 러닝화 블랙", price: 129000, sale: 30, color: "#1c1c1c", review: 9832, rating: 4.8, tag: "단독" },
  { id: "s03", cat: "shoes", brand: "OLD SCHOOL", name: "캔버스 하이탑 스니커즈 크림", price: 69000, sale: 25, color: "#eadfc8", review: 7341, rating: 4.8, tag: "" },
  { id: "s04", cat: "shoes", brand: "GENTLE STEP", name: "페니 레더 로퍼 브라운", price: 149000, sale: 40, color: "#6b4228", review: 3210, rating: 4.9, tag: "무료배송" },
  { id: "s05", cat: "shoes", brand: "STRIDE", name: "트레일 러닝화 그레이 오렌지", price: 139000, sale: 35, color: "#8f8f8f", review: 2876, rating: 4.7, tag: "" },
  { id: "s06", cat: "shoes", brand: "RUNWAY ONE", name: "스웨이드 레트로 스니커즈 네이비", price: 109000, sale: 15, color: "#2d3c66", review: 4598, rating: 4.8, tag: "" },
  { id: "s07", cat: "shoes", brand: "GENTLE STEP", name: "첼시 부츠 블랙 레더", price: 169000, sale: 45, color: "#191919", review: 1987, rating: 4.9, tag: "단독" },
  { id: "s08", cat: "shoes", brand: "OLD SCHOOL", name: "스케이트 로우 스니커즈 레드", price: 79000, sale: 10, color: "#b52a2a", review: 1203, rating: 4.7, tag: "" },
  { id: "s09", cat: "shoes", brand: "STRIDE", name: "리커버리 슬라이드 샌들 베이지", price: 49000, sale: 0, color: "#cdb99a", review: 3550, rating: 4.6, tag: "무료배송" },
  { id: "s10", cat: "shoes", brand: "RUNWAY ONE", name: "청키 솔 대드 스니커즈 그레이", price: 119000, sale: 25, color: "#b5b5b5", review: 2654, rating: 4.8, tag: "" },
];

/* ---------- 상품 사진 (Unsplash 무료 라이선스) ----------
   Unsplash License: 상업적 이용 가능, 출처 표기 의무 없음. 원본 페이지는 unsplash.com/photos/<slug>
   images.unsplash.com 은 핫링크를 허용하므로 크기만 지정해서 바로 불러옵니다. */
const PHOTOS = {
  t01: "1654570818480-54524bf0186b", t02: "1732605559386-bc59426d1b16", t03: "1631541909061-71e349d1f203",
  t04: "1593270281135-75f270babb81", t05: "1618354691551-44de113f0164", t06: "1713881587420-113c1c43e28a",
  t07: "1679802048522-c4739852429e", t08: "1767164057352-3e1544c239cc", t09: "1627225924765-552d49cf47ad",
  t10: "1591224615614-e300d72e37c5",
  p01: "1715758890151-2c15d5d482aa", p02: "1789110519554-bdca2e4549e5", p03: "1691407981600-62ebb537a0f2",
  p04: "1473966968600-fa801b869a1a", p05: "1602293589930-45aad59ba3ab", p06: "1789110520164-2389992e5d0f",
  p07: "1789110853687-71692f0e86be", p08: "1670855822901-5786604e9c40", p09: "1770918655041-5de83c95ccf9",
  p10: "1742980511651-b845fa826f33",
  s01: "1608379743498-ac08f6d022ba", s02: "1511499008188-de491bbbae98", s03: "1681718631486-c2246ffce63e",
  s04: "1777987601447-266e128de448", s05: "1709258228137-19a8c193be39", s06: "1647831914150-42cb3c3dcd32",
  s07: "1788478963160-1c38139e2932", s08: "1650320079970-b4ee8f0dae33", s09: "1603487742131-4160ec999306",
  s10: "1693479891395-37446a130d08",
};
PRODUCTS.forEach((p) => {
  if (PHOTOS[p.id]) p.img = `https://images.unsplash.com/photo-${PHOTOS[p.id]}?w=800&h=960&fit=crop&auto=format&q=75`;
});

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

function salePrice(p) {
  return Math.round((p.price * (100 - p.sale)) / 100 / 100) * 100;
}

function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}
