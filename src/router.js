import { render } from "./bus.js";

export function parseRoute() {
  const raw = (location.hash || "#/").replace(/^#/, "") || "/";
  const qIndex = raw.indexOf("?");
  const path = (qIndex >= 0 ? raw.slice(0, qIndex) : raw) || "/";
  const params = new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : "");
  const parts = path.split("/").filter(Boolean);
  const head = parts[0] || "";
  let name = "home";
  if (head === "mapa") name = "map";
  else if (head === "aviso" && parts[1]) name = "detail";
  else if (head === "publicar") name = "publish";
  else if (head === "quinchos") name = "venues";
  else if (head === "busco" && parts[1] === "nuevo") name = "seek-new";
  else if (head === "busco" && parts[1]) name = "seek";
  else if (head === "busco") name = "seeks";
  else if (head === "cuenta") name = "account";
  else if (head === "planes") name = "plans";
  else if (head === "suscripcion") name = "subscription";
  else if (head === "anunciante" && parts[1]) name = "advertiser";
  else if (head === "admin" && parts[1] === "anunciante" && parts[2]) name = "advertiser-admin";
  else if (head === "admin") name = "admin";
  else if (head === "turnero" && parts[1]) name = "turnero";
  return { name, parts, params, path: `/${parts.join("/")}` };
}

export function navigate(to) {
  const hash = to.startsWith("#") ? to : `#${to}`;
  if (location.hash === hash) render({ scroll: true });
  else location.hash = hash;
}
