# MOOSIN STORE (토스페이먼츠 결제 테스트 쇼핑몰)

HTML/CSS/JS로 만든 의류 쇼핑몰 퍼블리싱 샘플입니다. 토스페이먼츠 결제위젯 v2(테스트 모드)를 연동했습니다.

## 페이지
- `index.html` 메인
- `tops.html` / `pants.html` / `shoes.html` 카테고리
- `product.html?id=...` 상품 상세
- `cart.html` 장바구니
- `checkout.html` 주문/결제 (토스페이먼츠 결제위젯)
- `success.html` / `fail.html` 결제 결과

## 실행
`file://`로 열면 결제창 이동이 막힐 수 있으니 로컬 서버로 여세요.

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

실행 후 http://localhost:5500 에 접속합니다.

## 참고
- 클라이언트 키는 `js/checkout.js`의 `TOSS_CLIENT_KEY`에 있습니다(문서용 테스트 키).
- 결제 승인 API(`POST /v1/payments/confirm`)는 시크릿 키가 필요해 서버에서 호출해야 하며, 이 저장소에는 포함되어 있지 않습니다.
