const PATHS = {
  home: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1Z"/>',
  map: '<path d="M9 18 3 20V6l6-2 6 2 6-2v14l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  party: '<path d="M4 11 12 4l8 7"/><path d="M6 11v8h12v-8"/><path d="M10 19v-4h4v4"/>',
  user: '<path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M5 20a7 7 0 0 1 14 0"/>',
};

export function icon(name) {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${PATHS[name] || ""}</svg>`;
}
