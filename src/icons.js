const PATHS = {
  home: '<path d="M4 11.5 12 4l8 7.5V20H4z"/><path d="M10 20v-5h4v5"/>',
  map: '<path d="M9 18 3 20V6l6-2 6 2 6-2v14l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  party: '<path d="M5 13h14"/><path d="M6 13c0 3.6 2.4 5.5 6 5.5s6-1.9 6-5.5"/><path d="M9 18.4 7.8 21.5M15 18.4l1.2 3.1"/><path d="M8 13v-3M12 13V8.5M16 13v-3"/>',
  grill: '<path d="M5 13h14"/><path d="M6 13c0 3.6 2.4 5.5 6 5.5s6-1.9 6-5.5"/><path d="M9 18.4 7.8 21.5M15 18.4l1.2 3.1"/><path d="M8 13v-3M12 13V8.5M16 13v-3"/>',
  user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4"/>',
  arrow: '<path d="M15 5l-7 7 7 7"/>',
  filter: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v6h14v-6"/>',
  wa: '<path d="M4 20l1.4-4.2A8 8 0 1 1 8.4 18.8z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-.8.8c-.8-.4-1.6-1.2-2-2l.8-.8-1-2z"/>',
  cam: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>',
  nav: '<path d="M4 11l16-7-7 16-2-7z"/>',
};

export function icon(name) {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${PATHS[name] || ""}</svg>`;
}
