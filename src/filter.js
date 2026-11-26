import { isVenue } from "./geo.js";

export const SORT_RECIENTES = "recientes";
export const SORT_PRECIO_ASC = "precio-asc";
export const SORT_PRECIO_DESC = "precio-desc";
export const SORT_OPTIONS = [
  { id: SORT_RECIENTES, label: "Más recientes" },
  { id: SORT_PRECIO_ASC, label: "Menor precio" },
  { id: SORT_PRECIO_DESC, label: "Mayor precio" },
];
export const SORT_STORAGE_KEY = "lavalle-orden";
const NEW_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeSort(value) {
  if (value === SORT_PRECIO_ASC || value === SORT_PRECIO_DESC) return value;
  return SORT_RECIENTES;
}

export function readStoredSort() {
  try {
    return normalizeSort(sessionStorage.getItem(SORT_STORAGE_KEY));
  } catch {
    return SORT_RECIENTES;
  }
}

export function storeSort(value) {
  const sort = normalizeSort(value);
  try {
    if (sort === SORT_RECIENTES) sessionStorage.removeItem(SORT_STORAGE_KEY);
    else sessionStorage.setItem(SORT_STORAGE_KEY, sort);
  } catch {
    /* storage puede no estar en tests o en modo privado */
  }
  return sort;
}

export function sortFromParams(params) {
  const fromUrl = params?.get?.("orden");
  if (fromUrl) {
    const sort = normalizeSort(fromUrl);
    storeSort(sort);
    return sort;
  }
  return readStoredSort();
}

/** Aviso creado en los últimos 7 días (incluye el día 7). */
export function isNewListing(listing, now = new Date()) {
  const created = listing?.created_at ? new Date(listing.created_at) : null;
  if (!created || Number.isNaN(+created)) return false;
  const age = now - created;
  return age >= 0 && age <= NEW_MS;
}

export function isPublicListing(listing, now = new Date()) {
  return listing.status === "active" && new Date(listing.expires_at) > now;
}

export function applyFilters(listings, filters = {}) {
  const kind = filters.kind || "housing";
  const amenities = filters.amenities || [];
  const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null;
  const minCapacity = filters.minCapacity ? Number(filters.minCapacity) : null;

  return listings
    .filter((listing) => {
      if (!isPublicListing(listing)) return false;
      if (kind === "housing" && isVenue(listing.type)) return false;
      if (kind === "venue" && !isVenue(listing.type)) return false;
      if (kind === "all") {
        /* sin recorte por rubro */
      }
      if (filters.type && listing.type !== filters.type) return false;
      if (filters.district && listing.district !== filters.district) return false;
      if (maxPrice && listing.price_ars > maxPrice) return false;
      if (filters.pets === "si" && !listing.pets_allowed) return false;
      if (filters.pets === "no" && listing.pets_allowed) return false;
      if (filters.guarantee === "si" && !listing.guarantee_required) return false;
      if (filters.guarantee === "no" && listing.guarantee_required) return false;
      if (minCapacity && (listing.capacity || 0) < minCapacity) return false;
      if (filters.priceUnit && listing.price_unit !== filters.priceUnit) return false;
      if (amenities.length && !amenities.every((id) => (listing.amenities || []).includes(id))) {
        return false;
      }
      return true;
    })
    .sort((a, b) => compareListings(a, b, filters.sort));
}

function compareListings(a, b, sortValue) {
  const sort = normalizeSort(sortValue);
  const byDate = new Date(b.created_at) - new Date(a.created_at);
  if (sort === SORT_PRECIO_ASC) return (a.price_ars || 0) - (b.price_ars || 0) || byDate;
  if (sort === SORT_PRECIO_DESC) return (b.price_ars || 0) - (a.price_ars || 0) || byDate;
  // Más recientes (default): los destacados van primero, solo en este orden.
  // En menor/mayor precio el destacado no se pincha arriba, para que el orden de precio sea honesto.
  const featured = Number(b.featured) - Number(a.featured);
  if (featured) return featured;
  return byDate;
}

export function filtersFromParams(params, kind) {
  return {
    kind,
    type: params.get("tipo") || "",
    district: params.get("distrito") || "",
    maxPrice: params.get("max") || "",
    pets: params.get("mascotas") || "",
    guarantee: params.get("garantia") || "",
    minCapacity: params.get("capacidad") || "",
    priceUnit: params.get("unidad") || "",
    amenities: (params.get("comodidades") || "").split(",").filter(Boolean),
    sort: sortFromParams(params),
  };
}

export function queryFromFilters(filters, extra = {}) {
  const params = new URLSearchParams();
  if (extra.vista) params.set("vista", extra.vista);
  if (filters.type) params.set("tipo", filters.type);
  if (filters.district) params.set("distrito", filters.district);
  if (filters.maxPrice) params.set("max", String(filters.maxPrice));
  if (filters.pets) params.set("mascotas", filters.pets);
  if (filters.guarantee) params.set("garantia", filters.guarantee);
  if (filters.minCapacity) params.set("capacidad", String(filters.minCapacity));
  if (filters.priceUnit) params.set("unidad", filters.priceUnit);
  if (filters.amenities?.length) params.set("comodidades", filters.amenities.join(","));
  const sort = normalizeSort(filters.sort);
  if (sort && sort !== SORT_RECIENTES) params.set("orden", sort);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function activeFilterCount(filters) {
  let n = 0;
  if (filters.type) n += 1;
  if (filters.district) n += 1;
  if (filters.maxPrice) n += 1;
  if (filters.pets) n += 1;
  if (filters.guarantee) n += 1;
  if (filters.minCapacity) n += 1;
  if (filters.priceUnit) n += 1;
  if (filters.amenities?.length) n += 1;
  return n;
}
