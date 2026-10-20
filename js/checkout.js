/* ==========================================================
   주문/결제 — 토스페이먼츠 결제위젯 v2 연동
   https://docs.tosspayments.com/guides/v2/payment-widget/integration
   ========================================================== */

/* 문서용 테스트 클라이언트 키 (결제위젯 연동 키).
   내 상점 키로 바꾸려면 개발자센터 > API 키 > "결제위젯 연동 키"의 클라이언트 키(test_gck_...)를 넣으세요.
   ⚠ 시크릿 키(test_gsk_...)는 절대 프론트엔드에 넣지 마세요. */
const TOSS_CLIENT_KEY = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

const PENDING_ORDER_KEY = "moosin_pending_order";

(async function () {
  const root = $("#checkout");
  const data = Checkout.get();
  const t = data ? calcTotals(data.items) : null;

  if (!t || !t.lines.length) {
    root.innerHTML = `<div class="empty"><strong>결제할 상품이 없어요</strong><a class="btn btn--black" href="cart.html">장바구니로 가기</a></div>`;
    return;
  }

  const orderName =
    t.lines[0].product.name.slice(0, 80) + (t.lines.length > 1 ? ` 외 ${t.lines.length - 1}건` : "");

  root.innerHTML = `
    <div class="order">
      <div>
        ${location.protocol === "file:" ? `<p class="test-notice">파일(file://)로 열면 결제창 이동이 막힐 수 있어요. 로컬 서버(http://localhost)로 열어 주세요.</p>` : ""}
        <p class="test-notice">테스트 결제 환경입니다. 실제로 돈이 빠져나가지 않아요.</p>

        <section class="box">
          <div class="box__head">주문 상품 ${t.lines.length}개</div>
          <ul>
            ${t.lines.map((i) => `
              <li class="line-item line-item--no-check">
                <div class="line-item__img"><img src="${productImage(i.product)}" alt=""></div>
                <div>
                  <p class="line-item__brand">${i.product.brand}</p>
                  <p class="line-item__name">${i.product.name}</p>
                  <p class="line-item__opt">사이즈 ${i.size} / 수량 ${i.qty}개</p>
                </div>
                <p class="line-item__price">${won(salePrice(i.product) * i.qty)}</p>
              </li>`).join("")}
          </ul>
        </section>

        <section class="box">
          <div class="box__head">주문자 정보</div>
          <form class="box__body" id="ordererForm" novalidate>
            <div class="form-row"><label for="name">이름</label><input id="name" autocomplete="name" placeholder="홍길동"></div>
            <div class="form-row"><label for="phone">휴대폰 번호</label><input id="phone" inputmode="numeric" autocomplete="tel" placeholder="01012345678"></div>
            <div class="form-row"><label for="email">이메일</label><input id="email" type="email" autocomplete="email" placeholder="example@email.com"></div>
          </form>
        </section>

        <section class="box">
          <div class="box__head">결제 수단</div>
          <!-- 결제위젯 렌더링 영역 -->
          <div id="payment-method"></div>
          <div id="agreement"></div>
        </section>
      </div>

      <aside class="box summary">
        <div class="box__head">결제 금액</div>
        <div class="box__body">
          <dl>
            <dt>상품 금액</dt><dd>${won(t.original)}</dd>
            <dt>할인 금액</dt><dd style="color:#ff0000">-${won(t.discount)}</dd>
            <dt>배송비</dt><dd>${t.shipping ? won(t.shipping) : "무료"}</dd>
          </dl>
          <div class="grand"><span>최종 결제 금액</span><strong>${won(t.total)}</strong></div>
          <button type="button" class="btn btn--black btn--block" id="payBtn" disabled>결제 준비 중...</button>
        </div>
      </aside>
    </div>`;

  const payBtn = $("#payBtn");

  /* ---------- 1. 결제위젯 초기화 ---------- */
  if (typeof TossPayments === "undefined") {
    $("#payment-method").innerHTML = `<p class="box__body" style="color:#ff0000">토스페이먼츠 SDK를 불러오지 못했어요. 네트워크 상태를 확인해 주세요.</p>`;
    payBtn.textContent = "결제 불가";
    return;
  }

  const tossPayments = TossPayments(TOSS_CLIENT_KEY);
  // 비회원 결제. 회원 결제라면 유저별 고유 값(UUID 등)을 customerKey 로 넘기세요.
  const widgets = tossPayments.widgets({ customerKey: TossPayments.ANONYMOUS });

  try {
    /* ---------- 2. 결제 금액 설정 (렌더링 전에 반드시 호출) ---------- */
    await widgets.setAmount({ currency: "KRW", value: t.total });

    /* ---------- 3. 결제 UI · 약관 UI 렌더링 ---------- */
    await Promise.all([
      widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
      widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
    ]);

    payBtn.disabled = false;
    payBtn.textContent = `${won(t.total)} 결제하기`;
  } catch (err) {
    console.error(err);
    $("#payment-method").innerHTML = `<p class="box__body" style="color:#ff0000">결제위젯을 불러오지 못했어요. (${err.message || err})</p>`;
    payBtn.textContent = "결제 불가";
    return;
  }

  /* ---------- 4. 결제 요청 ---------- */
  payBtn.addEventListener("click", async () => {
    const name = $("#name"), phone = $("#phone"), email = $("#email");
    phone.value = phone.value.replace(/\D/g, "");

    const invalid = [
      [name, name.value.trim().length > 0],
      [phone, /^01\d{8,9}$/.test(phone.value)],
      [email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)],
    ].filter(([el, ok]) => { el.classList.toggle("is-error", !ok); return !ok; });

    if (invalid.length) {
      invalid[0][0].focus();
      toast("주문자 정보를 확인해 주세요");
      return;
    }

    // 주문번호: 영문 대소문자, 숫자, -, _, = 로 6~64자
    const orderId = "MOOSIN-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

    // 결제 성공 페이지에서 금액 검증용으로 주문 정보를 저장해 둡니다.
    // (실서비스에서는 이 값을 서버 DB에 저장하고 서버에서 검증해야 합니다.)
    store.set(PENDING_ORDER_KEY, { orderId, orderName, amount: t.total, items: data.items, from: data.from });

    try {
      await widgets.requestPayment({
        orderId,
        orderName,
        successUrl: new URL("success.html", location.href).href,
        failUrl: new URL("fail.html", location.href).href,
        customerName: name.value.trim(),
        customerEmail: email.value.trim(),
        customerMobilePhone: phone.value,
      });
    } catch (err) {
      // 사용자가 결제창을 닫은 경우 등
      console.warn(err);
      toast(err.message || "결제가 취소되었어요");
    }
  });
})();
