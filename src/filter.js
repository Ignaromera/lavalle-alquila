import { isVenue } from "./geo.js";

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
    .sort((a, b) => {
      const featured = Number(b.featured) - Number(a.featured);
      if (featured) return featured;
      return new Date(b.created_at) - new Date(a.created_at);
    });
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
