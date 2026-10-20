/* ==========================================================
   주문/결제 — 토스페이먼츠 결제위젯 v2 연동
   https://docs.tosspayments.com/guides/v2/payment-widget/integration

   결제 금액은 클라이언트가 정하지 않습니다.
   결제 버튼을 누르면 Edge Function create-order가 DB 상품가로 금액을 계산해 pending 주문을 만들고,
   그 금액으로 결제창을 엽니다. 화면의 금액(calcTotals)은 표시용입니다.
   ========================================================== */

/* 문서용 테스트 클라이언트 키 (결제위젯 연동 키).
   내 상점 키로 바꾸려면 개발자센터 > API 키 > "결제위젯 연동 키"의 클라이언트 키(test_gck_...)를 넣고,
   같은 상점의 시크릿 키를 Edge Function Secret TOSS_SECRET_KEY로 설정하세요.
   ⚠ 시크릿 키(test_gsk_...)는 절대 프론트엔드에 넣지 마세요. */
const TOSS_CLIENT_KEY = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

(async function () {
  const root = $("#checkout");
  const data = Checkout.get();
  let t = null;
  let profile = null;
  let addresses = [];

  root.innerHTML = `<p class="loading">주문 정보를 불러오는 중...</p>`;
  try {
    await App.ready;
    if (data?.items?.length) await Products.byIds(data.items.map((i) => i.id));
    t = data ? calcTotals(data.items) : null;
    if (Auth.user) {
      const [p, a] = await Promise.all([
        sb.from("profiles").select("name, phone").maybeSingle(),
        sb.from("addresses").select("*").order("is_default", { ascending: false }).order("created_at", { ascending: false }),
      ]);
      profile = p.data;
      addresses = a.data || [];
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="empty"><strong>주문 정보를 불러오지 못했어요</strong><p>네트워크 상태를 확인하고 다시 시도해 주세요.</p><button type="button" class="btn btn--black" onclick="location.reload()">다시 시도</button></div>`;
    return;
  }

  if (!t || !t.lines.length) {
    root.innerHTML = `<div class="empty"><strong>결제할 상품이 없어요</strong><a class="btn btn--black" href="cart.html">장바구니로 가기</a></div>`;
    return;
  }

  const addrOption = (a) => `<option value="${a.id}">${esc(a.recipient)} · ${esc(a.address1)}${a.is_default ? " (기본)" : ""}</option>`;

  root.innerHTML = `
    <div class="order">
      <div>
        ${location.protocol === "file:" ? `<p class="test-notice">파일(file://)로 열면 결제창 이동이 막힐 수 있어요. 로컬 서버(http://localhost)로 열어 주세요.</p>` : ""}
        <p class="test-notice">테스트 결제 환경입니다. 실제로 돈이 빠져나가지 않아요.${Auth.user ? "" : ` <a href="${Auth.loginUrl()}" style="text-decoration:underline">로그인</a>하면 주문 내역을 마이페이지에서 볼 수 있어요.`}</p>

        <section class="box">
          <div class="box__head">주문 상품 ${t.lines.length}개</div>
          <ul>
            ${t.lines.map((i) => `
              <li class="line-item line-item--no-check">
                <div class="line-item__img"><img src="${productImage(i.product)}" alt=""></div>
                <div>
                  <p class="line-item__brand">${esc(i.product.brand)}</p>
                  <p class="line-item__name">${esc(i.product.name)}</p>
                  <p class="line-item__opt">사이즈 ${esc(i.size)} / 수량 ${i.qty}개</p>
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
          <div class="box__head">배송지</div>
          <form class="box__body" id="shipForm" novalidate>
            ${addresses.length ? `
              <div class="form-row"><label for="addrSelect">배송지 선택</label>
                <select id="addrSelect">${addresses.map(addrOption).join("")}<option value="new">새 배송지 입력</option></select>
              </div>` : ""}
            <div class="form-row"><label for="recipient">받는 사람</label><input id="recipient" autocomplete="shipping name" placeholder="홍길동"></div>
            <div class="form-row"><label for="shipPhone">연락처</label><input id="shipPhone" inputmode="numeric" autocomplete="shipping tel" placeholder="01012345678"></div>
            <div class="form-row"><label for="zipcode">우편번호</label><input id="zipcode" inputmode="numeric" autocomplete="shipping postal-code" placeholder="06000"></div>
            <div class="form-row"><label for="address1">주소</label><input id="address1" autocomplete="shipping address-line1" placeholder="서울시 강남구 테헤란로 1"></div>
            <div class="form-row"><label for="address2">상세 주소</label><input id="address2" autocomplete="shipping address-line2" placeholder="101동 101호"></div>
            ${Auth.user ? `<label class="form-check" id="saveAddrRow"><input type="checkbox" id="saveAddr" ${addresses.length ? "" : "checked"}> 배송지 목록에 저장${addresses.length ? "" : " (기본 배송지)"}</label>` : ""}
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
        <div class="box__body" id="summary"></div>
      </aside>
    </div>`;

  /* ---------- 결제 금액 요약 (서버 금액이 다르면 서버 값으로 다시 그림) ---------- */
  let amount = t.total;
  function renderSummary(s) {
    $("#summary").innerHTML = `
      <dl>
        <dt>상품 금액</dt><dd>${won(s.original)}</dd>
        <dt>할인 금액</dt><dd style="color:#ff0000">-${won(s.discount)}</dd>
        <dt>배송비</dt><dd>${s.shipping ? won(s.shipping) : "무료"}</dd>
      </dl>
      <div class="grand"><span>최종 결제 금액</span><strong>${won(s.total)}</strong></div>
      <button type="button" class="btn btn--black btn--block" id="payBtn" disabled>결제 준비 중...</button>`;
  }
  renderSummary(t);
  const payBtn = () => $("#payBtn");
  const setPayBtn = (text, disabled) => { payBtn().textContent = text; payBtn().disabled = disabled; };

  /* ---------- 회원 정보 자동 입력 (F-205, F-206) ---------- */
  if (Auth.user) {
    $("#name").value = profile?.name || "";
    $("#phone").value = profile?.phone || "";
    $("#email").value = Auth.user.email || "";
  }
  const fillAddress = (a) => {
    $("#recipient").value = a?.recipient || (a ? "" : $("#name").value);
    $("#shipPhone").value = a?.phone || (a ? "" : $("#phone").value);
    $("#zipcode").value = a?.zipcode || "";
    $("#address1").value = a?.address1 || "";
    $("#address2").value = a?.address2 || "";
    const saveRow = $("#saveAddrRow");
    if (saveRow) saveRow.hidden = !!a;
    if (a && $("#saveAddr")) $("#saveAddr").checked = false;
  };
  if (addresses.length) {
    fillAddress(addresses[0]);
    $("#addrSelect").addEventListener("change", (e) => fillAddress(addresses.find((a) => a.id === e.target.value)));
  } else {
    fillAddress(null);
  }

  /* ---------- 1. 결제위젯 초기화 ---------- */
  if (typeof TossPayments === "undefined") {
    $("#payment-method").innerHTML = `<p class="box__body error-text">토스페이먼츠 SDK를 불러오지 못했어요. 네트워크 상태를 확인해 주세요.</p>`;
    setPayBtn("결제 불가", true);
    return;
  }

  const tossPayments = TossPayments(TOSS_CLIENT_KEY);
  // 회원은 user id(UUID)를 customerKey로, 비회원은 ANONYMOUS (F-412)
  const widgets = tossPayments.widgets({ customerKey: Auth.user ? Auth.user.id : TossPayments.ANONYMOUS });

  try {
    /* ---------- 2. 결제 금액 설정 (렌더링 전에 반드시 호출) ---------- */
    await widgets.setAmount({ currency: "KRW", value: amount });

    /* ---------- 3. 결제 UI · 약관 UI 렌더링 ---------- */
    await Promise.all([
      widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
      widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
    ]);
    setPayBtn(`${won(amount)} 결제하기`, false);
  } catch (err) {
    console.error(err);
    $("#payment-method").innerHTML = `<p class="box__body error-text">결제위젯을 불러오지 못했어요. (${esc(err.message || err)})</p>`;
    setPayBtn("결제 불가", true);
    return;
  }

  /* ---------- 입력값 검증 ---------- */
  function validate() {
    $$("#ordererForm input, #shipForm input").forEach((el) => {
      if (el.inputMode === "numeric") el.value = el.value.replace(/\D/g, "");
    });
    const rules = [
      [$("#name"), $("#name").value.trim().length > 0],
      [$("#phone"), /^01\d{8,9}$/.test($("#phone").value)],
      [$("#email"), /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("#email").value)],
      [$("#recipient"), $("#recipient").value.trim().length > 0],
      [$("#shipPhone"), /^01\d{8,9}$/.test($("#shipPhone").value)],
      [$("#address1"), $("#address1").value.trim().length > 0],
    ];
    const invalid = rules.filter(([el, ok]) => { el.classList.toggle("is-error", !ok); return !ok; });
    if (invalid.length) {
      invalid[0][0].focus();
      toast(invalid[0][0].closest("#shipForm") ? "배송지 정보를 확인해 주세요" : "주문자 정보를 확인해 주세요");
      return false;
    }
    return true;
  }

  async function saveAddressIfChecked(shipping) {
    if (!Auth.user || !$("#saveAddr")?.checked) return;
    const { error } = await sb.from("addresses").insert({ ...shipping, user_id: Auth.user.id, is_default: !addresses.length });
    if (error) {
      console.error(error);
      toast("배송지를 저장하지 못했어요");
    }
  }

  /* ---------- 4. 주문 생성 → 결제 요청 ---------- */
  root.addEventListener("click", async (e) => {
    if (e.target.id !== "payBtn" || !validate()) return;

    const orderer = { name: $("#name").value.trim(), phone: $("#phone").value, email: $("#email").value.trim() };
    const shipping = {
      recipient: $("#recipient").value.trim(),
      phone: $("#shipPhone").value,
      zipcode: $("#zipcode").value.trim(),
      address1: $("#address1").value.trim(),
      address2: $("#address2").value.trim(),
    };

    setPayBtn("주문 확인 중...", true);
    let order;
    try {
      order = await callFunction("create-order", {
        source: data.from === "cart" ? "cart" : "direct",
        items: t.lines.map((i) => ({ product_id: i.id, size: i.size, qty: i.qty })),
        orderer,
        shipping,
      });
    } catch (err) {
      console.error(err);
      toast(err.message || "주문을 만들지 못했어요");
      setPayBtn(`${won(amount)} 결제하기`, false);
      return;
    }

    // 서버가 계산한 금액이 화면과 다르면(상품가 변경 등) 서버 금액으로 다시 그리고 다시 확인받음
    if (order.amount !== amount) {
      amount = order.amount;
      await widgets.setAmount({ currency: "KRW", value: amount });
      renderSummary({ original: order.original, discount: order.discount, shipping: order.shipping, total: order.amount });
      setPayBtn(`${won(amount)} 결제하기`, false);
      toast("상품 금액이 바뀌었어요. 결제 금액을 확인하고 다시 눌러 주세요");
      return;
    }

    await saveAddressIfChecked(shipping);

    try {
      await widgets.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: new URL("success.html", location.href).href,
        failUrl: new URL("fail.html", location.href).href,
        customerName: orderer.name,
        customerEmail: orderer.email,
        customerMobilePhone: orderer.phone,
      });
    } catch (err) {
      // 사용자가 결제창을 닫은 경우 등: 만든 주문을 취소 처리
      console.warn(err);
      const code = err.code === "USER_CANCEL" ? "PAY_PROCESS_CANCELED" : err.code || "REQUEST_FAILED";
      sb.rpc("fail_order", { p_order_id: order.orderId, p_code: code }).then(() => {});
      toast(err.message || "결제가 취소되었어요");
      setPayBtn(`${won(amount)} 결제하기`, false);
    }
  });
})();
