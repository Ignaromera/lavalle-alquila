import { CENTER, LAVALLE_LATLNG } from "./geo.js";

const COLORS = {
  casa: "#2c5b45",
  departamento: "#3e7c8a",
  local: "#c4552a",
  terreno: "#8a6a32",
  quincho: "#8e3f28",
  salon: "#17372a",
};

function pinIcon(L, type) {
  const color = COLORS[type] || COLORS.casa;
  return L.divIcon({
    className: "pin",
    html: `<span class="pin-dot" style="background:${color}"></span>`,
    iconSize: [28, 34],
    iconAnchor: [14, 30],
    popupAnchor: [0, -26],
  });
}

export async function mountMap(el, options = {}) {
  const L = (await import("leaflet")).default;
  await import("leaflet/dist/leaflet.css");
  if (!el.isConnected) return null;
  if (el._map) {
    el._map.remove();
    el._map = null;
  }
  const map = L.map(el, { scrollWheelZoom: false, zoomControl: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  if (options.polygon) {
    L.polygon(LAVALLE_LATLNG, {
      color: "#2c5b45",
      weight: 2,
      opacity: 0.8,
      fillColor: "#2c5b45",
      fillOpacity: 0.05,
      dashArray: "5 6",
    }).addTo(map);
  }

  const markers = [];
  for (const item of options.listings || []) {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue;
    const marker = L.marker([item.lat, item.lng], { icon: pinIcon(L, item.type) }).addTo(map);
    marker.on("click", () => options.onMarker?.(item));
    markers.push(marker);
  }

  let pin = null;
  const placePin = (lat, lng) => {
    if (!pin) {
      pin = L.marker([lat, lng], { icon: pinIcon(L, options.pinType || "casa"), draggable: true }).addTo(map);
      pin.on("dragend", () => {
        const point = pin.getLatLng();
        options.onPick?.(point.lat, point.lng);
      });
    } else {
      pin.setLatLng([lat, lng]);
    }
  };

  if (options.pin) placePin(options.pin.lat, options.pin.lng);

  if (options.onPick) {
    map.on("click", (event) => {
      const accepted = options.onPick(event.latlng.lat, event.latlng.lng);
      if (accepted !== false) placePin(event.latlng.lat, event.latlng.lng);
    });
  }

  if (markers.length) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 14 });
  } else if (options.pin) {
    map.setView([options.pin.lat, options.pin.lng], 14);
  } else {
    map.setView([CENTER.lat, CENTER.lng], options.polygon ? 11 : 12);
  }

  el._map = map;
  requestAnimationFrame(() => map.invalidateSize());
  return map;
}
