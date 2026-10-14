// Interface pictograms (24x24, drawn in currentColor), from the "Feel Lab"
// prototype (strategy/12-feel/). Plain SVG markup so React and SVG scenes
// (the sun arc) can share them.

const W = 'fill="#fff"';

export const UI_ICON = {
  car: '<path d="M5.2 11 6.7 6.4A2 2 0 0 1 8.6 5h6.8a2 2 0 0 1 1.9 1.4l1.5 4.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="3" y="10.4" width="18" height="6.8" rx="2.2" fill="currentColor"/><circle cx="7" cy="13.8" r="1.5" ' + W + '/><circle cx="17" cy="13.8" r="1.5" ' + W + '/><path d="M5.3 17.2v2.4M18.7 17.2v2.4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  bus: '<rect x="4.5" y="3" width="15" height="15.5" rx="3" fill="currentColor"/><rect x="6.7" y="6.6" width="10.6" height="5.2" rx="1" ' + W + '/><path d="M8.2 4.9h7.6" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="8.2" cy="15" r="1.3" ' + W + '/><circle cx="15.8" cy="15" r="1.3" ' + W + '/><path d="M7.3 18v2.4M16.7 18v2.4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M2.6 7.2v3.4M21.4 7.2v3.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  train: '<rect x="5" y="2.5" width="14" height="15" rx="3.5" fill="currentColor"/><rect x="7.2" y="5.6" width="9.6" height="4.6" rx="1" ' + W + '/><circle cx="8.7" cy="13.8" r="1.3" ' + W + '/><circle cx="15.3" cy="13.8" r="1.3" ' + W + '/><path d="M8.5 17.5 6.2 21.3M15.5 17.5l2.3 3.8M7.4 19.8h9.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  walker: '<circle cx="13" cy="4" r="2.6" fill="currentColor"/><path d="M12.3 7.6 10 13l2.4 2.3-1.2 5.7M12.3 7.6l2.4 4.9 2.3 1.2M10 13l-2.4 7.6" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.6 10.4 17 21" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  boot: '<path d="M6 3.5h6v7l6.5 3.2c1 .5 1.5 1.3 1.5 2.3V18H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M5 20.5h15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  kid: '<circle cx="8" cy="5.5" r="2.4" fill="currentColor"/><circle cx="16.5" cy="9" r="1.9" fill="currentColor"/><path d="M8 9.5v6M8 11.5l-3 2.5M8 11.5l3 2.5M8 15.5l-2 5M8 15.5l2 5M16.5 12v4.2M16.5 13.5l-2.2 1.8M16.5 13.5l2.2 1.8M16.5 16.2l-1.4 4.3M16.5 16.2l1.4 4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" fill="currentColor"/><circle cx="12" cy="10" r="2.4" ' + W + '/>',
  map: '<path d="m3.5 6 5.5-2 6 2 5.5-2v14l-5.5 2-6-2-5.5 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="1.6"/>',
  up: '<path d="m4 18 6-8 4 5 6-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  chev: '<path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  down: '<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  back: '<path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  dot: '<circle cx="12" cy="12" r="4.2" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="4.5" cy="6" r="1.5" fill="currentColor"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor"/>',
  expand: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
} as const;

export type UiIconName = keyof typeof UI_ICON;

/**
 * The same icon as a solid shape `w` wider on every side (in icon units), to
 * draw underneath it as an outline of even weight: stroked lines get 2w more
 * width, filled shapes a 2w stroke. A plain CSS stroke can't do this, since it
 * replaces each line's own width instead of adding to it.
 */
export function iconEdge(markup: string, w = 1.2): string {
  return markup.replace(/<(circle|rect|path)\b([^>]*?)\/>/g, (_, tag: string, attrs: string) => {
    const width = /stroke-width="([\d.]+)"/.exec(attrs);
    const rest = attrs
      .replace(/\s(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)="[^"]*"/g, "")
      .trim();
    const filled = !/fill="none"/.test(attrs);
    const sw = Math.round((width ? Number(width[1]) + 2 * w : 2 * w) * 100) / 100;
    return `<${tag} ${rest} fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
}
