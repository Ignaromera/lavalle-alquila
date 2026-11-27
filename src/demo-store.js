import { applyFilters, isPublicListing } from "./filter.js";
import { assertReportReason, canReportAgain, clipReportDetails } from "./reports.js";
import { addDays, clock, hoursLabel, isoDay, normalizeWhatsapp, plusDaysISO } from "./format.js";
import { AMENITY_IDS, DISTRICT_NAMES, isVenue, pointInLavalle } from "./geo.js";
import { PLANS, UNLIMITED, featuredCount, pickSubscription, planId } from "./plans.js";

export const IDS = {
  marina: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  carlos: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  lucia: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  rosa: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
  pedro: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
  nico: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6",
  ana: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7",
  hugo: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8",
  marta: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9",
  elena: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10",
  casaTulumaya: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  deptoPlumero: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  local: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
  terreno: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4",
  casaVioletas: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5",
  casaAndre: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6",
  deptoJocoli: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7",
  quincho: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8",
  salon: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9",
  offerMediodia: "cccccccc-cccc-4ccc-8ccc-0000000000a1",
  offerNoche: "cccccccc-cccc-4ccc-8ccc-0000000000a2",
  offerDia: "cccccccc-cccc-4ccc-8ccc-0000000000b1",
};

const MAX_SEEKS = 5;

function profile(partial) {
  return {
    plan: "free",
    max_listings: 1,
    booking_enabled: false,
    is_admin: false,
    ...partial,
  };
}

function baseListing(partial) {
  return {
    pets_allowed: false,
    guarantee_required: true,
    capacity: null,
    amenities: [],
    photo_urls: [],
    status: "active",
    featured: false,
    booking_enabled: false,
    hidden_reason: null,
    requirements: "",
    address: "",
    offers: [],
    ...partial,
  };
}

export function createDemoStore() {
  const profiles = [
    profile({
      id: IDS.marina,
      full_name: "Marina López",
      whatsapp: "5492615550101",
      email: "marina@ejemplo.test",
      plan: "pro",
      max_listings: UNLIMITED,
      booking_enabled: true,
    }),
    profile({
      id: IDS.carlos,
      full_name: "Carlos Pereyra",
      whatsapp: "5492615550102",
      email: "carlos@ejemplo.test",
    }),
    profile({
      id: IDS.lucia,
      full_name: "Lucía Romero",
      whatsapp: "5492615550103",
      email: "lucia@ejemplo.test",
    }),
    profile({
      id: IDS.rosa,
      full_name: "Rosa Méndez",
      whatsapp: "5492615550104",
      email: "rosa@ejemplo.test",
    }),
    profile({
      id: IDS.pedro,
      full_name: "Pedro Álvarez",
      whatsapp: "5492615550105",
      email: "pedro@ejemplo.test",
    }),
    profile({
      id: IDS.nico,
      full_name: "Nicolás Díaz",
      whatsapp: "5492615550106",
      email: "nico@ejemplo.test",
    }),
    profile({
      id: IDS.ana,
      full_name: "Ana Guzmán",
      whatsapp: "5492615550107",
      email: "ana@ejemplo.test",
    }),
    profile({
      id: IDS.hugo,
      full_name: "Hugo Sosa",
      whatsapp: "5492615550108",
      email: "hugo@ejemplo.test",
    }),
    profile({
      id: IDS.marta,
      full_name: "Marta Ríos",
      whatsapp: "5492615550109",
      email: "marta@ejemplo.test",
    }),
    profile({
      id: IDS.elena,
      full_name: "Elena Paz",
      whatsapp: "5492615550110",
      email: "elena@ejemplo.test",
    }),
  ];

  const listings = [
    baseListing({
      id: IDS.casaTulumaya,
      owner_id: IDS.marina,
      type: "casa",
      title: "Casa con patio a cuadras de la plaza",
      description:
        "Casa de material de 3 dormitorios, cocina-comedor, baño y toilette. Patio con parrilla y una parra. Agua y gas de red. A 4 cuadras de la plaza departamental, cerca de la escuela. Se puede ver de tarde, con luz.",
      price_ars: 520000,
      price_unit: "mes",
      district: "Villa Tulumaya",
      address: "San Martín 450, a 4 cuadras de la plaza",
      requirements: "Recibo de sueldo o garantía propietaria en Mendoza.",
      lat: -32.7242,
      lng: -68.5984,
      photo_urls: ["demo/fotos/casa-patio.webp"],
      featured: true,
      created_at: addDays(-12).toISOString(),
      expires_at: plusDaysISO(48),
    }),
    baseListing({
      id: IDS.deptoPlumero,
      owner_id: IDS.carlos,
      type: "departamento",
      title: "Departamento de 2 ambientes, luminoso",
      description:
        "Depto de 2 ambientes con cocina separada, en planta baja. Entra el sol de la mañana. A una cuadra del asfalto, barrio tranquilo. Sirve para una pareja o una persona sola.",
      price_ars: 310000,
      price_unit: "mes",
      district: "El Plumero",
      address: "Los Sauces 120, a una cuadra del asfalto",
      requirements: "Mes de depósito y garantía. Sin mascotas.",
      guarantee_required: true,
      lat: -32.686,
      lng: -68.465,
      photo_urls: ["demo/fotos/depto.webp"],
      created_at: addDays(-4).toISOString(),
      expires_at: plusDaysISO(50),
    }),
    baseListing({
      id: IDS.local,
      owner_id: IDS.lucia,
      type: "local",
      title: "Local a la calle sobre San Martín",
      description:
        "Local de unos 40 m² con vidriera y baño, sobre calle San Martín. Bueno para almacén, peluquería o kiosco. Tiene cortina metálica y un pequeño depósito atrás.",
      price_ars: 380000,
      price_unit: "mes",
      district: "Villa Tulumaya",
      address: "San Martín 210, local con vidriera",
      requirements: "Contrato de 12 meses. Con depósito de 2 meses no hace falta garantía propietaria.",
      guarantee_required: false,
      lat: -32.7198,
      lng: -68.594,
      photo_urls: ["demo/fotos/local.webp"],
      created_at: addDays(-8).toISOString(),
      expires_at: plusDaysISO(40),
    }),
    baseListing({
      id: IDS.terreno,
      owner_id: IDS.marta,
      type: "terreno",
      title: "Lote con derecho de riego, 500 m²",
      description:
        "Lote de 10 por 50, cercado en dos lados, con derecho de agua de riego y acequia al frente. Calle de tierra en buen estado. Sirve para una casa o un parral chico.",
      price_ars: 150000,
      price_unit: "mes",
      district: "Costa de Araujo",
      address: "Calle de tierra, lote 10 frente a la acequia",
      requirements: "Se alquila por año. La seña se conversa después de verlo.",
      pets_allowed: true,
      guarantee_required: false,
      lat: -32.762,
      lng: -68.398,
      photo_urls: ["demo/fotos/vinedo-riego.webp", "demo/fotos/camino-rural.webp"],
      created_at: addDays(-2).toISOString(),
      expires_at: plusDaysISO(55),
    }),
    baseListing({
      id: IDS.casaVioletas,
      owner_id: IDS.elena,
      type: "casa",
      title: "Casa chica con galería y parra",
      description:
        "Casa de 2 dormitorios, galería y fondo con parra. Barrio tranquilo, a pocas cuadras del asfalto. Acepta una mascota chica. El tanque y la bomba andan bien.",
      price_ars: 420000,
      price_unit: "mes",
      district: "Las Violetas",
      address: "Las Heras 80, casa con parra al frente",
      requirements: "Garantía o seguro de caución. Disponibilidad inmediata.",
      pets_allowed: true,
      lat: -32.819,
      lng: -68.604,
      photo_urls: ["demo/fotos/casa-araujo.webp"],
      created_at: addDays(-6).toISOString(),
      expires_at: plusDaysISO(36),
    }),
    baseListing({
      id: IDS.casaAndre,
      owner_id: IDS.hugo,
      type: "casa",
      title: "Casa de 2 dormitorios con patio grande",
      description:
        "Casa recién pintada, dos dormitorios, cocina y baño. Tanque y bomba. Patio grande, a unos 10 minutos del centro del distrito. Preferencia familia.",
      price_ars: 260000,
      price_unit: "mes",
      district: "Ingeniero Gustavo André",
      address: "Calle principal, casa recién pintada a 10 minutos del centro",
      requirements: "Sin garantía propietaria. Se pide depósito. Preferencia familia.",
      pets_allowed: true,
      guarantee_required: false,
      lat: -32.683,
      lng: -68.32,
      photo_urls: ["demo/fotos/casa-antigua.webp"],
      created_at: addDays(-20).toISOString(),
      expires_at: plusDaysISO(5),
    }),
    baseListing({
      id: IDS.deptoJocoli,
      owner_id: IDS.nico,
      type: "departamento",
      title: "Departamento casi regalado, mudate ya",
      description:
        "Depto amoblado, precio de ocasión por viaje. Seña por transferencia para reservarlo hoy. Después coordinamos la visita.",
      price_ars: 90000,
      price_unit: "mes",
      district: "Jocolí",
      address: "Sobre la ruta 40, sin número visible",
      requirements: "Seña hoy por transferencia para bloquearlo.",
      lat: -32.66,
      lng: -68.615,
      photo_urls: ["demo/fotos/depto-moderno.webp"],
      status: "hidden",
      hidden_reason: "reports",
      created_at: addDays(-9).toISOString(),
      expires_at: plusDaysISO(30),
    }),
    baseListing({
      id: IDS.quincho,
      owner_id: IDS.marina,
      type: "quincho",
      title: "Quincho Los Álamos, con pileta",
      description:
        "Quincho techado con mesas, parrilla grande y pileta. Fondo cerrado, ideal para cumpleaños y asados. El turno mediodía es de 11 a 16 y el de noche de 20 a 00:30. Música a volumen razonable.",
      price_ars: 180000,
      price_unit: "turno",
      district: "Villa Tulumaya",
      address: "Belgrano 75, fondo Los Álamos",
      requirements: "La reserva se confirma por WhatsApp. No se pide seña por transferencia antes de ver el lugar.",
      offers: [
        { id: IDS.offerMediodia, name: "Mediodía", starts_at: "11:00", ends_at: "16:00", price_ars: 180000 },
        { id: IDS.offerNoche, name: "Noche", starts_at: "20:00", ends_at: "00:30", price_ars: 220000 },
      ],
      capacity: 45,
      amenities: ["pileta", "parrilla", "banos", "estacionamiento"],
      pets_allowed: false,
      guarantee_required: false,
      lat: -32.7185,
      lng: -68.589,
      photo_urls: ["demo/fotos/quincho-1.webp", "demo/fotos/quincho-2.webp", "demo/fotos/asado-mendoza.webp"],
      featured: true,
      booking_enabled: true,
      created_at: addDays(-3).toISOString(),
      expires_at: plusDaysISO(52),
    }),
    baseListing({
      id: IDS.salon,
      owner_id: IDS.rosa,
      type: "salon",
      title: "Salón El Vergel para fiestas",
      description:
        "Salón con cocina equipada, baños separados y estacionamiento para unos 15 autos. Sirve para un casamiento chico, un cumpleaños de 15 o un aniversario. Se visita con turno.",
      price_ars: 320000,
      price_unit: "dia",
      district: "El Vergel",
      address: "Frente a la escuela, salón con portón verde",
      requirements: "Consultá el día por WhatsApp y pasá a verlo antes de dejar una seña.",
      offers: [
        { id: IDS.offerDia, name: "Día completo", starts_at: "11:00", ends_at: "02:00", price_ars: 320000 },
      ],
      capacity: 90,
      amenities: ["cocina", "banos", "estacionamiento", "parrilla"],
      pets_allowed: false,
      guarantee_required: false,
      lat: -32.7875,
      lng: -68.608,
      photo_urls: ["demo/fotos/quincho-3.webp", "demo/fotos/quincho-2.webp"],
      booking_enabled: false,
      created_at: addDays(-7).toISOString(),
      expires_at: plusDaysISO(44),
    }),
  ];

  const slots = [];
  let slotNumber = 1;
  const slotByKey = new Map();
  for (let day = 2; day <= 18; day += 1) {
    const date = addDays(day);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    if (!weekend && day % 2 === 1) continue;
    for (const offerId of [IDS.offerMediodia, IDS.offerNoche]) {
      const id = `cccccccc-cccc-4ccc-8ccc-${String(slotNumber).padStart(12, "0")}`;
      slotNumber += 1;
      const slot = {
        id,
        listing_id: IDS.quincho,
        slot_date: isoDay(date),
        offer_id: offerId,
        status: "open",
      };
      slots.push(slot);
      slotByKey.set(`${day}|${offerId}`, slot);
    }
  }

  const confirmed = slotByKey.get(`4|${IDS.offerNoche}`);
  const pending = slotByKey.get(`6|${IDS.offerMediodia}`);
  if (confirmed) confirmed.status = "confirmed";
  if (pending) pending.status = "held";

  const requests = [];
  if (confirmed) {
    requests.push({
      id: "dddddddd-dddd-4ddd-8ddd-000000000001",
      slot_id: confirmed.id,
      listing_id: IDS.quincho,
      requester_name: "Familia Herrera",
      requester_whatsapp: "5492615550199",
      guests: 30,
      note: "Cumpleaños de 15. Llevamos la torta y un equipo chico de sonido.",
      status: "confirmed",
      created_at: addDays(-1).toISOString(),
    });
  }
  if (pending) {
    requests.push({
      id: "dddddddd-dddd-4ddd-8ddd-000000000002",
      slot_id: pending.id,
      listing_id: IDS.quincho,
      requester_name: "Julián Gómez",
      requester_whatsapp: "5492615550188",
      guests: 18,
      note: "Asado de fin de año con la oficina. Seríamos unos 18.",
      status: "pending",
      created_at: addDays(0).toISOString(),
    });
  }

  const reports = [1, 2, 3].map((n) => ({
    id: `eeeeeeee-eeee-4eee-8eee-${String(n).padStart(12, "0")}`,
    listing_id: IDS.deptoJocoli,
    visitor_id: `visitante-ejemplo-${n}`,
    reporter_id: n === 1 ? IDS.marina : n === 2 ? IDS.carlos : null,
    reason: n === 3 ? "falso" : "estafa",
    details: "Pide una seña por transferencia antes de mostrar el departamento.",
    created_at: addDays(-n).toISOString(),
    resolved_at: null,
    resolved_by: null,
  }));

  const seeks = [
    {
      id: "ffffffff-ffff-4fff-8fff-000000000001",
      owner_id: IDS.pedro,
      type: "casa",
      district: "Villa Tulumaya",
      budget_ars: 450000,
      note: "Familia con una perra mediana. Buscamos patio. También miramos El Vergel.",
      status: "active",
      created_at: addDays(-3).toISOString(),
      expires_at: plusDaysISO(40),
    },
    {
      id: "ffffffff-ffff-4fff-8fff-000000000002",
      owner_id: IDS.ana,
      type: "local",
      district: "Villa Tulumaya",
      budget_ars: 300000,
      note: "Busco un local chico para peluquería, con vidriera a la calle.",
      status: "active",
      created_at: addDays(-1).toISOString(),
      expires_at: plusDaysISO(35),
    },
  ];

  const subscriptions = [
    {
      id: "dddddddd-dddd-4ddd-8ddd-000000000001",
      user_id: IDS.marina,
      plan_id: "pro",
      billing_interval: "year",
      amount_ars: PLANS.pro.yearly,
      status: "authorized",
      created_at: addDays(-40).toISOString(),
      last_paid_at: addDays(-40).toISOString(),
      access_until: addDays(325).toISOString(),
      payment_failed_at: null,
    },
  ];
  const store = { profiles, listings, slots, requests, reports, seeks, stats: [], subscriptions };
  seedStats(store);
  return store;
}

function hashText(value) {
  let hash = 0;
  for (const char of String(value)) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function seedStats(store) {
  const subjects = [
    ...store.listings.filter((item) => item.status !== "deleted").map((item) => ({ type: "listing", id: item.id })),
    ...store.seeks.filter((item) => item.status === "active").map((item) => ({ type: "seek", id: item.id })),
  ];
  for (const subject of subjects) {
    for (let ago = 13; ago >= 0; ago -= 1) {
      const day = isoDay(addDays(-ago));
      const base = 8 + (hashText(`${subject.id}:${day}`) % 22);
      const view = base + (ago < 3 ? 6 : 0);
      const share = Math.max(1, Math.round(view * 0.16));
      const whatsapp = Math.max(0, Math.round(view * 0.09));
      store.stats.push(
        { subject_type: subject.type, subject_id: subject.id, kind: "view", day, count: view },
        { subject_type: subject.type, subject_id: subject.id, kind: "share", day, count: share },
        { subject_type: subject.type, subject_id: subject.id, kind: "whatsapp", day, count: whatsapp },
      );
    }
  }
}

export function trackStat(store, subjectType, subjectId, kind) {
  const listing = subjectType === "listing" ? store.listings.find((item) => item.id === subjectId) : null;
  const seek = subjectType === "seek" ? store.seeks.find((item) => item.id === subjectId) : null;
  const visible = listing
    ? listing.status === "active" && new Date(listing.expires_at) > new Date()
    : seek && seek.status === "active" && new Date(seek.expires_at) > new Date();
  if (!visible || !["view", "share", "whatsapp"].includes(kind)) return;
  const day = isoDay(new Date());
  const row = store.stats.find((item) => item.subject_type === subjectType && item.subject_id === subjectId && item.kind === kind && item.day === day);
  if (row) row.count += 1;
  else store.stats.push({ subject_type: subjectType, subject_id: subjectId, kind, day, count: 1 });
}

export function statsForOwner(store, ownerId) {
  const listings = new Set(store.listings.filter((item) => item.owner_id === ownerId).map((item) => item.id));
  const seeks = new Set(store.seeks.filter((item) => item.owner_id === ownerId).map((item) => item.id));
  return store.stats.filter((row) => (
    (row.subject_type === "listing" && listings.has(row.subject_id))
    || (row.subject_type === "seek" && seeks.has(row.subject_id))
  ));
}

export function emptyStore() {
  return { profiles: [], listings: [], slots: [], requests: [], reports: [], seeks: [], stats: [], subscriptions: [] };
}

function findProfile(store, id) {
  return store.profiles.find((item) => item.id === id) || null;
}

export function hydrateListing(store, listing) {
  const owner = findProfile(store, listing.owner_id);
  return {
    ...listing,
    amenities: listing.amenities || [],
    photo_urls: listing.photo_urls || [],
    offers: listing.offers || [],
    address: listing.address || "",
    owner_name: owner?.full_name || "",
    whatsapp: owner?.whatsapp || "",
    example: true,
  };
}

function hydrateSeek(store, seek) {
  const owner = findProfile(store, seek.owner_id);
  return {
    ...seek,
    owner_name: owner?.full_name || "",
    whatsapp: owner?.whatsapp || "",
    example: true,
  };
}

export function publicListings(store, filters) {
  return applyFilters(store.listings.map((item) => hydrateListing(store, item)), filters);
}

export function getListing(store, id) {
  const listing = store.listings.find((item) => item.id === id && item.status !== "deleted");
  return listing ? hydrateListing(store, listing) : null;
}

export function myListings(store, ownerId) {
  return store.listings
    .filter((item) => item.owner_id === ownerId && item.status !== "deleted")
    .map((item) => hydrateListing(store, item))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function countsTowardLimit(listing, now = new Date()) {
  return (listing.status === "active" || listing.status === "hidden") && new Date(listing.expires_at) > now;
}

function assertDistrict(name) {
  if (!DISTRICT_NAMES.includes(name)) throw new Error("Elegí un distrito de Lavalle");
}

function assertProfileReady(person) {
  if (!person?.full_name || person.full_name.trim().length < 2 || !person.whatsapp) {
    throw new Error("Completá tu nombre y WhatsApp antes de publicar");
  }
}

export function addProfile(store, fields) {
  const whatsapp = normalizeWhatsapp(fields.whatsapp);
  if (!/^[0-9]{10,15}$/.test(whatsapp)) {
    throw new Error("Revisá el WhatsApp: solo números, con código de país. Ejemplo: 2615551234");
  }
  const fullName = String(fields.full_name || "").trim();
  if (fullName.length < 2) throw new Error("Escribí tu nombre");
  const id = crypto.randomUUID();
  const person = profile({
    id,
    full_name: fullName,
    whatsapp,
    email: fields.email || `${id.slice(0, 8)}@ejemplo.test`,
  });
  store.profiles.push(person);
  return person;
}

export function updateProfile(store, id, fields) {
  const person = findProfile(store, id);
  if (!person) throw new Error("No encontramos tu perfil");
  if (fields.full_name != null) {
    const name = String(fields.full_name).trim();
    if (name.length < 2) throw new Error("Escribí tu nombre");
    person.full_name = name;
  }
  if (fields.whatsapp != null) {
    const whatsapp = normalizeWhatsapp(fields.whatsapp);
    if (!/^[0-9]{10,15}$/.test(whatsapp)) {
      throw new Error("Revisá el WhatsApp: solo números, con código de país. Ejemplo: 2615551234");
    }
    person.whatsapp = whatsapp;
  }
  return person;
}

function normalizeOffers(rawOffers, fullDay) {
  const source = Array.isArray(rawOffers) ? rawOffers : [];
  if (!source.length) throw new Error("Definí al menos un horario con su precio");
  if (fullDay && source.length !== 1) throw new Error("El día completo es un solo horario");
  return source.map((offer, index) => {
    const name = fullDay ? "Día completo" : String(offer.name || "").trim();
    if (name.length < 2 || name.length > 40) throw new Error("Poné un nombre corto a cada horario");
    const starts = clock(offer.starts_at);
    const ends = clock(offer.ends_at);
    if (!starts || !ends || starts === ends) throw new Error("Revisá la hora de inicio y de fin");
    const price = Number(offer.price_ars);
    if (!Number.isInteger(price) || price < 1000) throw new Error("Cada horario tiene que tener un precio");
    return {
      id: offer.id || crypto.randomUUID(),
      name,
      starts_at: starts,
      ends_at: ends,
      price_ars: price,
      sort_order: index,
    };
  });
}

function normalizeListingInput(input, existing) {
  const type = input.type || existing?.type;
  const venue = isVenue(type);
  const amenities = (input.amenities || existing?.amenities || []).filter((id) => AMENITY_IDS.includes(id));
  const fullDay = venue && (input.price_unit === "dia" || (!input.price_unit && existing?.price_unit === "dia"));
  const offers = venue ? normalizeOffers(input.offers || existing?.offers, fullDay) : [];
  const address = String(input.address ?? existing?.address ?? "").trim();
  const listing = {
    type,
    title: String(input.title ?? existing?.title ?? "").trim(),
    description: String(input.description ?? existing?.description ?? "").trim(),
    price_ars: venue ? Math.min(...offers.map((offer) => offer.price_ars)) : Number(input.price_ars ?? existing?.price_ars),
    price_unit: venue ? (fullDay ? "dia" : "turno") : "mes",
    district: input.district || existing?.district,
    address,
    requirements: String(input.requirements ?? existing?.requirements ?? "").trim(),
    pets_allowed: venue ? false : Boolean(input.pets_allowed),
    guarantee_required: venue ? false : Boolean(input.guarantee_required),
    capacity: venue ? Number(input.capacity ?? existing?.capacity) : null,
    amenities: venue ? amenities : [],
    offers,
    lat: Number(input.lat ?? existing?.lat),
    lng: Number(input.lng ?? existing?.lng),
    photo_urls: input.photo_urls || existing?.photo_urls || [],
  };
  if (!["casa", "departamento", "local", "terreno", "quincho", "salon"].includes(listing.type)) {
    throw new Error("Elegí el tipo de aviso");
  }
  if (listing.title.length < 8 || listing.title.length > 80) throw new Error("El título tiene que tener entre 8 y 80 caracteres");
  if (listing.description.length < 20 || listing.description.length > 2000) {
    throw new Error("Contá un poco más en la descripción (mínimo 20 caracteres)");
  }
  if (!Number.isInteger(listing.price_ars) || listing.price_ars < 1000) throw new Error("El precio tiene que ser mayor a cero");
  if (address.length < 4 || address.length > 160) throw new Error("Escribí la dirección: calle y número, o una referencia para llegar");
  assertDistrict(listing.district);
  if (listing.requirements.length > 500) throw new Error("Los requisitos son demasiado largos");
  if (listing.photo_urls.length > 6) throw new Error("Podés subir hasta 6 fotos");
  if (!pointInLavalle(listing.lat, listing.lng)) {
    throw new Error("La ubicación tiene que estar dentro del departamento de Lavalle");
  }
  if (venue) {
    if (!Number.isInteger(listing.capacity) || listing.capacity < 1 || listing.capacity > 2000) {
      throw new Error("Indicá la capacidad del lugar");
    }
  }
  return listing;
}

export function addListing(store, ownerId, input) {
  const person = findProfile(store, ownerId);
  assertProfileReady(person);
  const fields = normalizeListingInput(input);
  const active = store.listings.filter((item) => item.owner_id === ownerId && item.id && countsTowardLimit(item));
  if (active.length >= person.max_listings) {
    throw new Error(`Tu plan permite ${person.max_listings} aviso(s) activo(s). Marcá como alquilado o eliminá el que ya tenés.`);
  }
  const now = new Date().toISOString();
  const listing = baseListing({
    ...fields,
    id: crypto.randomUUID(),
    owner_id: ownerId,
    status: "active",
    featured: false,
    booking_enabled: isVenue(fields.type) && (person.booking_enabled || person.plan === "pro"),
    created_at: now,
    updated_at: now,
    expires_at: plusDaysISO(60),
  });
  store.listings.unshift(listing);
  return hydrateListing(store, listing);
}

export function updateListing(store, ownerId, listingId, input) {
  const listing = store.listings.find((item) => item.id === listingId);
  if (!listing || listing.owner_id !== ownerId) throw new Error("No autorizado");
  if (listing.status === "hidden") {
    throw new Error("Este aviso está en revisión. Solo un administrador puede restaurarlo.");
  }
  const next = normalizeListingInput({ ...listing, ...input, photo_urls: input.photo_urls || listing.photo_urls }, listing);
  const usedOffers = new Set(store.slots.filter((slot) => slot.listing_id === listing.id).map((slot) => slot.offer_id));
  const kept = new Set((next.offers || []).map((offer) => offer.id));
  for (const offerId of usedOffers) {
    if (!kept.has(offerId)) throw new Error("No saques un horario que ya tiene reservas en el calendario");
  }
  Object.assign(listing, next, { updated_at: new Date().toISOString() });
  return hydrateListing(store, listing);
}

export function setListingStatus(store, ownerId, listingId, status) {
  const listing = store.listings.find((item) => item.id === listingId);
  const person = findProfile(store, ownerId);
  if (!listing || listing.owner_id !== ownerId) throw new Error("No autorizado");
  if (listing.status === "hidden") {
    throw new Error("Este aviso está en revisión. Solo un administrador puede restaurarlo.");
  }
  if (!["active", "rented", "deleted"].includes(status)) throw new Error("Estado inválido");
  if (status === "active" && !countsTowardLimit(listing)) {
    const others = store.listings.filter((item) => item.owner_id === ownerId && item.id !== listing.id && countsTowardLimit(item));
    if (others.length >= person.max_listings) {
      throw new Error(`Tu plan permite ${person.max_listings} aviso(s) activo(s). Marcá como alquilado o eliminá el que ya tenés.`);
    }
    listing.expires_at = plusDaysISO(60);
  }
  listing.status = status;
  listing.updated_at = new Date().toISOString();
  return hydrateListing(store, listing);
}

export function renewListing(store, ownerId, listingId) {
  const listing = store.listings.find((item) => item.id === listingId);
  const person = findProfile(store, ownerId);
  if (!listing || listing.owner_id !== ownerId) throw new Error("No se pudo renovar");
  if (listing.status === "hidden") {
    throw new Error("Este aviso está en revisión. Solo un administrador puede restaurarlo.");
  }
  if (listing.status !== "active") throw new Error("No se pudo renovar");
  const wasCounting = countsTowardLimit(listing);
  if (!wasCounting) {
    const others = store.listings.filter((item) => item.owner_id === ownerId && item.id !== listing.id && countsTowardLimit(item));
    if (others.length >= person.max_listings) {
      throw new Error(`Tu plan permite ${person.max_listings} aviso(s) activo(s). Marcá como alquilado o eliminá el que ya tenés.`);
    }
  }
  listing.expires_at = plusDaysISO(60);
  listing.updated_at = new Date().toISOString();
  return hydrateListing(store, listing);
}

function alreadyReported(store, { listingId, seekId, visitorId, reporterId }) {
  return store.reports.some((item) => {
    if (listingId && item.listing_id !== listingId) return false;
    if (seekId && item.seek_id !== seekId) return false;
    if (!listingId && !seekId) return false;
    if (item.visitor_id === visitorId) return true;
    return !!(reporterId && item.reporter_id && item.reporter_id === reporterId);
  });
}

function countedReports(store, listing) {
  const ids = new Set(
    store.reports
      .filter((item) => item.listing_id === listing.id && !item.resolved_at && item.reporter_id && item.reporter_id !== listing.owner_id)
      .map((item) => item.reporter_id),
  );
  return ids.size;
}

export function addReport(store, listingId, visitorId, reason, details, { seekId, reporterId = null } = {}) {
  assertReportReason(reason);
  if (!canReportAgain(store.reports, visitorId)) {
    throw new Error("Llegaste al límite de denuncias por hoy. Probá mañana.");
  }
  if (seekId) {
    const seek = store.seeks.find((item) => item.id === seekId && item.status !== "deleted");
    if (!seek) throw new Error("Esa búsqueda no está");
    if (reporterId && seek.owner_id === reporterId) throw new Error("No se pudo denunciar esta búsqueda. Si es tuya, no hace falta denunciarla.");
    if (alreadyReported(store, { seekId, visitorId, reporterId })) {
      throw new Error("Ya denunciaste esta búsqueda. Gracias.");
    }
    store.reports.push({
      id: crypto.randomUUID(),
      listing_id: null,
      seek_id: seekId,
      visitor_id: visitorId,
      reporter_id: reporterId || null,
      reason,
      details: clipReportDetails(details),
      created_at: new Date().toISOString(),
      resolved_at: null,
      resolved_by: null,
    });
    return store.reports.filter((item) => item.seek_id === seekId && !item.resolved_at).length;
  }
  const listing = store.listings.find((item) => item.id === listingId && item.status !== "deleted");
  if (!listing) throw new Error("Ese aviso no está");
  if (reporterId && listing.owner_id === reporterId) throw new Error("No se pudo denunciar este aviso. Si es tuyo, no hace falta denunciarlo.");
  if (alreadyReported(store, { listingId, visitorId, reporterId })) {
    throw new Error("Ya denunciaste este aviso. Gracias.");
  }
  store.reports.push({
    id: crypto.randomUUID(),
    listing_id: listingId,
    seek_id: null,
    visitor_id: visitorId,
    reporter_id: reporterId || null,
    reason,
    details: clipReportDetails(details),
    created_at: new Date().toISOString(),
    resolved_at: null,
    resolved_by: null,
  });
  const count = countedReports(store, listing);
  if (count >= 3 && listing.status === "active") {
    listing.status = "hidden";
    listing.hidden_reason = "reports";
  }
  return count;
}

export function adminReports(store) {
  return store.reports
    .map((report) => decorateReport(store, report))
    .sort((a, b) => Number(!!a.resolved_at) - Number(!!b.resolved_at) || new Date(b.created_at) - new Date(a.created_at));
}

function decorateReport(store, report) {
  const listing = report.listing_id ? store.listings.find((item) => item.id === report.listing_id) : null;
  const seek = report.seek_id ? store.seeks.find((item) => item.id === report.seek_id) : null;
  return {
    ...report,
    subject_type: listing ? "listing" : "seek",
    subject_title: listing?.title || (seek ? `Busco alquiler: ${seek.note}` : "Publicación"),
    subject_status: listing?.status || seek?.status || "",
    subject_href: listing ? `#/aviso/${listing.id}` : seek ? `#/busco/${seek.id}` : "#/",
  };
}

export function adminResolveReport(store, reportId, actorId = null) {
  const report = store.reports.find((item) => item.id === reportId);
  if (!report) throw new Error("Esa denuncia no está");
  report.resolved_at = new Date().toISOString();
  report.resolved_by = actorId;
  return decorateReport(store, report);
}

export function adminHideListing(store, listingId) {
  const listing = store.listings.find((item) => item.id === listingId);
  if (!listing) throw new Error("Ese aviso no está");
  listing.status = "hidden";
  listing.hidden_reason = listing.hidden_reason || "admin";
  return hydrateListing(store, listing);
}

export function adminRemoveSeek(store, seekId) {
  const seek = store.seeks.find((item) => item.id === seekId);
  if (!seek) throw new Error("Esa búsqueda no está");
  seek.status = "deleted";
}

export function publicSeeks(store) {
  return store.seeks
    .filter((item) => item.status === "active" && new Date(item.expires_at) > new Date())
    .map((item) => hydrateSeek(store, item))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function mySeeks(store, ownerId) {
  return store.seeks
    .filter((item) => item.owner_id === ownerId && item.status !== "deleted")
    .map((item) => hydrateSeek(store, item));
}

export function addSeek(store, ownerId, input) {
  const person = findProfile(store, ownerId);
  assertProfileReady(person);
  const active = store.seeks.filter((item) => item.owner_id === ownerId && item.status === "active" && new Date(item.expires_at) > new Date());
  if (active.length >= MAX_SEEKS) throw new Error("Ya tenés varias búsquedas activas. Renová o borrá una.");
  const type = input.type || "cualquiera";
  if (!["casa", "departamento", "local", "terreno", "quincho", "salon", "cualquiera"].includes(type)) {
    throw new Error("Elegí qué estás buscando");
  }
  if (input.district) assertDistrict(input.district);
  const note = String(input.note || "").trim();
  if (note.length < 10) throw new Error("Contá en una frase qué necesitás");
  const budget = Number(input.budget_ars);
  if (!Number.isInteger(budget) || budget < 1000) throw new Error("Indicá un presupuesto por mes");
  const seek = {
    id: crypto.randomUUID(),
    owner_id: ownerId,
    type,
    district: input.district || null,
    budget_ars: budget,
    note,
    status: "active",
    created_at: new Date().toISOString(),
    expires_at: plusDaysISO(60),
  };
  store.seeks.unshift(seek);
  return hydrateSeek(store, seek);
}

export function renewSeek(store, ownerId, seekId) {
  const seek = store.seeks.find((item) => item.id === seekId && item.owner_id === ownerId);
  if (!seek || seek.status !== "active") throw new Error("No se pudo renovar");
  seek.expires_at = plusDaysISO(60);
  return hydrateSeek(store, seek);
}

export function deleteSeek(store, ownerId, seekId) {
  const seek = store.seeks.find((item) => item.id === seekId && item.owner_id === ownerId);
  if (!seek) throw new Error("No autorizado");
  seek.status = "deleted";
}

function venueOwned(store, ownerId, listingId) {
  const listing = store.listings.find((item) => item.id === listingId);
  if (!listing || listing.owner_id !== ownerId) throw new Error("No autorizado");
  if (!isVenue(listing.type) || !listing.booking_enabled) {
    throw new Error("El turnero no está activo en este aviso");
  }
  return listing;
}

export function listSlots(store, listingId) {
  const listing = store.listings.find((item) => item.id === listingId);
  const offers = new Map((listing?.offers || []).map((offer) => [offer.id, offer]));
  return store.slots
    .filter((slot) => slot.listing_id === listingId)
    .map((slot) => {
      const offer = offers.get(slot.offer_id);
      return {
        ...slot,
        offer_name: offer?.name || "",
        starts_at: offer?.starts_at || "",
        ends_at: offer?.ends_at || "",
        price_ars: offer?.price_ars ?? null,
      };
    })
    .sort((a, b) => a.slot_date.localeCompare(b.slot_date) || String(a.starts_at).localeCompare(String(b.starts_at)));
}

export function toggleSlot(store, ownerId, listingId, slotDate, offerId, open) {
  const listing = venueOwned(store, ownerId, listingId);
  const offer = (listing.offers || []).find((item) => item.id === offerId);
  if (!offer) throw new Error("Ese horario no está en el aviso");
  const today = isoDay(new Date());
  const max = isoDay(addDays(180));
  if (slotDate < today || slotDate > max) throw new Error("La fecha tiene que estar entre hoy y los próximos 6 meses");
  const existing = store.slots.find((slot) => slot.listing_id === listingId && slot.slot_date === slotDate && slot.offer_id === offerId);
  if (open) {
    if (existing) return existing;
    const slot = { id: crypto.randomUUID(), listing_id: listingId, slot_date: slotDate, offer_id: offerId, status: "open" };
    store.slots.push(slot);
    return slot;
  }
  if (!existing) return null;
  if (existing.status !== "open" || store.requests.some((item) => item.slot_id === existing.id && item.status !== "rejected")) {
    throw new Error("Ese turno ya está tomado o en consulta");
  }
  store.slots = store.slots.filter((slot) => slot !== existing);
  return null;
}

export function requestBooking(store, input) {
  const slot = store.slots.find((item) => item.id === input.slotId);
  if (!slot || slot.status !== "open") throw new Error("Ese turno ya está tomado o en consulta");
  const listing = store.listings.find((item) => item.id === slot.listing_id);
  if (!listing || !listing.booking_enabled || !isVenue(listing.type) || listing.status !== "active" || new Date(listing.expires_at) <= new Date()) {
    throw new Error("El turnero no está activo en este aviso");
  }
  if (store.requests.some((item) => item.slot_id === slot.id && (item.status === "pending" || item.status === "confirmed"))) {
    throw new Error("Ese turno ya está tomado o en consulta");
  }
  const name = String(input.name || "").trim();
  if (name.length < 2) throw new Error("Escribí tu nombre");
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!/^[0-9]{10,15}$/.test(whatsapp)) throw new Error("Revisá el WhatsApp: solo números, con código de país");
  const guests = Number(input.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > listing.capacity) {
    throw new Error("La cantidad de personas no entra en la capacidad del lugar");
  }
  const note = String(input.note || "").trim().slice(0, 400);
  const request = {
    id: crypto.randomUUID(),
    slot_id: slot.id,
    listing_id: listing.id,
    requester_name: name,
    requester_whatsapp: whatsapp,
    guests,
    note,
    status: "pending",
    created_at: new Date().toISOString(),
  };
  store.requests.push(request);
  slot.status = "held";
  return request;
}

export function setBookingStatus(store, actorId, requestId, status) {
  const request = store.requests.find((item) => item.id === requestId);
  if (!request) throw new Error("No encontramos ese pedido");
  const listing = store.listings.find((item) => item.id === request.listing_id);
  const actor = findProfile(store, actorId);
  if (!listing || !actor || (listing.owner_id !== actorId && !actor.is_admin)) throw new Error("No autorizado");
  const slot = store.slots.find((item) => item.id === request.slot_id);
  if (status === "confirmed") {
    if (request.status !== "pending") throw new Error("Ese pedido ya fue resuelto");
    if (store.requests.some((item) => item.slot_id === request.slot_id && item.status === "confirmed")) {
      throw new Error("Ese turno ya tiene una reserva confirmada");
    }
    request.status = "confirmed";
    if (slot) slot.status = "confirmed";
    for (const other of store.requests) {
      if (other.slot_id === request.slot_id && other.id !== request.id && other.status === "pending") other.status = "rejected";
    }
  } else if (status === "rejected") {
    if (request.status !== "pending") throw new Error("Ese pedido ya fue resuelto");
    request.status = "rejected";
    const busy = store.requests.some((item) => item.slot_id === request.slot_id && (item.status === "pending" || item.status === "confirmed"));
    if (slot && !busy) slot.status = "open";
  } else {
    throw new Error("Estado inválido");
  }
  return request;
}

export function myBookingRequests(store, ownerId) {
  const mine = new Set(store.listings.filter((item) => item.owner_id === ownerId).map((item) => item.id));
  return store.requests
    .filter((item) => mine.has(item.listing_id))
    .map((item) => decorateRequest(store, item))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function offerLabel(listing, slot) {
  const offer = (listing?.offers || []).find((item) => item.id === slot?.offer_id);
  if (!offer) return "";
  return `${offer.name} · ${hoursLabel(offer.starts_at, offer.ends_at)}`;
}

export function getSeek(store, id) {
  const seek = store.seeks.find((item) => item.id === id && item.status !== "deleted");
  if (!seek) return null;
  return hydrateSeek(store, seek);
}

function decorateRequest(store, request) {
  const slot = store.slots.find((item) => item.id === request.slot_id);
  const listing = store.listings.find((item) => item.id === request.listing_id);
  return {
    ...request,
    slot_date: slot?.slot_date || "",
    shift: offerLabel(listing, slot),
    listing_title: listing?.title || "",
  };
}


function sortByFeaturedDate(a, b) {
  const featured = Number(b.featured) - Number(a.featured);
  if (featured) return featured;
  return new Date(b.created_at) - new Date(a.created_at);
}

/** Datos públicos de un anunciante: nombre y cantidades, sin email. */
export function getAdvertiser(store, ownerId, { isAdmin = false } = {}) {
  const person = findProfile(store, ownerId);
  if (!person) return null;
  const listingCount = store.listings.filter((item) => item.owner_id === ownerId && isPublicListing(item)).length;
  const seekCount = store.seeks.filter((item) => (
    item.owner_id === ownerId
    && item.status === "active"
    && new Date(item.expires_at) > new Date()
  )).length;
  const hasPrivate = isAdmin && store.listings.some((item) => item.owner_id === ownerId && item.status !== "deleted");
  if (!isAdmin && listingCount === 0 && seekCount === 0 && !hasPrivate) return null;
  if (!listingCount && !seekCount && !hasPrivate) return null;
  return {
    id: person.id,
    full_name: person.full_name || "",
    listing_count: listingCount,
    seek_count: seekCount,
  };
}

export function advertiserListings(store, ownerId, { includePrivate = false } = {}) {
  return store.listings
    .filter((item) => item.owner_id === ownerId && item.status !== "deleted")
    .filter((item) => includePrivate || isPublicListing(item))
    .map((item) => hydrateListing(store, item))
    .sort(sortByFeaturedDate);
}

export function advertiserSeeks(store, ownerId) {
  return store.seeks
    .filter((item) => (
      item.owner_id === ownerId
      && item.status === "active"
      && new Date(item.expires_at) > new Date()
    ))
    .map((item) => hydrateSeek(store, item))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function adminListings(store) {
  return store.listings
    .filter((item) => item.status !== "deleted")
    .map((item) => {
      const reports = store.reports.filter((report) => report.listing_id === item.id);
      const open = reports.filter((report) => !report.resolved_at);
      return { ...hydrateListing(store, item), report_count: open.length, reports: open };
    })
    .sort((a, b) => Number(b.status === "hidden") - Number(a.status === "hidden") || b.report_count - a.report_count);
}

export function adminRestore(store, listingId) {
  const listing = store.listings.find((item) => item.id === listingId);
  if (!listing) throw new Error("Ese aviso no está");
  listing.status = "active";
  listing.hidden_reason = null;
  if (new Date(listing.expires_at) <= new Date()) listing.expires_at = plusDaysISO(60);
  return hydrateListing(store, listing);
}

export function adminRemove(store, listingId) {
  const listing = store.listings.find((item) => item.id === listingId);
  if (!listing) throw new Error("Ese aviso no está");
  listing.status = "deleted";
}

export function adminSetFlags(store, listingId, flags) {
  const listing = store.listings.find((item) => item.id === listingId);
  if (!listing) throw new Error("Ese aviso no está");
  if (flags.featured != null) listing.featured = Boolean(flags.featured);
  if (flags.booking_enabled != null) {
    if (flags.booking_enabled && !isVenue(listing.type)) {
      throw new Error("El turnero solo aplica a quinchos y salones");
    }
    listing.booking_enabled = Boolean(flags.booking_enabled);
  }
  return hydrateListing(store, listing);
}

export function subscriptionFor(store, userId) {
  return pickSubscription((store.subscriptions || []).filter((row) => row.user_id === userId));
}

export function cancelSubscription(store, userId) {
  const sub = subscriptionFor(store, userId);
  if (!sub || sub.status !== "authorized") throw new Error("No tenés una suscripción para cancelar.");
  sub.status = "cancelled";
  sub.cancelled_at = new Date().toISOString();
  return sub;
}

/** Destacar un aviso propio. El tope sale del plan, igual que en la base. */
export function setFeatured(store, ownerId, listingId, on) {
  const listing = store.listings.find((item) => item.id === listingId && item.owner_id === ownerId);
  if (!listing) throw new Error("No autorizado");
  if (!on) {
    listing.featured = false;
    return hydrateListing(store, listing);
  }
  const person = findProfile(store, ownerId);
  const slots = PLANS[planId(person.plan)].featuredSlots;
  if (!(listing.status === "active" && new Date(listing.expires_at) > new Date())) {
    throw new Error("Solo se pueden destacar avisos activos");
  }
  if (slots < 1) throw new Error("Los avisos destacados son del plan Pro");
  const others = store.listings.filter((item) => item.owner_id === ownerId && item.id !== listingId);
  if (featuredCount(others) >= slots) {
    throw new Error(`Ya usaste tus ${slots} destacados. Sacale el destacado a uno para destacar otro.`);
  }
  listing.featured = true;
  return hydrateListing(store, listing);
}
