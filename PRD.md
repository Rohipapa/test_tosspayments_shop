# PRD: Supabase DB 연동

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 |
| 작성일 | 2026년 10월 20일 |
| 대상 | 무신사 스타일 의류 쇼핑몰 퍼블리싱 샘플 (순수 HTML/CSS/JS + 토스페이먼츠 결제위젯 v2) |
| 상태 | 초안 (결정 필요 항목 확정 후 개발 착수) |

---

## 1. 배경

현재 쇼핑몰은 서버와 DB 없이 동작합니다.

- 상품: `js/products.js`의 `PRODUCTS` 더미 데이터 30개 (상의·바지·신발 각 10개)
- 장바구니·좋아요·주문 내역: 브라우저 localStorage (`moosin_cart`, `moosin_likes`, `moosin_orders`)
- 결제: 토스페이먼츠 결제위젯으로 결제 요청까지만 구현되어 있습니다. **결제 승인 API(`POST /v1/payments/confirm`)는 시크릿 키가 필요해 구현되어 있지 않습니다.**
- 금액 검증: `success.html`이 localStorage의 `moosin_pending_order`와 쿼리스트링을 비교하는 수준이라, 사용자가 값을 조작할 수 있습니다.

이 때문에 다음 문제가 있습니다.

1. 기기나 브라우저를 바꾸면 장바구니·좋아요·주문 내역이 사라집니다.
2. 결제가 승인되지 않아 실제 주문이 완료되지 않습니다.
3. 결제 금액을 클라이언트가 정하므로 위변조에 취약합니다.
4. 재고 개념이 없습니다.

## 2. 목표

| 목표 | 성공 기준 |
|---|---|
| 상품 데이터를 DB에서 관리 | 모든 페이지가 `PRODUCTS` 상수 대신 Supabase에서 상품을 조회 |
| 회원 기능 제공 | 회원가입·로그인 후 장바구니·좋아요·주문 내역이 기기 간 유지 |
| 결제를 끝까지 완료 | 결제 승인 API를 서버(Edge Function)에서 호출하고 주문 상태가 `paid`로 바뀜 |
| 금액 위변조 차단 | 결제 금액을 DB의 상품가 기준으로 서버에서 계산·검증 |
| 재고 관리 | 결제 승인 시 사이즈별 재고 차감, 재고 부족 시 승인 거절 |

### 하지 않는 것 (Non-goals)

- 프레임워크·빌드 도구 도입 (순수 HTML/CSS/JS 구조 유지)
- 실결제(라이브 키) 전환 — 테스트 모드만 대상
- 쿠폰·적립금·포인트
- 배송 추적 연동

## 3. 기술 구성

| 구분 | 선택 |
|---|---|
| DB | Supabase Postgres |
| 인증 | Supabase Auth |
| 서버 로직 | Supabase Edge Functions (Deno) |
| 파일 저장 | Supabase Storage (선택, 5단계) |
| 클라이언트 | `supabase-js` v2를 CDN(`cdn.jsdelivr.net/npm/@supabase/supabase-js@2.x.x`, 정확한 버전 고정)으로 로드 |
| 결제 | 토스페이먼츠 결제위젯 SDK v2 (기존 유지) |

### 키 관리 원칙

| 키 | 위치 |
|---|---|
| Supabase URL, publishable(anon) 키 | 프론트엔드 `js/supabase.js` (공개되어도 됨, RLS로 보호) |
| Supabase service_role 키 | Edge Function 환경변수만. **프론트엔드 금지** |
| 토스 클라이언트 키 (`test_gck_...`) | 프론트엔드 `js/checkout.js` (기존 유지) |
| 토스 시크릿 키 (`test_gsk_...`) | Edge Function Secret만. **프론트엔드 금지** |

### 스크립트 로드 순서 (변경 후)

모듈 시스템 없이 전역을 공유하는 기존 구조를 유지하고, 맨 앞에 두 개를 추가합니다.

1. `supabase-js` CDN
2. `js/supabase.js` — 클라이언트 생성(`sb`), 인증 상태 헬퍼, 공통 데이터 접근 함수
3. `js/products.js` — 카테고리·사이즈 상수, `productImage()`, `salePrice()` (더미 `PRODUCTS`는 seed로 이전 후 제거)
4. `js/common.js`
5. 페이지 전용 스크립트

### 개발 환경 제약

이 PC에는 Node.js가 없어 Supabase CLI를 쓰기 어렵습니다. 마이그레이션 적용과 Edge Function 배포는 **Supabase MCP 또는 Supabase 대시보드**로 진행합니다. SQL 마이그레이션 파일은 저장소의 `supabase/migrations/`에, Edge Function 소스는 `supabase/functions/`에 보관해 이력을 남깁니다.

---

## 4. 기능 요구사항

우선순위: **P0** 필수 / **P1** 이번 범위에 포함 / **P2** 선택

### 4.1 1단계 — 기반

| ID | 기능 | 우선순위 | 설명 | 영향 파일 |
|---|---|---|---|---|
| F-101 | Supabase 클라이언트 연결 | P0 | CDN으로 `supabase-js`를 로드하고 `js/supabase.js`에서 클라이언트를 생성합니다. | 모든 HTML, `js/supabase.js`(신규) |
| F-102 | 상품 스키마 생성 | P0 | `categories`, `products`, `product_sizes` 테이블을 만듭니다. (6장 참고) | `supabase/migrations/` |
| F-103 | 상품 seed | P0 | `PRODUCTS` 30개, `PHOTOS` 이미지 URL, `SIZES`별 재고를 seed SQL로 옮깁니다. 상품 id(`t01` 등)는 기존 값을 유지해 URL(`product.html?id=t01`) 호환성을 지킵니다. | `supabase/seed.sql` |
| F-104 | 상품 조회 비동기화 | P0 | `getProduct()`를 async로 바꾸고, 카테고리 목록·상세·홈 추천/신상품을 DB에서 조회합니다. 조회 중에는 로딩 상태(스켈레톤)를, 실패 시 에러 메시지를 표시합니다. | `js/products.js`, `js/category.js`, `product.html`, `index.html` |
| F-105 | 장바구니·결제 화면의 상품 정보 조회 | P0 | 장바구니·결제·좋아요 페이지는 저장된 상품 id 목록으로 상품 정보를 한 번에(`in` 쿼리) 조회합니다. | `cart.html`, `checkout.js`, `likes.html` |
| F-106 | RLS 정책 | P0 | 모든 테이블에 RLS를 켭니다. 상품은 누구나 읽기만, 사용자 데이터는 본인 것만 접근합니다. (7장 참고) | `supabase/migrations/` |

**완료 조건**
- `products.js`에 더미 상품 배열이 남아 있지 않습니다.
- 기존 모든 페이지가 DB 데이터로 이전과 같은 화면을 그립니다.
- 존재하지 않는 상품 id로 상세 페이지에 들어가면 "상품을 찾을 수 없어요"를 표시합니다.

### 4.2 2단계 — 회원

| ID | 기능 | 우선순위 | 설명 |
|---|---|---|---|
| F-201 | 회원가입 | P0 | 이메일·비밀번호 가입. 신규 페이지 `signup.html` |
| F-202 | 로그인·로그아웃 | P0 | 신규 페이지 `login.html`. 로그인 후 원래 보던 페이지로 돌아갑니다(`?redirect=`). |
| F-203 | 헤더 로그인 상태 표시 | P0 | `common.js`의 헤더 렌더링에서 로그인 여부에 따라 "로그인" / "로그아웃·마이페이지"를 표시합니다. `onAuthStateChange`로 갱신합니다. |
| F-204 | 프로필 | P0 | `profiles` 테이블(이름, 휴대폰 번호). 가입 시 DB trigger로 자동 생성합니다. |
| F-205 | 결제 페이지 주문자 정보 자동 입력 | P1 | 로그인 상태면 `#ordererForm`에 프로필 값을 채웁니다. |
| F-206 | 배송지 관리 | P1 | `addresses` 테이블. 기본 배송지 1개 지정. 결제 페이지에서 배송지 선택·신규 입력 |
| F-207 | 마이페이지 회원 정보 | P1 | 회원 정보 조회·수정, 비밀번호 변경 |
| F-208 | 소셜 로그인 | P2 | 카카오·구글 OAuth |
| F-209 | 비밀번호 재설정 | P1 | 이메일 링크로 재설정 |

**완료 조건**
- 로그인하지 않은 사용자가 `mypage.html`에 들어가면 로그인 페이지로 이동합니다.
- 로그아웃하면 화면에서 회원 데이터(장바구니·좋아요 배지)가 사라집니다.

### 4.3 3단계 — 장바구니·좋아요 DB 이전

| ID | 기능 | 우선순위 | 설명 |
|---|---|---|---|
| F-301 | 장바구니 DB 저장 | P0 | 로그인 사용자는 `cart_items`에 저장합니다. 담기·수량 변경·삭제·선택(`checked`)을 모두 DB에 반영합니다. 같은 상품·사이즈는 수량을 합칩니다(`unique(user_id, product_id, size)`). |
| F-302 | 비로그인 장바구니 | P0 | 비로그인 사용자는 기존처럼 localStorage(`moosin_cart`)를 씁니다. `Cart` 객체의 인터페이스는 유지하고 내부 저장소만 로그인 여부로 바꿉니다. |
| F-303 | 좋아요 DB 저장 | P0 | 로그인 사용자는 `likes`에 저장합니다. 헤더 배지(`#likeBadge`)와 `likes:change` 이벤트 흐름은 유지합니다. |
| F-304 | 비로그인 좋아요 | P1 | 기존 localStorage(`moosin_likes`) 유지. 또는 하트 클릭 시 로그인 유도 (결정 필요 D-4) |
| F-305 | 로그인 시 병합 | P0 | 로그인하는 순간 localStorage의 장바구니·좋아요를 DB로 합치고 localStorage를 비웁니다. 장바구니는 같은 상품·사이즈면 수량을 더하되 최대 수량(99)을 넘지 않게 합니다. |
| F-306 | 상품별 좋아요 수 | P2 | 상품 카드·상세에 좋아요 수 표시. view 또는 집계 컬럼 |

**완료 조건**
- PC에서 담은 장바구니가 다른 브라우저에서 같은 계정으로 로그인하면 보입니다.
- 비로그인 상태에서 담은 상품이 로그인 후에도 남아 있습니다.

### 4.4 4단계 — 주문·결제 (최우선)

| ID | 기능 | 우선순위 | 설명 |
|---|---|---|---|
| F-401 | 주문 생성 (Edge Function `create-order`) | P0 | 결제 버튼을 누르면 클라이언트는 `[{product_id, size, qty}]`와 주문자 정보만 보냅니다. 함수가 DB 상품가로 금액을 계산하고, `orders`(status=`pending`)와 `order_items`를 저장한 뒤 `{orderId, orderName, amount}`를 돌려줍니다. 클라이언트는 이 값으로 `widgets.setAmount()` 후 `requestPayment()`를 호출합니다. |
| F-402 | 서버 측 금액 계산 | P0 | `salePrice()`(100원 단위 반올림), `calcTotals()`(배송비 3,000원, 할인 후 50,000원 이상 무료)와 **같은 규칙**을 서버에서 구현합니다. 규칙은 한 곳(Postgres 함수 `calc_order_amount`)에 두고, 클라이언트 계산은 화면 표시용으로만 씁니다. |
| F-403 | 결제 승인 (Edge Function `confirm-payment`) | P0 | `success.html`이 `paymentKey`, `orderId`, `amount`를 넘기면 함수가 ① 주문 존재·`pending` 상태·금액 일치를 확인하고 ② 토스 시크릿 키로 `POST /v1/payments/confirm`을 호출한 뒤 ③ 성공하면 주문을 `paid`로 바꾸고 결제 정보를 `payments`에 저장합니다. |
| F-404 | 재고 차감 | P0 | 승인 직전에 재고를 확인·차감하는 작업을 한 트랜잭션(Postgres 함수)으로 처리합니다. 재고가 부족하면 승인 API를 호출하지 않고 주문을 `failed`로 바꿉니다. 승인 API가 실패하면 차감한 재고를 되돌립니다. |
| F-405 | 결제 성공 후 장바구니 정리 | P0 | 장바구니에서 주문한 경우(`from = "cart"`) 해당 `cart_items`를 서버에서 삭제합니다. |
| F-406 | 결제 실패·취소 처리 | P0 | `fail.html`에서 해당 주문을 `failed`/`canceled`로 바꿉니다. 일정 시간(30분) 지난 `pending` 주문은 만료 처리합니다. |
| F-407 | 중복 승인 방지 | P0 | `success.html` 새로고침 등으로 승인 요청이 두 번 와도 한 번만 처리합니다(주문 상태 확인 + 토스 `Idempotency-Key` 헤더). |
| F-408 | 주문 내역 조회 | P0 | 마이페이지가 `moosin_orders` 대신 `orders`/`order_items`를 조회합니다. 주문 상세(상품, 금액, 결제수단, 상태) 표시 |
| F-409 | 비회원 주문 조회 | P1 | 비회원 구매를 허용하면(D-1) 주문번호 + 휴대폰 번호로 조회하는 페이지·Edge Function을 추가합니다. |
| F-410 | 토스 웹훅 수신 (Edge Function `toss-webhook`) | P2 | 사용자가 결제 후 창을 닫아 `success.html`에 도달하지 못해도 결제 상태를 맞춥니다. |
| F-411 | 주문 취소·환불 (Edge Function `cancel-payment`) | P2 | 마이페이지에서 결제 완료 주문을 취소합니다. 토스 취소 API 호출 후 재고 복원, 주문 상태 `canceled` |
| F-412 | 회원 결제 customerKey | P1 | 로그인 사용자는 `TossPayments.ANONYMOUS` 대신 사용자 UUID를 `customerKey`로 넘깁니다. |

**완료 조건**
- 개발자 도구로 금액을 바꿔 결제를 시도하면 승인이 거절되고 주문이 `failed`가 됩니다.
- 정상 결제 후 토스 개발자센터 테스트 결제 내역에 "완료"로 표시됩니다.
- 결제 완료 후 `product_sizes.stock`이 주문 수량만큼 줄어 있습니다.
- `success.html`을 새로고침해도 결제가 두 번 승인되지 않습니다.
- `moosin_pending_order`, `moosin_orders` localStorage 키를 더 이상 쓰지 않습니다.

### 4.5 5단계 — 부가 기능 (선택)

| ID | 기능 | 우선순위 | 설명 |
|---|---|---|---|
| F-501 | 상품 검색 | P2 | 헤더 검색창. 브랜드·상품명 `ilike` 검색 또는 Postgres full-text search |
| F-502 | 필터·정렬·페이지네이션 | P2 | 카테고리 페이지의 정렬(인기순, 가격순, 할인율순)을 DB 쿼리로. `range()`로 페이지네이션 |
| F-503 | 리뷰·평점 | P2 | `reviews` 테이블. 결제 완료 주문의 상품만 작성 가능(RLS). 상품의 `review_count`, `rating`을 집계로 갱신 |
| F-504 | 상품 이미지 Storage 이전 | P2 | Unsplash 핫링크 대신 Supabase Storage 공개 버킷 |
| F-505 | 관리자 기능 | P2 | `profiles.role = 'admin'`. 상품 등록·수정·재고 관리, 주문 상태 변경 페이지 |

---

## 5. 주요 흐름

### 5.1 결제 흐름 (변경 후)

```
[checkout.html]
  1. 화면 표시용 금액 계산 (calcTotals)
  2. 결제 버튼 클릭 → 주문자 정보 검증
  3. Edge Function create-order 호출  ──▶  DB 상품가로 금액 계산
                                          orders(pending) + order_items 저장
     ◀── { orderId, orderName, amount }
  4. widgets.setAmount(amount)  ※ 서버 금액과 화면 금액이 다르면 다시 그림
  5. widgets.requestPayment({ orderId, ... })
        │
        ▼ 토스 결제창
        │
[success.html?paymentKey&orderId&amount]
  6. Edge Function confirm-payment 호출 ──▶  주문 상태·금액 검증
                                           재고 확인·차감 (트랜잭션)
                                           토스 POST /v1/payments/confirm
                                           성공: orders=paid, payments 저장, 장바구니 정리
                                           실패: 재고 복원, orders=failed
     ◀── { status, order }
  7. 결과 표시

[fail.html?code&message&orderId]
  6'. 주문 상태를 failed/canceled로 변경, 메시지 표시
```

### 5.2 로그인 시 데이터 병합

```
로그인 성공 (onAuthStateChange: SIGNED_IN)
  → localStorage moosin_cart 읽기 → cart_items upsert (수량 합산, 최대 99)
  → localStorage moosin_likes 읽기 → likes upsert (중복 무시)
  → localStorage 두 키 삭제
  → 헤더 배지 갱신, likes:change / cart:change 이벤트 발행
```

---

## 6. 데이터 모델

금액은 모두 원 단위 정수(`integer`)입니다. 모든 테이블에 `created_at timestamptz default now()`를 둡니다.

### categories

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | text PK | `tops`, `pants`, `shoes` |
| name | text | 상의 |
| name_en | text | TOPS |
| description | text | 티셔츠 · 셔츠 · 니트 · 후드 |
| sort_order | int | |

### products

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | text PK | 기존 id 유지 (`t01`) |
| category_id | text FK → categories | |
| brand | text | |
| name | text | |
| price | int | 정가 |
| sale_rate | int | 할인율 0~100 (기존 `sale`) |
| color | text | SVG 플레이스홀더 색상 |
| image_url | text null | |
| review_count | int default 0 | |
| rating | numeric(2,1) | |
| tag | text | 무료배송, 단독 등 |
| is_active | bool default true | 판매 중 여부 |

### product_sizes

| 컬럼 | 타입 | 비고 |
|---|---|---|
| product_id | text FK → products | PK (product_id, size) |
| size | text | S, 28, 260 등 |
| stock | int default 0 | `check (stock >= 0)` |
| sort_order | int | |

### profiles

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK, FK → auth.users | |
| name | text | |
| phone | text | |
| role | text default `'user'` | `user` / `admin` |

### addresses

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| recipient | text | 받는 사람 |
| phone | text | |
| zipcode | text | |
| address1 | text | |
| address2 | text | |
| is_default | bool | 사용자당 1개 (partial unique index) |

### cart_items

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| product_id | text FK → products | |
| size | text | |
| qty | int | `check (qty between 1 and 99)` |
| checked | bool default true | |
| | | `unique (user_id, product_id, size)` |

### likes

| 컬럼 | 타입 | 비고 |
|---|---|---|
| user_id | uuid FK → auth.users | PK (user_id, product_id) |
| product_id | text FK → products | |

### orders

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | text PK | 토스 orderId (`MOOSIN-<timestamp>-<random>`, 6~64자) |
| user_id | uuid null | 비회원이면 null |
| order_name | text | "상품명 외 N건" |
| status | text | `pending` / `paid` / `failed` / `canceled` / `expired` |
| source | text | `cart` / `direct` |
| original_amount | int | 정가 합계 |
| discount_amount | int | |
| shipping_fee | int | |
| total_amount | int | 최종 결제 금액 |
| orderer_name / orderer_phone / orderer_email | text | |
| shipping_address | jsonb | 주문 시점 배송지 스냅샷 |
| paid_at | timestamptz null | |

### order_items

주문 시점의 상품 정보를 스냅샷으로 저장합니다(이후 상품가가 바뀌어도 주문 내역은 그대로).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| order_id | text FK → orders | |
| product_id | text FK → products | |
| product_name / brand / image_url | text | 스냅샷 |
| size | text | |
| qty | int | |
| unit_price | int | 할인 적용 단가 |
| line_amount | int | unit_price × qty |

### payments

| 컬럼 | 타입 | 비고 |
|---|---|---|
| payment_key | text PK | 토스 paymentKey |
| order_id | text FK → orders | |
| method | text | 카드, 간편결제 등 |
| amount | int | |
| status | text | 토스 응답 status |
| approved_at | timestamptz | |
| raw | jsonb | 토스 승인 응답 전체 |

### reviews (P2)

`id`, `user_id`, `product_id`, `order_item_id`(unique), `rating`(1~5), `content`, `created_at`

---

## 7. 보안 (RLS)

| 테이블 | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| categories, products, product_sizes | 누구나 (`is_active`인 상품만) | admin만 |
| profiles | 본인 | 본인 UPDATE (role 컬럼 제외) |
| addresses | 본인 | 본인 |
| cart_items | 본인 | 본인 |
| likes | 본인 | 본인 |
| orders, order_items | 본인 | **클라이언트 불가** — Edge Function(service_role)만 |
| payments | 본인 주문만 | **클라이언트 불가** — Edge Function만 |
| reviews | 누구나 | 본인, 결제 완료 주문 상품만 |

추가 원칙
- 결제 금액은 절대 클라이언트 값을 믿지 않습니다. `confirm-payment`는 쿼리스트링의 `amount`를 DB `orders.total_amount`와 비교만 합니다.
- Edge Function은 요청의 JWT로 사용자를 확인하고, 다른 사용자의 주문을 처리하지 않습니다.
- 토스 승인 API 에러 메시지는 그대로 노출하지 않고 이스케이프해서 표시합니다(기존 `fail.html` 방식 유지).

## 8. Edge Functions 목록

| 이름 | 단계 | 인증 | 역할 |
|---|---|---|---|
| `create-order` | 4 | 선택 (비회원 허용 시) | 금액 계산, pending 주문 생성 |
| `confirm-payment` | 4 | 선택 | 금액 검증, 재고 차감, 토스 승인, 주문 확정 |
| `fail-order` | 4 | 선택 | 주문 failed/canceled 처리 (RPC로 대체 가능) |
| `guest-order-lookup` | 4 (P1) | 없음 | 주문번호 + 휴대폰 번호 조회 |
| `toss-webhook` | 4 (P2) | 토스 서명 검증 | 결제 상태 동기화 |
| `cancel-payment` | 4 (P2) | 필수 | 결제 취소, 재고 복원 |

환경변수: `TOSS_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(기본 제공), `SITE_URL`

## 9. 비기능 요구사항

| 항목 | 기준 |
|---|---|
| 성능 | 카테고리 페이지 상품 목록 조회 1회 요청, 응답 500ms 이내 |
| 오류 처리 | 네트워크·DB 오류 시 빈 화면 대신 오류 메시지와 재시도 버튼 표시. `toast()` 활용 |
| 로딩 상태 | 비동기 조회 동안 스켈레톤 또는 로딩 표시 |
| 호환성 | 기존 URL(`product.html?id=t01`), 반응형 기준점(1100 / 860 / 600px), 디자인 유지 |
| 로컬 개발 | `serve.ps1`(http://localhost:5500)에서 동작. Supabase Auth의 Site URL·Redirect URL에 `http://localhost:5500` 등록 |
| 관측 | Edge Function에서 결제 승인 실패 시 orderId, 토스 에러 코드를 로그로 남김 |

## 10. 마일스톤

권장 순서는 **1단계 → 4단계 → 2단계 → 3단계 → 5단계**입니다. 결제 승인이 빠져 있는 것이 가장 큰 공백이라, 상품 DB를 옮긴 다음 바로 결제를 마무리합니다. 4단계는 처음에 비회원 주문(user_id null)으로 구현하고, 2단계가 끝나면 회원 주문을 연결합니다.

| 마일스톤 | 포함 기능 | 산출물 |
|---|---|---|
| M1 기반 | F-101 ~ F-106 | 스키마·seed 마이그레이션, `js/supabase.js`, 상품 조회 비동기화 |
| M2 결제 완성 | F-401 ~ F-408, F-406 | Edge Function 2~3개, 결제 E2E 동작 |
| M3 회원 | F-201 ~ F-205, F-209, F-412 | 로그인/회원가입 페이지, 헤더 상태 |
| M4 데이터 이전 | F-301 ~ F-305, F-206, F-207 | 장바구니·좋아요 DB 저장, 병합 |
| M5 부가 | F-409 ~ F-411, F-501 ~ F-505 | 선택 |

각 마일스톤 종료 시 `CLAUDE.md`의 아키텍처·localStorage 키 표를 갱신합니다.

## 11. 결정 필요 사항

| ID | 질문 | 권장안 |
|---|---|---|
| D-1 | 비회원 구매를 허용할까요? | 허용. 쇼핑몰 샘플 특성상 결제 체험 진입 장벽을 낮춥니다. F-409 필요 |
| D-2 | 로그인 방식은? | 이메일로 시작, 소셜 로그인은 P2 |
| D-3 | 이메일 인증(가입 확인 메일)을 켤까요? | 개발 중에는 끄고, 배포 전에 켭니다. |
| D-4 | 비로그인 상태의 좋아요는? | localStorage 유지 후 로그인 시 병합 (현재 UX 유지) |
| D-5 | Edge Function 배포 방법은? | Supabase MCP로 배포, 소스는 `supabase/functions/`에 보관 |
| D-6 | 초기 재고 수량은? | 사이즈별 50개로 seed |
| D-7 | pending 주문 만료 처리 방법은? | `pg_cron`으로 30분마다 `expired` 처리 |

## 12. 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 동기 함수 `getProduct()`의 async 전환 | 여러 페이지 렌더링 코드 수정 필요 | 1단계에서 페이지별로 순차 전환, 공통 로딩 처리 함수 도입 |
| 클라이언트·서버 금액 계산 규칙 불일치 | 화면 금액과 결제 금액이 다름 | 서버 금액을 기준으로 `setAmount()`를 다시 호출하고, 차이가 나면 안내 후 다시 그림 |
| 결제 승인 성공 후 DB 갱신 실패 | 돈은 나갔는데 주문이 pending | 토스 응답을 먼저 `payments`에 저장, 웹훅(F-410)으로 보정, 실패 로그 남김 |
| Node.js 부재로 CLI 사용 불가 | 로컬 테스트·배포 어려움 | MCP/대시보드 배포, SQL 파일로 이력 관리 |
| publishable 키 노출 | RLS 누락 시 데이터 유출 | 모든 테이블 RLS 활성화 확인을 마일스톤 체크리스트에 포함 (Supabase advisors 점검) |
