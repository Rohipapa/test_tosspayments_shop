# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

빌드 도구, 프레임워크, 패키지 매니저 없이 순수 HTML/CSS/JS로 만든 의류 쇼핑몰 퍼블리싱 샘플입니다. 결제는 토스페이먼츠 결제위젯 SDK v2(테스트 모드)를 CDN(`https://js.tosspayments.com/v2/standard`)으로 불러와 연동하고, 상품·회원·장바구니·주문 데이터는 Supabase(Postgres, Auth, Edge Functions)에 둡니다. 빌드, 린트, 테스트 단계는 없습니다.

## 진행 중인 작업

Supabase DB 연동은 `PRD.md`의 M1~M4(기반, 결제 완성, 회원, 데이터 이전)까지 끝났습니다. 남은 것은 M5 부가 기능(F-409~F-411, F-501~F-505)입니다. 기능 ID, 데이터 모델, RLS, Edge Function은 `PRD.md`를 기준으로 합니다. 마일스톤을 하나 끝낼 때마다 이 파일의 아키텍처 설명과 localStorage 키 표를 고칩니다.

## Supabase

- 프로젝트 `moosin-shop`, project ref `llqdfxmyyaqiawchdpdz`(서울 리전, `Rohipapa's Org`). Supabase MCP로 관리합니다.
- Node.js가 없어 Supabase CLI를 쓰지 않습니다. 스키마 변경은 `supabase/migrations/`에 SQL 파일을 추가한 뒤 같은 내용을 MCP `apply_migration`으로 적용하고, Edge Function은 `supabase/functions/<이름>/index.ts`를 고친 뒤 MCP `deploy_edge_function`으로 배포합니다. 두 함수 모두 `verify_jwt: false`로 배포하고 함수 안에서 JWT를 직접 확인합니다(비회원 주문 허용).
- 상품 데이터는 `supabase/seed.sql`(upsert라 다시 실행해도 됨). 재고는 사이즈별 50개로 시작합니다.
- 스키마를 바꾼 뒤에는 MCP `get_advisors`(security, performance)로 RLS 누락을 점검합니다. `fail_order`의 anon 실행 경고는 의도된 것입니다(비회원 결제 실패 처리).
- 대시보드에서만 바꿀 수 있는 설정(이메일 인증 끄기, Site/Redirect URL, `TOSS_SECRET_KEY` Secret)은 `README.md`에 정리되어 있습니다.

## 실행

`file://`로 열면 결제창 리다이렉트가 막힐 수 있으니 반드시 로컬 서버로 엽니다.

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

`serve.ps1`은 `HttpListener`로 만든 정적 파일 서버이며, http://localhost:5500 으로 접속합니다. `.claude/launch.json`의 `shop` 설정도 같은 스크립트를 실행합니다.

## 개발 환경 제약 (이 PC)

- Node.js, Python(실제 실행 파일)이 없습니다. `npx`가 필요한 `.mcp.json`의 토스페이먼츠 MCP 서버(`tosspayments-integration-guide`)는 Node.js를 설치하기 전까지 연결되지 않습니다.
- Git은 PATH에 등록되지 않은 포터블 MinGit을 씁니다. 경로는 `$env:LOCALAPPDATA\Programs\MinGit\cmd\git.exe`이고, `& $g <명령>` 형태로 호출합니다.
- `credential.helper=manager`가 설정되어 있고 GitHub 인증 정보도 저장되어 있어서 비대화형 셸에서도 `git push`가 됩니다. 인증이 만료되어 로그인 창이 필요하면, 사용자 터미널 탭에서 푸시를 실행해 사용자가 직접 로그인하게 합니다.
- 원격 저장소는 `origin` = https://github.com/Rohipapa/test_tosspayments_shop.git (`main` 브랜치)입니다.
- `claude` CLI도 PATH에 없습니다. 실행 파일은 `$env:APPDATA\Claude\claude-code\<버전>\<해시>\claude.exe`에 있고, 버전 폴더는 바뀔 수 있으니 검색해서 찾습니다.
- `claude plugin marketplace add`처럼 내부에서 git을 쓰는 명령은 먼저 `$env:PATH = "$env:LOCALAPPDATA\Programs\MinGit\cmd;$env:PATH"`로 MinGit을 PATH에 넣어야 합니다.

## 아키텍처

### 스크립트 로드 순서와 전역 공유

모듈 시스템 없이 `<script>` 태그 순서대로 전역 함수와 상수를 공유합니다. 모든 페이지는 다음 순서를 지킵니다.

1. `supabase-js` CDN (`cdn.jsdelivr.net/npm/@supabase/supabase-js@2.100.0/dist/umd/supabase.js`, 버전 고정)
2. `js/supabase.js`: 클라이언트 `sb`, `Auth`(`user`, `ready`, `loginUrl()`, `requireLogin()`), `safeRedirect()`, `callFunction()`(Edge Function 호출, 실패 시 `err.code`/`err.message`를 담아 throw)
3. `js/products.js`: `CATEGORIES` 상수, `Products`(`list()`, `byIds()`, `get()`, `cached()`), `getProduct()`(async), `productImage()`, `salePrice()`
4. `js/common.js`: `$`/`$$`, `won()`, `esc()`, `store`(try/catch로 감싼 localStorage), `Cart`, `Checkout`, `Likes`, `calcTotals()`, `App.ready`, `mergeLocalData()`, `withLoading()`/`skeletonGrid()`, `productCard()`, `toast()`. `DOMContentLoaded` 시점에 `#header`/`#footer`를 JS로 렌더링하고, `App.ready` 뒤에 로그인 상태로 헤더를 다시 그립니다.
5. 페이지 전용 스크립트: `js/category.js`, `js/checkout.js`. 나머지 페이지는 HTML 안의 인라인 스크립트를 씁니다.

헤더 GNB의 활성 탭은 `<body data-category="...">` 값(`tops`/`pants`/`shoes`/`cart`, 없으면 홈)으로 정해집니다. 로그인·가입·재설정 페이지는 `data-category="login"`입니다.

### 비동기 데이터와 로딩

상품은 DB에서 조회하므로 모든 렌더링이 비동기입니다. 페이지는 `withLoading(el, skeleton, task)`로 조회하는 동안 스켈레톤을 보여 주고, 실패하면 오류 메시지와 "다시 시도" 버튼을 그립니다. 상품 카드의 하트와 장바구니 배지가 맞으려면 `App.ready`(세션 확인 → 병합 → 장바구니·좋아요 로드)를 기다린 뒤 그립니다. `calcTotals()`와 `Products.cached()`는 동기라서, 쓰기 전에 `Products.byIds()`로 상품을 먼저 조회해 둬야 합니다.

### 카테고리 페이지

`tops.html`, `pants.html`, `shoes.html`은 `data-category`와 `<title>`만 다르고 나머지는 같습니다. 실제 내용은 `js/category.js`가 `body[data-category]`를 읽어 그립니다. 마크업을 바꿀 때는 세 파일을 함께 수정해야 합니다. 새 카테고리를 추가하려면 DB(`categories`, `products`, `product_sizes`)에 데이터를 넣고, `CATEGORIES`와 `SILHOUETTE`(products.js)에 항목을 넣고, HTML 파일을 하나 더 만듭니다. 사이즈 목록은 상품별로 `product_sizes`에서 옵니다(재고 0이면 상세 페이지에서 비활성).

### 상품 이미지

상품 사진은 Unsplash 무료 라이선스 사진을 `images.unsplash.com`에서 핫링크하며, URL은 `products.image_url`에 있습니다(`supabase/seed.sql`). `productImage(p)`는 `img`가 있으면 그 값을 쓰고, 없을 때만 `color`와 카테고리별 `SILHOUETTE` path로 SVG 플레이스홀더를 그립니다. 사진을 바꿀 때 Unsplash+(`plus.unsplash.com`) 사진은 유료라 쓰면 안 됩니다.

### 금액 계산

할인가는 100원 단위 반올림, 배송비는 3,000원이고 할인 후 금액이 50,000원 이상이면 무료입니다. **실제 결제 금액의 기준은 DB 함수 `calc_order_amount()` 하나입니다.** 화면 표시용으로 `salePrice()`(products.js)와 `calcTotals()`(common.js, `SHIPPING_FEE`, `FREE_SHIPPING_OVER`)가 같은 규칙을 구현하므로, 규칙을 바꿀 때는 이 세 곳을 함께 고칩니다.

### 장바구니·좋아요 저장소

`Cart`와 `Likes`는 메모리에 현재 목록(`list`)을 들고 있어서 읽기(`items()`, `ids()`, `has()`, `count()`)는 동기, 쓰기는 비동기입니다. 로그인하면 DB(`cart_items`, `likes`), 아니면 localStorage에 저장합니다. `Cart.save(items)`는 이전 목록과 비교해 바뀐 행만 upsert/delete하고, `Cart.add()`는 로그인 시 RPC `merge_cart`(같은 상품·사이즈 수량 합산, 최대 99)를 씁니다. `Likes.toggle()`은 화면을 먼저 바꾸고 저장에 실패하면 되돌립니다.

로그인하는 순간 `mergeLocalData()`가 localStorage의 장바구니·좋아요를 RPC `merge_cart`/`merge_likes`로 DB에 합치고 localStorage를 비웁니다. `onAuthStateChange`(common.js)가 로그인·로그아웃을 감지하면 저장소를 다시 읽고, 헤더와 하트를 다시 그린 뒤 `auth:change`, `cart:change`, `likes:change` 이벤트를 보냅니다. `likes:change`의 `detail.id`가 있으면 하트 클릭 한 번, 없으면 목록 전체가 바뀐 경우입니다.

하트 버튼(`[data-like]`) 클릭은 `common.js`의 전역 핸들러가 처리합니다. 헤더 유틸 링크의 활성 표시는 `data-category="likes"`/`"mypage"`/`"cart"`/`"login"`으로 정해집니다.

### localStorage 키

| 키 | 용도 |
|---|---|
| `moosin_cart` | 비로그인 장바구니 `[{id, size, qty, checked}]`. 로그인하면 DB로 옮기고 지움 |
| `moosin_likes` | 비로그인 좋아요 상품 id 배열(최근 것이 앞). 로그인하면 DB로 옮기고 지움 |
| `moosin_checkout` | 결제할 상품 `{items, from}`. `from`은 `"cart"` 또는 `"direct"`(바로구매). 결제 성공 시 지움 |

Supabase 세션은 supabase-js가 자체 키(`sb-<ref>-auth-token`)로 저장합니다. 예전의 `moosin_pending_order`, `moosin_orders`는 더 이상 쓰지 않습니다.

### 결제 흐름

1. `product.html`(바로구매) 또는 `cart.html`(선택 상품 주문)이 `Checkout.set()`을 호출한 뒤 `checkout.html`로 이동합니다.
2. `js/checkout.js`가 `widgets.setAmount()` → `renderPaymentMethods()`/`renderAgreement()` 순서로 위젯을 띄웁니다. 로그인 사용자는 `customerKey`로 user id를 쓰고, 주문자 정보(profiles)와 저장된 배송지(addresses)를 채웁니다.
3. 결제 버튼을 누르면 Edge Function `create-order`에 `[{product_id, size, qty}]`, 주문자, 배송지만 보냅니다. 함수가 DB 함수 `create_order()`로 금액을 계산하고 `orders`(pending)·`order_items`(스냅샷)를 저장한 뒤 `{orderId, orderName, amount}`를 돌려줍니다. 서버 금액이 화면과 다르면 `setAmount()`로 다시 그리고 사용자가 다시 누르게 합니다. 같으면 `requestPayment()`를 호출합니다. 결제창을 닫으면 RPC `fail_order`로 주문을 취소 처리합니다.
4. `success.html`이 Edge Function `confirm-payment`를 호출합니다. 함수는 `begin_payment()`(주문 행 잠금, 소유자·상태·금액 확인, 재고 확인·차감, `processing`으로 변경) → 토스 `POST /v1/payments/confirm`(`Idempotency-Key: confirm-<orderId>`) → 성공 시 `complete_payment()`(payments 저장, `paid`, 장바구니 주문이면 `cart_items` 삭제), 실패 시 `abort_payment()`(재고 복원, `failed`) 순서로 처리합니다. 이미 `paid`인 주문에 같은 paymentKey가 오면 결과만 돌려주므로 새로고침해도 한 번만 승인됩니다.
5. `fail.html`은 `code`/`message`를 이스케이프해서 표시하고, RPC `fail_order`로 pending 주문을 `failed`(사용자 취소면 `canceled`)로 바꿉니다. 30분 지난 pending 주문은 pg_cron 작업 `expire-pending-orders`가 `expired`로 바꿉니다.

주문 상태는 `pending → processing → paid`, 실패 시 `failed`/`canceled`/`expired`입니다. 주문·결제 테이블은 클라이언트가 쓸 수 없고(RLS + 권한 회수), 서버 전용 DB 함수는 `service_role`만 실행할 수 있습니다.

**시크릿 키는 프론트엔드에 넣으면 안 됩니다.** 토스 시크릿 키는 Edge Function Secret `TOSS_SECRET_KEY`로 넣고, 없으면 `confirm-payment`가 토스 문서에 공개된 테스트 시크릿 키(`test_gsk_docs_...`)를 씁니다. 클라이언트 키는 `js/checkout.js`의 `TOSS_CLIENT_KEY`(문서용 테스트 키 `test_gck_docs_...`)이고, 둘은 같은 상점의 짝이어야 합니다.

### 회원과 마이페이지

`login.html`(`?redirect=`로 원래 페이지 복귀, `safeRedirect()`로 같은 사이트 상대 경로만 허용), `signup.html`(이름·휴대폰은 `user_metadata`로 넘기고 DB trigger `handle_new_user`가 `profiles`에 저장), `reset.html`(재설정 메일 요청 + 메일 링크로 들어오면 새 비밀번호 설정)이 있습니다. `mypage.html`은 `Auth.requireLogin()`으로 비로그인 사용자를 로그인 페이지로 보내고, 주문 내역(pending·expired 제외), 회원 정보 수정, 비밀번호 변경, 배송지 관리(기본 배송지는 RPC `set_default_address`), 좋아요 상품을 보여 줍니다. 비회원 주문은 `user_id`가 null이라 마이페이지에 나오지 않습니다(비회원 주문 조회 F-409는 M5).

## 스타일

모든 스타일은 `css/style.css` 하나에 있고, 색상은 `:root` CSS 변수로 관리합니다. 무신사처럼 검은 헤더와 흰 배경, 빨간 할인율을 쓰고, 클래스 이름은 BEM 비슷한 규칙(`.card__thumb`, `.is-active`)을 따릅니다. 반응형 기준점은 1100 / 860 / 600px입니다.
