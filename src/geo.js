import ring from "../data/lavalle-boundary.json" with { type: "json" };

/** Anillo [lng, lat] del departamento de Lavalle (OpenStreetMap, simplificado). */
export const LAVALLE_RING = ring;

/** Para Leaflet, que pide [lat, lng]. */
export const LAVALLE_LATLNG = ring.map(([lng, lat]) => [lat, lng]);

export const CENTER = { lat: -32.7215, lng: -68.5958 };

export function pointInLavalle(lat, lng) {
  const y = Number(lat);
  const x = Number(lng);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return false;
  const n = ring.length;
  let inside = false;
  let j = n - 1;
  for (let i = 0; i < n; i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const crosses = yi > y !== yj > y;
    const denom = yj - yi;
    if (crosses && denom !== 0 && x < ((xj - xi) * (y - yi)) / denom + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

export const DISTRICTS = [
  { name: "Villa Tulumaya", lat: -32.7215, lng: -68.5958 },
  { name: "Jocolí", lat: -32.655, lng: -68.62 },
  { name: "Jocolí Viejo", lat: -32.70825, lng: -68.67405 },
  { name: "Costa de Araujo", lat: -32.7581, lng: -68.395 },
  { name: "Ingeniero Gustavo André", lat: -32.68006, lng: -68.31653 },
  { name: "El Plumero", lat: -32.68357, lng: -68.46188 },
  { name: "La Pega", lat: -32.80825, lng: -68.66848 },
  { name: "Tres de Mayo", lat: -32.67901, lng: -68.63567 },
  { name: "El Vergel", lat: -32.7848, lng: -68.61204 },
  { name: "Las Violetas", lat: -32.82242, lng: -68.60613 },
  { name: "La Holanda", lat: -32.81419, lng: -68.51165 },
  { name: "Paramillo", lat: -32.7763, lng: -68.57186 },
  { name: "El Carmen", lat: -32.6638, lng: -68.39786 },
  { name: "La Asunción", lat: -32.5761, lng: -68.27002 },
  { name: "El Retamo", lat: -32.46945, lng: -67.38031 },
];

export const DISTRICT_NAMES = DISTRICTS.map((d) => d.name);

export const HOUSING_TYPES = [
  { id: "casa", label: "Casa" },
  { id: "departamento", label: "Departamento" },
  { id: "local", label: "Local" },
  { id: "terreno", label: "Terreno" },
];

export const VENUE_TYPES = [
  { id: "quincho", label: "Quincho" },
  { id: "salon", label: "Salón" },
];

export const AMENITIES = [
  { id: "pileta", label: "Pileta" },
  { id: "parrilla", label: "Parrilla" },
  { id: "cocina", label: "Cocina" },
  { id: "banos", label: "Baños" },
  { id: "estacionamiento", label: "Estacionamiento" },
];

export const AMENITY_IDS = AMENITIES.map((a) => a.id);

export function isVenue(type) {
  return type === "quincho" || type === "salon";
}

export function shiftsFor(priceUnit) {
  if (priceUnit === "dia") return ["dia"];
  if (priceUnit === "turno") return ["mediodia", "noche"];
  return [];
}
