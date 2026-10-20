/* ==========================================================
   카테고리 페이지 (상의 / 바지 / 신발)
   body[data-category] 값으로 어떤 카테고리인지 구분합니다.
   ========================================================== */
(function () {
  const key = document.body.dataset.category;
  const cat = CATEGORIES[key];
  const all = PRODUCTS.filter((p) => p.cat === key);
  const brands = [...new Set(all.map((p) => p.brand))];

  let brand = "전체";
  let sort = "rank";

  $("#pageTitle").textContent = cat.name;
  $("#pageDesc").textContent = cat.desc;
  document.title = `${cat.name} | MOOSIN STORE`;

  $("#chips").innerHTML = ["전체", ...brands]
    .map((b) => `<button type="button" class="chip ${b === brand ? "is-active" : ""}" data-brand="${b}">${b}</button>`)
    .join("");

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

  const SORTERS = {
    rank: (a, b) => b.review - a.review,
    sale: (a, b) => b.sale - a.sale,
    low: (a, b) => salePrice(a) - salePrice(b),
    high: (a, b) => salePrice(b) - salePrice(a),
    rating: (a, b) => b.rating - a.rating,
  };

  function render() {
    const list = all.filter((p) => brand === "전체" || p.brand === brand).sort(SORTERS[sort]);
    $("#count").textContent = `상품 ${list.length}개`;
    $("#grid").innerHTML = list.map((p, i) => productCard(p, sort === "rank" ? i + 1 : 0)).join("");
  }

  render();
})();
