import { createClient } from "@supabase/supabase-js";
import { config, isConfigured } from "./config.js";
import * as demo from "./demo-store.js";
import { applyFilters } from "./filter.js";
import { clock, isoDay, normalizeWhatsapp } from "./format.js";
import { claimDailyView } from "./stats.js";
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

export function watchAuth(onChange) {
  if (isDemo()) return;
  getClient().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") onChange(event);
  });
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

export async function requestEmailCode(email) {
  if (isDemo()) {
    throw new Error("En el modo ejemplo no se envían correos. Entrá con una cuenta de ejemplo o configurá Supabase.");
  }
  const { error } = await getClient().auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: `${location.origin}${location.pathname}`,
      shouldCreateUser: true,
    },
  });
  if (error) throw asError(error);
}

export async function verifyEmailCode(email, token) {
  if (isDemo()) throw new Error("En el modo ejemplo no hay códigos.");
  const code = token.trim();
  if (!/^\d{6,10}$/.test(code)) {
    throw new Error("El código tiene entre 6 y 10 números. Si el correo trajo un enlace, abrilo en este teléfono.");
  }
  const { error } = await getClient().auth.verifyOtp({
    email: email.trim(),
    token: code,
    type: "email",
  });
  if (error) throw new Error("El código no sirve o está vencido. Pedí otro, o abrí el enlace del correo.");
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
  const base = import.meta.env.BASE_URL || "./";
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
  const { error } = await getClient().from("reports").insert({
    listing_id: id,
    visitor_id: visitor,
    reason,
    details: details || "",
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw new Error("Ya denunciaste este aviso. Gracias.");
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

export const DEMO_LOGIN = [
  { id: demo.IDS.marina, label: "Marina López", detail: "Plan pro de ejemplo, con quincho y turnero" },
  { id: demo.IDS.carlos, label: "Carlos Pereyra", detail: "Plan gratis, un solo aviso activo" },
  { id: demo.IDS.rosa, label: "Rosa Méndez", detail: "Salón sin turnero" },
  { id: demo.IDS.pedro, label: "Pedro Álvarez", detail: "Publicó un busco alquiler" },
];
