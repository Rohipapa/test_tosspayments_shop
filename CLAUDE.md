# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

빌드 도구, 프레임워크, 패키지 매니저 없이 순수 HTML/CSS/JS로 만든 의류 쇼핑몰 퍼블리싱 샘플입니다. 결제는 토스페이먼츠 결제위젯 SDK v2(테스트 모드)를 CDN(`https://js.tosspayments.com/v2/standard`)으로 불러와 연동합니다. 빌드, 린트, 테스트 단계는 없습니다.

## 실행

`file://`로 열면 결제창 리다이렉트가 막힐 수 있으니 반드시 로컬 서버로 엽니다.

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

`serve.ps1`은 `HttpListener`로 만든 정적 파일 서버이며, http://localhost:5500 으로 접속합니다. `.claude/launch.json`의 `shop` 설정도 같은 스크립트를 실행합니다.

## 개발 환경 제약 (이 PC)

- Node.js, Python(실제 실행 파일)이 없습니다. `npx`가 필요한 `.mcp.json`의 토스페이먼츠 MCP 서버(`tosspayments-integration-guide`)는 Node.js를 설치하기 전까지 연결되지 않습니다.
- Git은 PATH에 등록되지 않은 포터블 MinGit을 씁니다. 경로는 `$env:LOCALAPPDATA\Programs\MinGit\cmd\git.exe`이고, `& $g <명령>` 형태로 호출합니다.
- MinGit에는 credential manager가 없어서 `git push`를 하려면 사용자가 터미널에서 직접 GitHub 로그인을 해야 합니다. 비대화형 셸에서 푸시하면 실패합니다.
- 원격 저장소는 `origin` = https://github.com/Rohipapa/test_tosspayments_shop.git (`main` 브랜치)입니다.

## 아키텍처

### 스크립트 로드 순서와 전역 공유

모듈 시스템 없이 `<script>` 태그 순서대로 전역 함수와 상수를 공유합니다. 모든 페이지는 다음 순서를 지킵니다.

1. `js/products.js`: `CATEGORIES`, `SIZES`, `PRODUCTS` 더미 데이터와 `productImage()`, `salePrice()`, `getProduct()`
2. `js/common.js`: `$`/`$$`, `won()`, `store`(try/catch로 감싼 localStorage), `Cart`, `Checkout`, `Likes`, `calcTotals()`, `productCard()`, `toast()`. `DOMContentLoaded` 시점에 `#header`/`#footer`를 JS로 렌더링합니다.
3. 페이지 전용 스크립트: `js/category.js`, `js/checkout.js`. 나머지 페이지는 HTML 안의 인라인 스크립트를 씁니다.

헤더 GNB의 활성 탭은 `<body data-category="...">` 값(`tops`/`pants`/`shoes`/`cart`, 없으면 홈)으로 정해집니다.

### 카테고리 페이지

`tops.html`, `pants.html`, `shoes.html`은 `data-category`와 `<title>`만 다르고 나머지는 같습니다. 실제 내용은 `js/category.js`가 `body[data-category]`를 읽어 그립니다. 마크업을 바꿀 때는 세 파일을 함께 수정해야 합니다. 새 카테고리를 추가하려면 `CATEGORIES`, `SIZES`, `SILHOUETTE`(products.js)에 항목을 넣고 HTML 파일을 하나 더 만듭니다.

### 상품 이미지

실제 이미지 없이 `productImage(p)`가 상품의 `color`와 카테고리별 `SILHOUETTE` path로 SVG data URI를 만듭니다. 상품 객체에 `img` 필드가 있으면 그 값을 우선 사용합니다.

### 금액 계산

할인가는 `salePrice()`(100원 단위 반올림)로, 주문 합계는 `calcTotals()`로 구합니다. 배송비는 `SHIPPING_FEE`(3,000원)이고, 할인 후 금액이 `FREE_SHIPPING_OVER`(50,000원) 이상이면 무료입니다. 장바구니, 결제, 상세 페이지가 모두 이 두 함수를 쓰므로 금액 규칙은 이 두 곳에서만 바꿉니다.

### 결제 흐름과 localStorage 키

| 키 | 용도 |
|---|---|
| `moosin_cart` | 장바구니 `[{id, size, qty, checked}]` |
| `moosin_checkout` | 결제할 상품 `{items, from}`. `from`은 `"cart"` 또는 `"direct"`(바로구매) |
| `moosin_pending_order` | 결제 요청 직전에 저장한 `{orderId, orderName, amount, items, from}` |
| `moosin_likes` | 좋아요한 상품 id 배열 |

1. `product.html`(바로구매) 또는 `cart.html`(선택 상품 주문)이 `Checkout.set()`을 호출한 뒤 `checkout.html`로 이동합니다.
2. `js/checkout.js`가 `widgets.setAmount()` → `renderPaymentMethods()`/`renderAgreement()` 순서로 위젯을 띄우고, 결제 버튼을 누르면 `moosin_pending_order`를 저장한 뒤 `requestPayment()`를 호출합니다. 금액을 바꿀 때는 렌더링 전에 반드시 `setAmount()`를 다시 호출해야 합니다.
3. `success.html`은 쿼리스트링의 `orderId`/`amount`가 `moosin_pending_order`와 일치하는지 검사합니다. 일치하면 `from === "cart"`인 상품을 장바구니에서 지우고 저장된 키를 정리합니다.
4. `fail.html`은 `code`/`message`를 이스케이프해서 표시합니다.

**결제 승인 API(`POST /v1/payments/confirm`)는 구현되어 있지 않습니다.** 시크릿 키가 필요하므로 서버에서 호출해야 하며, 프론트엔드에 넣으면 안 됩니다. 예시 코드는 `success.html` 주석에 있습니다. 클라이언트 키는 `js/checkout.js`의 `TOSS_CLIENT_KEY`(문서용 테스트 키 `test_gck_docs_...`)입니다.

## 스타일

모든 스타일은 `css/style.css` 하나에 있고, 색상은 `:root` CSS 변수로 관리합니다. 무신사처럼 검은 헤더와 흰 배경, 빨간 할인율을 쓰고, 클래스 이름은 BEM 비슷한 규칙(`.card__thumb`, `.is-active`)을 따릅니다. 반응형 기준점은 1100 / 860 / 600px입니다.
