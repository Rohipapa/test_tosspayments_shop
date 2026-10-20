/* ==========================================================
   카테고리 페이지 (상의 / 바지 / 신발)
   body[data-category] 값으로 어떤 카테고리인지 구분하고, 상품은 DB에서 한 번에 조회합니다.
   ========================================================== */
(function () {
  const key = document.body.dataset.category;
  const cat = CATEGORIES[key];
  let all = [];
  let brand = "전체";
  let sort = "rank";

  $("#pageTitle").textContent = cat.name;
  $("#pageDesc").textContent = cat.desc;
  document.title = `${cat.name} | MOOSIN STORE`;

  const SORTERS = {
    rank: (a, b) => b.review - a.review,
    sale: (a, b) => b.sale - a.sale,
    low: (a, b) => salePrice(a) - salePrice(b),
    high: (a, b) => salePrice(b) - salePrice(a),
    rating: (a, b) => b.rating - a.rating,
  };

  function renderChips() {
    const brands = [...new Set(all.map((p) => p.brand))];
    $("#chips").innerHTML = ["전체", ...brands]
      .map((b) => `<button type="button" class="chip ${b === brand ? "is-active" : ""}" data-brand="${esc(b)}">${esc(b)}</button>`)
      .join("");
  }

  function render() {
    const list = all.filter((p) => brand === "전체" || p.brand === brand).sort(SORTERS[sort]);
    $("#count").textContent = `상품 ${list.length}개`;
    $("#grid").innerHTML = list.length
      ? list.map((p, i) => productCard(p, sort === "rank" ? i + 1 : 0)).join("")
      : `<div class="empty" style="grid-column:1/-1"><strong>등록된 상품이 없어요</strong></div>`;
  }

  $("#chips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-brand]");
    if (!chip) return;
    brand = chip.dataset.brand;
    $$(".chip", $("#chips")).forEach((c) => c.classList.toggle("is-active", c === chip));
    render();
  });

  $("#sort").addEventListener("change", (e) => {
    sort = e.target.value;
    render();
  });

  // #grid가 이미 .grid라서 skeleton 카드만 넣음
  withLoading($("#grid"), skeletonCards(10), async () => {
    [all] = await Promise.all([Products.list({ category: key }), App.ready]);
    renderChips();
    render();
  });
})();
