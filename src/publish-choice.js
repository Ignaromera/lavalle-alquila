/** Hoja inferior para elegir si se publica un aviso o un «busco alquiler». */

export function publishChoiceHtml() {
  return `
    <div class="sheet-back" data-publish-back hidden></div>
    <div class="sheet" id="publish-choice" data-publish-sheet data-testid="publish-choice" role="dialog" aria-modal="true" aria-labelledby="publish-choice-title" hidden>
      <div class="sheet-grab"></div>
      <h2 id="publish-choice-title" tabindex="-1">¿Qué querés publicar?</h2>
      <div class="choice-list">
        <a class="choice" data-testid="choice-listing" href="#/publicar">
          <span class="choice-title">Tengo algo para alquilar</span>
          <small>Casas, departamentos, quinchos y más</small>
        </a>
        <a class="choice" data-testid="choice-seek" href="#/busco/nuevo">
          <span class="choice-title">Busco alquiler</span>
          <small>Contanos qué necesitás y que te escriban</small>
        </a>
      </div>
    </div>`;
}

export function bindPublishChoice(root) {
  const sheet = root.querySelector("[data-publish-sheet]");
  const back = root.querySelector("[data-publish-back]");
  const openBtn = root.querySelector("[data-open-publish]");
  if (!sheet || !back || !openBtn) return;

  const close = () => {
    if (sheet.hidden) return;
    sheet.hidden = true;
    back.hidden = true;
    document.body.classList.remove("sheet-open");
    openBtn.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    sheet.hidden = false;
    back.hidden = false;
    document.body.classList.add("sheet-open");
    openBtn.setAttribute("aria-expanded", "true");
    sheet.querySelector("#publish-choice-title")?.focus();
  };

  openBtn.addEventListener("click", open);
  back.addEventListener("click", close);
  sheet.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  sheet.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => close());
  });
}
