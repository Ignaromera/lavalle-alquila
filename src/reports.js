export const REPORT_REASONS = [
  ["estafa", "Estafa o fraude"],
  ["falso_alquilado", "Aviso falso o ya alquilado"],
  ["datos", "Datos o fotos incorrectas"],
  ["inapropiado", "Contenido inapropiado"],
  ["otro", "Otro"],
];

export const REPORT_REASON_LABELS = {
  estafa: "Estafa o fraude",
  alquilado: "Ya está alquilado",
  falso: "Datos o fotos falsas",
  falso_alquilado: "Aviso falso o ya alquilado",
  datos: "Datos o fotos incorrectas",
  inapropiado: "Contenido inapropiado",
  otro: "Otro",
};

export const REPORT_REASON_IDS = new Set([
  "estafa",
  "alquilado",
  "falso",
  "falso_alquilado",
  "datos",
  "inapropiado",
  "otro",
]);

const MAX_DETAILS = 500;
const MAX_DAILY = 8;

export function reportReasonLabel(reason) {
  return REPORT_REASON_LABELS[reason] || reason || "";
}

export function assertReportReason(reason) {
  if (!REPORT_REASON_IDS.has(reason)) throw new Error("Elegí un motivo");
  return reason;
}

export function clipReportDetails(details) {
  return String(details || "").slice(0, MAX_DETAILS);
}

export function canReportAgain(existing, visitorId, now = new Date()) {
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const today = existing.filter((item) => item.visitor_id === visitorId && new Date(item.created_at).getTime() > dayAgo);
  return today.length < MAX_DAILY;
}

export function reportSheetHtml({ kind = "listing" } = {}) {
  const seek = kind === "seek";
  const title = seek ? "Denunciar búsqueda" : "Denunciar aviso";
  const fine = "No hace falta crear una cuenta. El equipo revisa cada denuncia.";
  return `<div class="sheet-back" data-close-report hidden></div>
      <form class="sheet" data-report-form hidden>
        <div class="sheet-grab"></div>
        <h2>${title}</h2>
        <p class="fine">${fine}</p>
        <label class="field">Motivo
          <select name="reason" required>${REPORT_REASONS.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select>
        </label>
        <label class="field">Comentario (opcional)<textarea name="details" maxlength="${MAX_DETAILS}" placeholder="Qué viste"></textarea></label>
        <button class="btn btn-danger" type="submit">Enviar denuncia</button>
      </form>`;
}

export function bindReportSheet(view, onSubmit) {
  const sheet = view.querySelector("[data-report-form]");
  const backSheet = view.querySelector("[data-close-report]");
  const button = view.querySelector("[data-report]");
  if (!sheet || !backSheet || !button) return;
  const close = () => {
    sheet.hidden = true;
    backSheet.hidden = true;
  };
  button.addEventListener("click", () => {
    sheet.hidden = false;
    backSheet.hidden = false;
  });
  backSheet.addEventListener("click", close);
  sheet.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(sheet);
    await onSubmit({
      reason: String(data.get("reason") || ""),
      details: String(data.get("details") || ""),
      close,
    });
  });
}
