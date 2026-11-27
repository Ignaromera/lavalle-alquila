/**
 * Configuración del proyecto gratuito de Supabase.
 * Si dejás la URL o la clave vacías, la app corre en modo ejemplo
 * con avisos ficticios y no intenta conectarse.
 *
 * No pongas acá la service_role. Esa clave no va en el navegador.
 */
export const config = {
  supabaseUrl: "https://tfiggzureidsozbzkyif.supabase.co",
  supabaseAnonKey: "sb_publishable_yGdRVqCho7BzD40sdpkxqw_x-lcoJ6R",
  /**
   * Los mismos emails que cargues en la tabla admin_emails.
   * Sirve para mostrar el enlace de moderación.
   * Quien autoriza de verdad es la base, no esta lista.
   */
  adminEmails: ["jirfcarp@gmail.com"],
  /**
   * Poné true cuando Mercado Pago ya esté conectado (MP_ACCESS_TOKEN cargado y las
   * funciones desplegadas). Hasta entonces el plan gratis conserva las estadísticas
   * que ya tenía y el botón «Suscribirme» avisa que los pagos llegan pronto.
   */
  billingLive: false,
};

export function isConfigured() {
  // ?demo en la URL fuerza el modo ejemplo (para mostrar la app con avisos ficticios).
  if (typeof location !== "undefined" && new URLSearchParams(location.search).has("demo")) return false;
  const url = String(config.supabaseUrl || "").trim();
  const key = String(config.supabaseAnonKey || "").trim();
  if (!url || !key) return false;
  if (url.includes("TU_PROYECTO") || key.includes("TU_ANON")) return false;
  return url.startsWith("https://") && key.length > 20;
}
