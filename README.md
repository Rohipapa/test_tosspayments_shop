# MOOSIN STORE (토스페이먼츠 결제 테스트 쇼핑몰)

HTML/CSS/JS로 만든 의류 쇼핑몰 퍼블리싱 샘플입니다. 토스페이먼츠 결제위젯 v2(테스트 모드)와 Supabase(DB·인증·Edge Function)를 연동했습니다.

## 페이지
- `index.html` 메인
- `tops.html` / `pants.html` / `shoes.html` 카테고리
- `product.html?id=...` 상품 상세
- `cart.html` 장바구니, `likes.html` 좋아요
- `checkout.html` 주문/결제 (토스페이먼츠 결제위젯)
- `success.html` / `fail.html` 결제 결과
- `login.html` / `signup.html` / `reset.html` 로그인, 회원가입, 비밀번호 재설정
- `mypage.html` 마이페이지 (로그인 필요)

## 실행
`file://`로 열면 결제창 이동이 막힐 수 있으니 로컬 서버로 여세요.

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

실행 후 http://localhost:5500 에 접속합니다.

## Supabase
- 프로젝트: `moosin-shop` (`llqdfxmyyaqiawchdpdz`, 서울 리전)
- 스키마: `supabase/migrations/`, 상품 데이터: `supabase/seed.sql`
- Edge Function: `supabase/functions/create-order`, `supabase/functions/confirm-payment`
- 프론트엔드의 URL과 publishable 키는 `js/supabase.js`에 있습니다.

### 대시보드에서 직접 설정할 것
1. **Authentication → Sign In / Providers → Email**: 개발 중에는 "Confirm email"을 끕니다(PRD D-3). 켜 두면 가입 후 확인 메일 링크를 눌러야 로그인됩니다.
2. **Authentication → URL Configuration**: Site URL을 `http://localhost:5500`으로, Redirect URLs에 `http://localhost:5500/**`를 추가합니다. (가입 확인·비밀번호 재설정 메일 링크)
3. **Edge Functions → Secrets**: 내 상점의 토스 시크릿 키를 `TOSS_SECRET_KEY`로 넣습니다. 넣지 않으면 토스 문서에 공개된 테스트 시크릿 키(`js/checkout.js`의 문서용 클라이언트 키와 짝)를 씁니다.

## 참고
- 클라이언트 키는 `js/checkout.js`의 `TOSS_CLIENT_KEY`에 있습니다(문서용 테스트 키). 내 상점 키로 바꾸면 3번의 시크릿 키도 같은 상점 것으로 바꿔야 합니다.
- 결제 금액은 서버(`calc_order_amount` DB 함수)가 계산하고, 결제 승인은 Edge Function `confirm-payment`가 호출합니다.
