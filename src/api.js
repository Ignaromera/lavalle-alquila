import { createClient } from "@supabase/supabase-js";
import { config, isConfigured } from "./config.js";
import * as demo from "./demo-store.js";
import { applyFilters } from "./filter.js";
import { clock, isoDay, normalizeWhatsapp } from "./format.js";
import { claimDailyView } from "./stats.js";
import { pickSubscription } from "./plans.js";
import { compressImage, readDataUrl } from "./photos.js";

const DEMO_KEY = "lavalle-demo-user";
let store;
let demoUserId = null;
let demoReady = false;
let client;

export function isDemo() {
  return !isConfigured();
}

function mem() {
  if (!store) store = demo.createDemoStore();
  return store;
}

function rememberDemoUser() {
  if (demoReady) return;
  demoReady = true;
  try {
    demoUserId = sessionStorage.getItem(DEMO_KEY);
  } catch {
    demoUserId = null;
  }
}

function setDemoUser(id) {
  demoUserId = id;
  demoReady = true;
  try {
    if (id) sessionStorage.setItem(DEMO_KEY, id);
    else sessionStorage.removeItem(DEMO_KEY);
  } catch {
    /* modo privado */
  }
}

function getClient() {
  if (!client) {
    client = createClient(config.supabaseUrl.trim(), config.supabaseAnonKey.trim(), {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

export const MIN_PASSWORD_LENGTH = 8;
const RECOVERY_KEY = "lavalle-password-recovery";

export function authEventShouldRender(event) {
  return event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY";
}

export function authRedirectTo() {
  return `${location.origin}${location.pathname}`;
}

export function validatePasswords(password, repeat) {
  if (String(password || "").length < MIN_PASSWORD_LENGTH) {
    throw new Error("La contraseña tiene que tener al menos 8 caracteres.");
  }
  if (password !== repeat) {
    throw new Error("Las contraseñas no coinciden.");
  }
}

export function isPasswordRecovery() {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPasswordRecovery() {
  try {
    sessionStorage.setItem(RECOVERY_KEY, "1");
  } catch {
    /* modo privado */
  }
}

export function clearPasswordRecovery() {
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    /* modo privado */
  }
}

export class AuthNeedConfirmError extends Error {
  constructor(email) {
    super("Primero tenés que confirmar tu mail. Revisá la bandeja de entrada, Promociones y Spam.");
    this.name = "AuthNeedConfirmError";
    this.code = "email_not_confirmed";
    this.email = email;
  }
}

export function parseAuthLinkParams(href = typeof location !== "undefined" ? location.href : "") {
  const url = new URL(href, "https://lavallealquila.com.ar/");
  const search = url.searchParams;
  const hash = url.hash || "";
  const implicit = /^#(?:access_token|refresh_token|error|error_description|expires_at|expires_in|token_type|type|code)=/i.test(hash);
  const hashBody = hash.startsWith("#") ? hash.slice(1) : hash;
  const hashQuery = implicit ? hashBody : (hashBody.includes("?") ? hashBody.slice(hashBody.indexOf("?") + 1) : "");
  const fromHash = new URLSearchParams(hashQuery);
  const pick = (key) => search.get(key) || fromHash.get(key) || "";
  return {
    tokenHash: pick("token_hash"),
    type: pick("type"),
    code: search.get("code") || fromHash.get("code") || "",
    error: pick("error_description") || pick("error"),
    implicit,
  };
}

function cleanAuthParamsFromUrl() {
  if (typeof history === "undefined" || typeof location === "undefined") return;
  const url = new URL(location.href);
  for (const key of ["token_hash", "type", "code", "error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
  }
  if (/^#(?:access_token|refresh_token|error|error_description|expires_at|expires_in|token_type|type|code)=/i.test(url.hash)) {
    url.hash = "#/cuenta";
  } else if (url.hash.includes("token_hash=")) {
    url.hash = "#/cuenta";
  } else if (!url.hash || url.hash === "#") {
    url.hash = "#/cuenta";
  }
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export async function consumeAuthRedirect() {
  if (isDemo()) return { kind: "none" };
  const params = parseAuthLinkParams();
  const client = getClient();
  const { data: current, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw asError(sessionError);

  if (params.tokenHash && params.type) {
    const { data, error } = await client.auth.verifyOtp({
      token_hash: params.tokenHash,
      type: params.type,
    });
    cleanAuthParamsFromUrl();
    if (error) {
      return { kind: "error", message: "El enlace no sirve o está vencido. Pedí uno nuevo." };
    }
    if (params.type === "recovery") markPasswordRecovery();
    return { kind: params.type === "recovery" ? "recovery" : "confirmed", session: data.session };
  }

  if (params.error) {
    cleanAuthParamsFromUrl();
    return {
      kind: "error",
      message: "No se pudo abrir el enlace. Si ya confirmaste el mail, entrá con tu contraseña.",
    };
  }

  if (current?.session && (params.code || params.implicit || params.type)) {
    if (params.type === "recovery") markPasswordRecovery();
    cleanAuthParamsFromUrl();
    return { kind: params.type === "recovery" || isPasswordRecovery() ? "recovery" : "confirmed", session: current.session };
  }

  if (params.code && !current?.session) {
    cleanAuthParamsFromUrl();
    return {
      kind: "error",
      message: "Si confirmaste el mail, ya podés entrar con tu contraseña. Si el enlace falló, pedí uno nuevo.",
    };
  }

  return { kind: "none" };
}

export function watchAuth(onChange) {
  if (isDemo()) return;
  getClient().auth.onAuthStateChange((event) => {
    if (authEventShouldRender(event)) onChange(event);
  });
}

function isPermissionError(error) {
  const msg = String(error?.message || error || "");
  const code = String(error?.code || "");
  return code === "42501" || /row-level security|permission denied|42501/i.test(msg);
}

function asError(error) {
  const msg = String(error?.message || error || "No se pudo completar");
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return new Error("Sin conexión con Supabase. Revisá la URL y tu internet.");
  }
  if (/booking_requests_one_confirmed|ya tiene una reserva confirmada/i.test(msg)) {
    return new Error("Ese turno ya tiene una reserva confirmada");
  }
  if (/booking_requests_one_pending|en consulta/i.test(msg)) {
    return new Error("Ese turno ya está tomado o en consulta");
  }
  if (/Tu plan permite/i.test(msg)) {
    return new Error(`${msg} Con Plus o Pro publicás más: mirá los planes.`);
  }
  return new Error(msg);
}

function normalizeOffer(offer) {
  return {
    id: offer.id,
    name: offer.name,
    starts_at: clock(offer.starts_at),
    ends_at: clock(offer.ends_at),
    price_ars: Number(offer.price_ars),
  };
}

function normalize(row) {
  const rawOffers = Array.isArray(row.offers) ? row.offers : [];
  return {
    ...row,
    amenities: row.amenities || [],
    photo_urls: row.photo_urls || [],
    offers: rawOffers.map(normalizeOffer),
    address: row.address || "",
    pets_allowed: !!row.pets_allowed,
    guarantee_required: row.guarantee_required !== false,
    featured: !!row.featured,
    booking_enabled: !!row.booking_enabled,
    example: false,
    owner_name: row.owner_name || "",
    whatsapp: row.whatsapp || "",
  };
}

async function attachOffers(rows) {
  if (!rows.length || rows.every((row) => row.offers?.length || row.type === "casa" || row.type === "departamento" || row.type === "local" || row.type === "terreno")) {
    return rows;
  }
  const ids = rows.filter((row) => row.type === "quincho" || row.type === "salon").map((row) => row.id);
  if (!ids.length) return rows;
  const { data, error } = await getClient().from("listing_offers").select("*").in("listing_id", ids).order("sort_order");
  if (error) throw asError(error);
  const grouped = new Map();
  for (const offer of data || []) {
    const list = grouped.get(offer.listing_id) || [];
    list.push(normalizeOffer(offer));
    grouped.set(offer.listing_id, list);
  }
  return rows.map((row) => ({ ...row, offers: grouped.get(row.id) || row.offers || [] }));
}

function mapProfile(row, user, isAdmin) {
  return {
    id: user.id,
    email: user.email || "",
    full_name: row?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
    whatsapp: row?.whatsapp || "",
    plan: row?.plan || "free",
    max_listings: row?.max_listings ?? 1,
    booking_enabled: !!row?.booking_enabled,
    is_admin: !!isAdmin,
  };
}

export async function getSession() {
  if (isDemo()) {
    rememberDemoUser();
    if (!demoUserId) return null;
    const person = mem().profiles.find((item) => item.id === demoUserId);
    if (!person) return null;
    return {
      user: { id: person.id, email: person.email },
      profile: {
        id: person.id,
        email: person.email,
        full_name: person.full_name,
        whatsapp: person.whatsapp,
        plan: person.plan,
        max_listings: person.max_listings,
        booking_enabled: person.booking_enabled,
        is_admin: person.is_admin,
      },
    };
  }
  const { data, error } = await getClient().auth.getSession();
  if (error) throw asError(error);
  const user = data.session?.user;
  if (!user) return null;
  let { data: profile, error: profileError } = await getClient().from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (profileError) throw asError(profileError);
  if (!profile) {
    const inserted = await getClient().from("profiles").insert({ id: user.id }).select("*").maybeSingle();
    if (inserted.error) throw asError(inserted.error);
    profile = inserted.data;
  }
  const admin = await getClient().rpc("is_admin");
  return { user: { id: user.id, email: user.email }, profile: mapProfile(profile, user, admin.data) };
}

export async function signInWithGoogle() {
  if (isDemo()) {
    throw new Error("En el modo ejemplo no se abre Google. Conectá Supabase para usarlo.");
  }
  const { error } = await getClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${location.origin}${location.pathname}`,
    },
  });
  if (error) throw asError(error);
}

export async function signUpWithPassword(email, password, repeat) {
  validatePasswords(password, repeat);
  const trimmed = email.trim();
  if (isDemo()) {
    throw new Error("En el modo ejemplo no se crean cuentas. Usá una cuenta de ejemplo o configurá Supabase.");
  }
  const { data, error } = await getClient().auth.signUp({
    email: trimmed,
    password,
    options: { emailRedirectTo: `${authRedirectTo()}#/cuenta` },
  });
  if (error) {
    if (/already registered|already been registered|user already/i.test(error.message)) {
      throw new Error("Este mail ya tiene una cuenta. Entrá o creá tu contraseña con «Olvidé mi contraseña».");
    }
    throw asError(error);
  }
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error("Este mail ya tiene una cuenta. Entrá o creá tu contraseña con «Olvidé mi contraseña».");
  }
  if (data.session) return { status: "session", email: trimmed };
  return { status: "confirm", email: trimmed };
}

export async function signInWithPassword(email, password) {
  const trimmed = email.trim();
  if (isDemo()) {
    throw new Error("En el modo ejemplo no se entra con contraseña. Usá una cuenta de ejemplo.");
  }
  const { error } = await getClient().auth.signInWithPassword({ email: trimmed, password });
  if (!error) return;
  const code = String(error.code || "");
  const msg = String(error.message || "");
  if (code === "email_not_confirmed" || /email not confirmed|not confirmed/i.test(msg)) {
    throw new AuthNeedConfirmError(trimmed);
  }
  if (code === "invalid_credentials" || /invalid login|invalid credentials/i.test(msg)) {
    throw new Error("El mail o la contraseña no son correctos.");
  }
  throw asError(error);
}

export async function resendSignupEmail(email) {
  const trimmed = email.trim();
  if (isDemo()) {
    throw new Error("En el modo ejemplo no se envían correos.");
  }
  const { error } = await getClient().auth.resend({
    type: "signup",
    email: trimmed,
    options: { emailRedirectTo: `${authRedirectTo()}#/cuenta` },
  });
  if (error) throw asError(error);
}

export async function requestPasswordReset(email) {
  const trimmed = email.trim();
  if (isDemo()) {
    throw new Error("En el modo ejemplo no se envían correos. Usá una cuenta de ejemplo.");
  }
  const { error } = await getClient().auth.resetPasswordForEmail(trimmed, {
    redirectTo: `${authRedirectTo()}#/cuenta`,
  });
  if (error) throw asError(error);
}

export async function updatePassword(password, repeat) {
  validatePasswords(password, repeat);
  if (isDemo()) {
    clearPasswordRecovery();
    return;
  }
  const { error } = await getClient().auth.updateUser({ password });
  if (error) throw asError(error);
  clearPasswordRecovery();
}

export async function signOut() {
  if (isDemo()) {
    setDemoUser(null);
    return;
  }
  const { error } = await getClient().auth.signOut();
  if (error) throw asError(error);
}

export async function signInDemo(profileId) {
  if (!isDemo()) throw new Error("El modo ejemplo no está activo");
  const person = mem().profiles.find((item) => item.id === profileId);
  if (!person) throw new Error("No encontramos esa cuenta de ejemplo");
  setDemoUser(profileId);
  return getSession();
}

export async function ensureDemoProfile({ full_name, whatsapp }) {
  if (!isDemo()) throw new Error("Esta acción es solo del modo ejemplo");
  rememberDemoUser();
  if (demoUserId && mem().profiles.some((item) => item.id === demoUserId)) {
    demo.updateProfile(mem(), demoUserId, { full_name, whatsapp });
    return getSession();
  }
  const person = demo.addProfile(mem(), { full_name, whatsapp });
  setDemoUser(person.id);
  return getSession();
}

export async function saveProfile({ full_name, whatsapp }) {
  const session = await getSession();
  if (!session) throw new Error("Entrá con tu email para guardar el perfil");
  const phone = normalizeWhatsapp(whatsapp);
  if (isDemo()) {
    demo.updateProfile(mem(), session.user.id, { full_name, whatsapp: phone });
    return getSession();
  }
  const payload = { full_name: full_name.trim(), whatsapp: phone };
  let { data, error } = await getClient().from("profiles").update(payload).eq("id", session.user.id).select("*").maybeSingle();
  if (error) throw asError(error);
  if (!data) {
    const inserted = await getClient().from("profiles").insert({ id: session.user.id, ...payload }).select("*").single();
    if (inserted.error) throw asError(inserted.error);
    data = inserted.data;
  }
  return getSession();
}

export function photoUrl(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const base = import.meta.env?.BASE_URL || "./";
  if (path.startsWith("demo/") || isDemo()) return `${base}${path.replace(/^\.\//, "")}`;
  const { data } = getClient().storage.from("listing-photos").getPublicUrl(path);
  return data.publicUrl;
}

async function storedPhotos(ownerId, listingId, files) {
  if (isDemo()) {
    const urls = [];
    for (const file of files) {
      const small = await compressImage(file);
      urls.push(await readDataUrl(small));
    }
    return urls;
  }
  const paths = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = await compressImage(files[i]);
    const path = `${ownerId}/${listingId}/${Date.now()}-${i}.jpg`;
    const { error } = await getClient().storage.from("listing-photos").upload(path, file, { contentType: "image/jpeg" });
    if (error) throw new Error(error.message || "No se pudo subir la foto");
    paths.push(path);
  }
  return paths;
}

export async function listListings(filters) {
  if (isDemo()) return demo.publicListings(mem(), filters);
  const { data, error } = await getClient().from("listings_public").select("*");
  if (error) throw asError(error);
  return applyFilters((data || []).map((row) => normalize(row)), filters);
}

export async function getListing(id) {
  if (isDemo()) return demo.getListing(mem(), id);
  const { data, error } = await getClient().from("listings_public").select("*").eq("id", id).maybeSingle();
  if (error) throw asError(error);
  if (data) return normalize(data);
  const own = await getClient().from("listings").select("*").eq("id", id).maybeSingle();
  if (own.error) throw asError(own.error);
  if (!own.data || own.data.status === "deleted") return null;
  const session = await getSession();
  const normalized = normalize({
    ...own.data,
    owner_name: session?.profile.full_name || "",
    whatsapp: session?.profile.whatsapp || "",
  });
  return (await attachOffers([normalized]))[0];
}

export async function myListings() {
  const session = await getSession();
  if (!session) return [];
  if (isDemo()) return demo.myListings(mem(), session.user.id);
  const { data, error } = await getClient()
    .from("listings")
    .select("*")
    .eq("owner_id", session.user.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  if (error) throw asError(error);
  const rows = (data || []).map((row) => normalize({
    ...row,
    owner_name: session.profile.full_name,
    whatsapp: session.profile.whatsapp,
  }));
  return attachOffers(rows);
}

async function saveOffers(listingId, offers) {
  const current = await getClient().from("listing_offers").select("id").eq("listing_id", listingId);
  if (current.error) throw asError(current.error);
  const keep = new Set((offers || []).filter((offer) => offer.id).map((offer) => offer.id));
  const remove = (current.data || []).filter((row) => !keep.has(row.id)).map((row) => row.id);
  if (remove.length) {
    const deleted = await getClient().from("listing_offers").delete().in("id", remove);
    if (deleted.error) throw new Error("No saques un horario que ya tiene reservas en el calendario");
  }
  for (const [index, offer] of (offers || []).entries()) {
    const row = {
      listing_id: listingId,
      name: offer.name,
      starts_at: offer.starts_at,
      ends_at: offer.ends_at,
      price_ars: offer.price_ars,
      sort_order: index,
    };
    const exists = offer.id && (current.data || []).some((item) => item.id === offer.id);
    const result = exists
      ? await getClient().from("listing_offers").update(row).eq("id", offer.id)
      : await getClient().from("listing_offers").insert({ ...row, id: offer.id || crypto.randomUUID() });
    if (result.error) throw asError(result.error);
  }
}

export async function createListing(fields, files) {
  const session = await getSession();
  if (!session) throw new Error("Entrá con tu email para publicar");
  if (isDemo()) {
    const photo_urls = await storedPhotos(session.user.id, "nuevo", files);
    return demo.addListing(mem(), session.user.id, { ...fields, photo_urls });
  }
  const id = crypto.randomUUID();
  const photo_urls = await storedPhotos(session.user.id, id, files);
  const { offers, ...rest } = fields;
  const { error } = await getClient().from("listings").insert({
    id,
    owner_id: session.user.id,
    ...rest,
    photo_urls,
    status: "active",
    featured: false,
    booking_enabled: false,
  });
  if (error) throw asError(error);
  if (offers?.length) await saveOffers(id, offers);
  return getListing(id);
}

export async function updateListing(id, fields, files, keptPhotos) {
  const session = await getSession();
  if (!session) throw new Error("Entrá con tu email para publicar");
  const extra = await storedPhotos(session.user.id, id, files);
  const photo_urls = [...keptPhotos, ...extra].slice(0, 6);
  if (isDemo()) return demo.updateListing(mem(), session.user.id, id, { ...fields, photo_urls });
  const { offers, ...rest } = fields;
  const { error } = await getClient().from("listings").update({ ...rest, photo_urls }).eq("id", id);
  if (error) throw asError(error);
  if (offers) await saveOffers(id, offers);
  return getListing(id);
}

export async function renewListing(id) {
  const session = await getSession();
  if (!session) throw new Error("Entrá con tu cuenta");
  if (isDemo()) return demo.renewListing(mem(), session.user.id, id);
  const { error } = await getClient().rpc("renew_listing", { p_id: id });
  if (error) throw asError(error);
}

export async function setListingStatus(id, status) {
  const session = await getSession();
  if (!session) throw new Error("Entrá con tu cuenta");
  if (isDemo()) return demo.setListingStatus(mem(), session.user.id, id, status);
  const patch = { status };
  if (status === "active") patch.expires_at = new Date(Date.now() + 60 * 86400000).toISOString();
  const { error } = await getClient().from("listings").update(patch).eq("id", id);
  if (error) throw asError(error);
}

export function visitorId() {
  const key = "lavalle-visitor";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "visitante-sin-storage";
  }
}

export async function reportListing(id, { reason, details }) {
  const visitor = visitorId();
  if (isDemo()) return demo.addReport(mem(), id, visitor, reason, details);
  // return=minimal: PostgREST no devuelve la fila. Solo un admin puede leer reports;
  // un insert con RETURNING fallaría para el resto.
  const query = getClient().from("reports").insert({
    listing_id: id,
    visitor_id: visitor,
    reason,
    details: details || "",
  });
  query.headers.set("Prefer", "return=minimal");
  const { error } = await query;
  if (error) {
    if (/duplicate|unique/i.test(error.message) || error.code === "23505") {
      throw new Error("Ya denunciaste este aviso. Gracias.");
    }
    if (isPermissionError(error)) {
      throw new Error("No se pudo denunciar este aviso. Si es tuyo, no hace falta denunciarlo.");
    }
    throw asError(error);
  }
}

export async function trackStat(subjectType, subjectId, kind) {
  try {
    if (isDemo()) {
      demo.trackStat(mem(), subjectType, subjectId, kind);
      return;
    }
    await getClient().rpc("track_stat", {
      p_subject_type: subjectType,
      p_subject_id: subjectId,
      p_kind: kind,
    });
  } catch {
    /* la estadística no debe frenar la página */
  }
}

export async function maybeTrackView(subjectType, subjectId) {
  let storage;
  try {
    storage = localStorage;
  } catch {
    return;
  }
  if (!claimDailyView(storage, subjectType, subjectId, isoDay(new Date()))) return;
  await trackStat(subjectType, subjectId, "view");
}

export async function myStats() {
  const session = await getSession();
  if (!session) return [];
  if (isDemo()) return demo.statsForOwner(mem(), session.user.id);
  const { data, error } = await getClient().from("stat_daily").select("subject_type, subject_id, kind, day, count");
  if (error) throw asError(error);
  return data || [];
}

export async function getSeek(id) {
  if (isDemo()) return demo.getSeek(mem(), id);
  const { data, error } = await getClient().from("seeks_public").select("*").eq("id", id).maybeSingle();
  if (error) throw asError(error);
  return data ? { ...data, example: false } : null;
}

export async function listSeeks() {
  if (isDemo()) return demo.publicSeeks(mem());
  const { data, error } = await getClient().from("seeks_public").select("*");
  if (error) throw asError(error);
  return (data || []).map((row) => ({ ...row, example: false }));
}

export async function mySeeks() {
  const session = await getSession();
  if (!session) return [];
  if (isDemo()) return demo.mySeeks(mem(), session.user.id);
  const { data, error } = await getClient()
    .from("seeks")
    .select("*")
    .eq("owner_id", session.user.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  if (error) throw asError(error);
  return data || [];
}

export async function createSeek(fields) {
  const session = await getSession();
  if (!session) throw new Error("Entrá con tu email para publicar");
  if (isDemo()) return demo.addSeek(mem(), session.user.id, fields);
  const { error } = await getClient().from("seeks").insert({
    owner_id: session.user.id,
    type: fields.type,
    district: fields.district || null,
    budget_ars: fields.budget_ars,
    note: fields.note,
    status: "active",
  });
  if (error) throw asError(error);
}

export async function renewSeek(id) {
  const session = await getSession();
  if (!session) throw new Error("Entrá con tu cuenta");
  if (isDemo()) return demo.renewSeek(mem(), session.user.id, id);
  const { error } = await getClient().rpc("renew_seek", { p_id: id });
  if (error) throw asError(error);
}

export async function deleteSeek(id) {
  const session = await getSession();
  if (!session) throw new Error("Entrá con tu cuenta");
  if (isDemo()) return demo.deleteSeek(mem(), session.user.id, id);
  const { error } = await getClient().from("seeks").update({ status: "deleted" }).eq("id", id);
  if (error) throw asError(error);
}

export async function listSlots(listingId) {
  if (isDemo()) return demo.listSlots(mem(), listingId);
  const { data, error } = await getClient()
    .from("booking_slots")
    .select("id, listing_id, slot_date, offer_id, status, listing_offers(name, starts_at, ends_at, price_ars)")
    .eq("listing_id", listingId)
    .order("slot_date");
  if (error) throw asError(error);
  return (data || []).map((row) => ({
    ...row,
    offer_name: row.listing_offers?.name || "",
    starts_at: clock(row.listing_offers?.starts_at),
    ends_at: clock(row.listing_offers?.ends_at),
    price_ars: row.listing_offers?.price_ars ?? null,
  }));
}

export async function toggleSlot(listingId, slotDate, offerId, open) {
  const session = await getSession();
  if (!session) throw new Error("Entrá con tu cuenta");
  if (isDemo()) return demo.toggleSlot(mem(), session.user.id, listingId, slotDate, offerId, open);
  if (open) {
    const { error } = await getClient().from("booking_slots").insert({
      listing_id: listingId,
      slot_date: slotDate,
      offer_id: offerId,
      status: "open",
    });
    if (error) throw asError(error);
    return;
  }
  const { error } = await getClient()
    .from("booking_slots")
    .delete()
    .eq("listing_id", listingId)
    .eq("slot_date", slotDate)
    .eq("offer_id", offerId)
    .eq("status", "open");
  if (error) throw asError(error);
}

export async function requestBooking(input) {
  if (isDemo()) return demo.requestBooking(mem(), input);
  const { error } = await getClient().rpc("create_booking_request", {
    p_slot: input.slotId,
    p_name: input.name,
    p_whatsapp: normalizeWhatsapp(input.whatsapp),
    p_guests: Number(input.guests),
    p_note: input.note || "",
  });
  if (error) throw asError(error);
}

export async function myBookingRequests() {
  const session = await getSession();
  if (!session) return [];
  if (isDemo()) return demo.myBookingRequests(mem(), session.user.id);
  const { data, error } = await getClient()
    .from("booking_requests")
    .select("id, slot_id, listing_id, requester_name, requester_whatsapp, guests, note, status, created_at, booking_slots(slot_date, listing_offers(name, starts_at, ends_at)), listings(title)")
    .order("created_at", { ascending: false });
  if (error) throw asError(error);
  return (data || []).map((row) => {
    const offer = row.booking_slots?.listing_offers;
    const hours = offer ? `${offer.name} · ${clock(offer.starts_at)}–${clock(offer.ends_at)}` : "";
    return {
      ...row,
      slot_date: row.booking_slots?.slot_date || "",
      shift: hours,
      listing_title: row.listings?.title || "",
    };
  });
}

export async function setBookingStatus(requestId, status) {
  const session = await getSession();
  if (!session) throw new Error("Entrá con tu cuenta");
  if (isDemo()) return demo.setBookingStatus(mem(), session.user.id, requestId, status);
  const { error } = await getClient().rpc("set_booking_status", { p_request: requestId, p_status: status });
  if (error) throw asError(error);
}

export async function adminListings() {
  if (isDemo()) return demo.adminListings(mem());
  const session = await getSession();
  if (!session?.profile.is_admin) throw new Error("Esta sección es solo para el equipo de Lavalle Alquila.");
  const [listings, reports] = await Promise.all([
    getClient().from("listings").select("*").neq("status", "deleted").order("created_at", { ascending: false }),
    getClient().from("reports").select("listing_id, reason, details, created_at"),
  ]);
  if (listings.error) throw asError(listings.error);
  if (reports.error) throw asError(reports.error);
  const grouped = new Map();
  for (const report of reports.data || []) {
    const list = grouped.get(report.listing_id) || [];
    list.push(report);
    grouped.set(report.listing_id, list);
  }
  return (listings.data || [])
    .map((row) => {
      const list = grouped.get(row.id) || [];
      return { ...normalize(row), report_count: list.length, reports: list };
    })
    .sort((a, b) => Number(b.status === "hidden") - Number(a.status === "hidden") || b.report_count - a.report_count);
}

export async function adminRestore(id) {
  if (isDemo()) return demo.adminRestore(mem(), id);
  const session = await getSession();
  if (!session?.profile.is_admin) throw new Error("No autorizado");
  const { error } = await getClient().from("listings").update({
    status: "active",
    hidden_reason: null,
    expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
  }).eq("id", id);
  if (error) throw asError(error);
}

export async function adminRemove(id) {
  if (isDemo()) return demo.adminRemove(mem(), id);
  const session = await getSession();
  if (!session?.profile.is_admin) throw new Error("No autorizado");
  const { error } = await getClient().from("listings").update({ status: "deleted" }).eq("id", id);
  if (error) throw asError(error);
}

export async function adminSetFlags(id, flags) {
  if (isDemo()) return demo.adminSetFlags(mem(), id, flags);
  const session = await getSession();
  if (!session?.profile.is_admin) throw new Error("No autorizado");
  const { error } = await getClient().from("listings").update(flags).eq("id", id);
  if (error) throw asError(error);
}

// ---------------------------------------------------------------------------
// Planes y suscripciones
// ---------------------------------------------------------------------------

const COMING_SOON = "Los pagos se habilitan muy pronto. Todavía no se cobra nada.";

function comingSoon(message = COMING_SOON) {
  const error = new Error(message);
  error.code = "proximamente";
  return error;
}

/** Lee el cuerpo de error de una Edge Function (supabase-js lo deja en error.context). */
async function functionError(error) {
  let body = null;
  try {
    body = await error?.context?.json?.();
  } catch {
    body = null;
  }
  return body;
}

async function callFunction(name, body) {
  const { data, error } = await getClient().functions.invoke(name, { body });
  if (!error) return data;
  const detail = await functionError(error);
  const status = error?.context?.status;
  // Función todavía sin desplegar, sin token de Mercado Pago o sin red: «próximamente», sin romper.
  if (detail?.code === "proximamente" || status === 404 || status === 503 || !status) throw comingSoon(detail?.message);
  const failure = new Error(detail?.message || "No pudimos completar la operación. Probá de nuevo en un rato.");
  failure.code = detail?.code || "error";
  throw failure;
}

/** Suscripción vigente de la persona (o null). Si la tabla todavía no existe, devuelve null. */
export async function mySubscription() {
  const session = await getSession();
  if (!session) return null;
  if (isDemo()) return demo.subscriptionFor(mem(), session.user.id);
  const { data, error } = await getClient()
    .from("subscriptions")
    .select("id, plan_id, billing_interval, amount_ars, status, next_payment_at, last_paid_at, access_until, payment_failed_at, cancelled_at, created_at")
    .order("created_at", { ascending: false });
  if (error) return null;
  return pickSubscription(data || []);
}

/** Pide el link de pago de Mercado Pago. Devuelve { init_point }. */
export async function startCheckout(plan, interval) {
  const session = await getSession();
  if (!session) throw new Error("Entrá a tu cuenta para suscribirte.");
  if (isDemo()) throw comingSoon("En el modo ejemplo no se cobra nada. Así se vería el paso a Mercado Pago.");
  const data = await callFunction("crear-suscripcion", { action: "create", plan, interval });
  if (!data?.init_point) throw comingSoon();
  return data;
}

export async function cancelMySubscription() {
  const session = await getSession();
  if (!session) throw new Error("Entrá a tu cuenta.");
  if (isDemo()) {
    demo.cancelSubscription(mem(), session.user.id);
    return { ok: true };
  }
  return callFunction("crear-suscripcion", { action: "cancel" });
}

/** Le pregunta a Mercado Pago cómo está el pago, por si algún aviso no llegó. Nunca falla. */
export async function syncSubscription() {
  if (isDemo()) return;
  try {
    await getClient().functions.invoke("mp-webhook", { body: { action: "sync" } });
  } catch {
    /* sin función o sin red: no pasa nada */
  }
}

/** Destacar o sacar el destacado de un aviso propio (plan Pro). */
export async function setFeatured(id, on) {
  const session = await getSession();
  if (!session) throw new Error("Entrá a tu cuenta.");
  if (isDemo()) return demo.setFeatured(mem(), session.user.id, id, on);
  const { error } = await getClient().rpc("set_featured", { p_id: id, p_on: !!on });
  if (error) {
    if (/set_featured|PGRST202|42883|schema cache/i.test(`${error.code} ${error.message}`)) {
      throw comingSoon("Los avisos destacados se habilitan muy pronto.");
    }
    throw asError(error);
  }
}

export const DEMO_LOGIN = [
  { id: demo.IDS.marina, label: "Marina López", detail: "Plan Pro anual de ejemplo: avisos ilimitados, turnero y destacados" },
  { id: demo.IDS.carlos, label: "Carlos Pereyra", detail: "Plan gratis, un solo aviso activo" },
  { id: demo.IDS.rosa, label: "Rosa Méndez", detail: "Salón sin turnero" },
  { id: demo.IDS.pedro, label: "Pedro Álvarez", detail: "Publicó un busco alquiler" },
];
