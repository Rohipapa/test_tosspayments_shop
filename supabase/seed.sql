-- 상품 seed (F-103). 기존 js/products.js의 PRODUCTS·PHOTOS·SIZES를 옮긴 것입니다.
-- 상품 id(t01 등)는 product.html?id=t01 URL 호환을 위해 그대로 씁니다.
-- 재고는 사이즈별 50개(D-6). 다시 실행해도 되도록 upsert합니다.

insert into public.categories (id, name, name_en, description, sort_order) values
  ('tops',  '상의', 'TOPS',  '티셔츠 · 셔츠 · 니트 · 후드',      1),
  ('pants', '바지', 'PANTS', '데님 · 슬랙스 · 카고 · 트레이닝',  2),
  ('shoes', '신발', 'SHOES', '스니커즈 · 러닝화 · 로퍼 · 부츠',  3)
on conflict (id) do update set
  name = excluded.name, name_en = excluded.name_en,
  description = excluded.description, sort_order = excluded.sort_order;

with src (id, category_id, brand, name, price, sale_rate, color, photo, review_count, rating, tag) as (
  values
  -- 상의
  ('t01', 'tops', 'ARCHIVE LAB', '오버핏 헤비웨이트 반팔 티셔츠 블랙', 39000, 25, '#1f1f1f', '1654570818480-54524bf0186b', 12840, 4.9, '무료배송'),
  ('t02', 'tops', 'NORTH MOOD', '베이직 옥스퍼드 버튼다운 셔츠 스카이블루', 59000, 30, '#a9c6e8', '1732605559386-bc59426d1b16', 5321, 4.8, '단독'),
  ('t03', 'tops', 'SLOWDAY', '램스울 라운드 니트 오트밀', 79000, 40, '#d8c8ad', '1631541909061-71e349d1f203', 3412, 4.9, '무료배송'),
  ('t04', 'tops', 'URBAN FIELD', '스웨트 후드 집업 멜란지 그레이', 69000, 20, '#a7a7a7', '1593270281135-75f270babb81', 8920, 4.8, ''),
  ('t05', 'tops', 'ARCHIVE LAB', '피그먼트 롱슬리브 티셔츠 차콜', 45000, 15, '#4a4a4a', '1618354691551-44de113f0164', 2210, 4.7, ''),
  ('t06', 'tops', 'COASTLINE', '릴렉스드 린넨 셔츠 아이보리', 65000, 35, '#efe9dc', '1713881587420-113c1c43e28a', 1876, 4.8, '단독'),
  ('t07', 'tops', 'NORTH MOOD', '케이블 니트 가디건 네이비', 89000, 45, '#2c3e5c', '1679802048522-c4739852429e', 4432, 4.9, '무료배송'),
  ('t08', 'tops', 'SLOWDAY', '에센셜 크루넥 맨투맨 버건디', 49000, 10, '#7a2633', '1767164057352-3e1544c239cc', 990, 4.6, ''),
  ('t09', 'tops', 'URBAN FIELD', '그래픽 프린트 반팔 티셔츠 화이트', 35000, 0, '#f4f4f4', '1627225924765-552d49cf47ad', 760, 4.7, ''),
  ('t10', 'tops', 'COASTLINE', '스트라이프 보트넥 티셔츠 네이비', 42000, 20, '#5a77a6', '1591224615614-e300d72e37c5', 1320, 4.8, ''),
  -- 바지
  ('p01', 'pants', 'DENIM WORKS', '와이드 스트레이트 데님 팬츠 미드블루', 69000, 30, '#5b7fa8', '1715758890151-2c15d5d482aa', 15402, 4.9, '무료배송'),
  ('p02', 'pants', 'SLOWDAY', '세미 와이드 투턱 슬랙스 블랙', 55000, 25, '#222222', '1789110519554-bdca2e4549e5', 10233, 4.9, '단독'),
  ('p03', 'pants', 'URBAN FIELD', '나일론 카고 조거 팬츠 올리브', 72000, 35, '#5e6b45', '1691407981600-62ebb537a0f2', 4521, 4.8, ''),
  ('p04', 'pants', 'NORTH MOOD', '코튼 치노 팬츠 베이지', 59000, 20, '#c9b38e', '1473966968600-fa801b869a1a', 3876, 4.8, '무료배송'),
  ('p05', 'pants', 'DENIM WORKS', '빈티지 워싱 루즈핏 데님 라이트블루', 75000, 40, '#9fbbd6', '1602293589930-45aad59ba3ab', 6712, 4.8, ''),
  ('p06', 'pants', 'ARCHIVE LAB', '스웨트 와이드 트레이닝 팬츠 그레이', 49000, 15, '#9a9a9a', '1789110520164-2389992e5d0f', 2903, 4.7, ''),
  ('p07', 'pants', 'COASTLINE', '린넨 이지 밴딩 팬츠 크림', 52000, 30, '#ece3cf', '1789110853687-71692f0e86be', 1450, 4.7, '단독'),
  ('p08', 'pants', 'SLOWDAY', '핀턱 테이퍼드 울 슬랙스 차콜', 89000, 45, '#3d3d3d', '1670855822901-5786604e9c40', 2088, 4.9, '무료배송'),
  ('p09', 'pants', 'URBAN FIELD', '파라슈트 와이드 팬츠 블랙', 68000, 0, '#141414', '1770918655041-5de83c95ccf9', 880, 4.6, ''),
  ('p10', 'pants', 'DENIM WORKS', '블랙 생지 스트레이트 데님', 79000, 20, '#2a2d33', '1742980511651-b845fa826f33', 1764, 4.8, ''),
  -- 신발
  ('s01', 'shoes', 'RUNWAY ONE', '클래식 레더 로우 스니커즈 화이트', 99000, 20, '#f2f2f2', '1608379743498-ac08f6d022ba', 21034, 4.9, '무료배송'),
  ('s02', 'shoes', 'STRIDE', '데일리 쿠셔닝 러닝화 블랙', 129000, 30, '#1c1c1c', '1511499008188-de491bbbae98', 9832, 4.8, '단독'),
  ('s03', 'shoes', 'OLD SCHOOL', '캔버스 하이탑 스니커즈 크림', 69000, 25, '#eadfc8', '1681718631486-c2246ffce63e', 7341, 4.8, ''),
  ('s04', 'shoes', 'GENTLE STEP', '페니 레더 로퍼 브라운', 149000, 40, '#6b4228', '1777987601447-266e128de448', 3210, 4.9, '무료배송'),
  ('s05', 'shoes', 'STRIDE', '트레일 러닝화 그레이 오렌지', 139000, 35, '#8f8f8f', '1709258228137-19a8c193be39', 2876, 4.7, ''),
  ('s06', 'shoes', 'RUNWAY ONE', '스웨이드 레트로 스니커즈 네이비', 109000, 15, '#2d3c66', '1647831914150-42cb3c3dcd32', 4598, 4.8, ''),
  ('s07', 'shoes', 'GENTLE STEP', '첼시 부츠 블랙 레더', 169000, 45, '#191919', '1788478963160-1c38139e2932', 1987, 4.9, '단독'),
  ('s08', 'shoes', 'OLD SCHOOL', '스케이트 로우 스니커즈 레드', 79000, 10, '#b52a2a', '1650320079970-b4ee8f0dae33', 1203, 4.7, ''),
  ('s09', 'shoes', 'STRIDE', '리커버리 슬라이드 샌들 베이지', 49000, 0, '#cdb99a', '1603487742131-4160ec999306', 3550, 4.6, '무료배송'),
  ('s10', 'shoes', 'RUNWAY ONE', '청키 솔 대드 스니커즈 그레이', 119000, 25, '#b5b5b5', '1693479891395-37446a130d08', 2654, 4.8, '')
)
insert into public.products (id, category_id, brand, name, price, sale_rate, color, image_url, review_count, rating, tag)
select id, category_id, brand, name, price, sale_rate, color,
       'https://images.unsplash.com/photo-' || photo || '?w=800&h=960&fit=crop&auto=format&q=75',
       review_count, rating, tag
from src
on conflict (id) do update set
  category_id = excluded.category_id, brand = excluded.brand, name = excluded.name,
  price = excluded.price, sale_rate = excluded.sale_rate, color = excluded.color,
  image_url = excluded.image_url, review_count = excluded.review_count,
  rating = excluded.rating, tag = excluded.tag;

with sizes (category_id, size, sort_order) as (
  values
  ('tops', 'S', 1), ('tops', 'M', 2), ('tops', 'L', 3), ('tops', 'XL', 4), ('tops', 'XXL', 5),
  ('pants', '28', 1), ('pants', '30', 2), ('pants', '32', 3), ('pants', '34', 4), ('pants', '36', 5),
  ('shoes', '240', 1), ('shoes', '250', 2), ('shoes', '260', 3), ('shoes', '270', 4), ('shoes', '280', 5), ('shoes', '290', 6)
)
insert into public.product_sizes (product_id, size, stock, sort_order)
select p.id, s.size, 50, s.sort_order
from public.products p
join sizes s on s.category_id = p.category_id
on conflict (product_id, size) do nothing;
