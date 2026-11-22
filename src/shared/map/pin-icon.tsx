/**
 * Map pin in the familiar "Google Maps" shape: a round head with a point at the bottom that sits on the spot
 * (03-design-guide §2.3). Colours are design tokens (CSS variable names), the glyph inside says the same as the colour
 * so the pin also works without colour vision. One shape for the Leaflet marker (an HTML string, since Leaflet icons are
 * HTML) and for legends and badges (a React SVG), so both always look the same.
 */

/** Head centre (14, 13.5), radius 12.5; point at (14, 39). */
export const PIN_PATH = 'M14 1C7.1 1 1.5 6.5 1.5 13.4c0 9.2 10.6 19.3 11.8 24.6.1.6.4 1 .7 1s.6-.4.7-1c1.2-5.3 11.8-15.4 11.8-24.6C26.5 6.5 20.9 1 14 1z';
export const PIN_W = 28;
export const PIN_H = 40;
const CHECK_PATH = 'M9.6 13.6l3 3 5.8-6.2';
/** A small house (branch / office) inside the pin head. */
const HOME_PATH = 'M9.8 13.4 14 9.6l4.2 3.8M11.2 12.4v4.6h5.6v-4.6';
/** Puts a 24×24 icon path inside the pin face (centre 14,13.5; about 11 px wide). */
const FACE_TRANSFORM = 'translate(8.5 8) scale(0.46)';

/** `{ path }`: a stroked SVG path drawn in the pin face (24×24 icon scaled into the face), e.g. a map place's icon. */
export type PinGlyph = 'check' | 'dot' | 'alert' | 'home' | { text: string } | { path: string };

export interface PinLook {
  /** token for the body, e.g. `--ps-bad-pin` */
  fill: string;
  /** token for the outline and the glyph, e.g. `--ps-bad-fg` (dark enough to stand out on light map tiles) */
  edge: string;
  glyph?: PinGlyph;
  /** `branch`: a branch / office pin (class `is-branch`), not a customer */
  variant?: 'branch';
}

/** Pixel size of a pin; `lg` marks the selected customer. */
export function pinSize(large?: boolean): [number, number] {
  return large ? [36, 51] : [PIN_W, PIN_H];
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cssVar = (name: string) => `var(${name.replace(/[^a-z0-9-]/gi, '')})`;

function glyphSvg(g: PinGlyph | undefined): string {
  if (!g) return '';
  if (g === 'check') return `<path d="${CHECK_PATH}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (g === 'dot') return '<circle cx="14" cy="13.5" r="2.6" fill="currentColor"/>';
  if (g === 'home') return `<path d="${HOME_PATH}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (typeof g === 'object' && 'path' in g) return `<path transform="${FACE_TRANSFORM}" d="${esc(g.path)}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  const text = g === 'alert' ? '!' : g.text.slice(0, 3);
  const size = text.length > 2 ? 8 : text.length > 1 ? 9.5 : 11;
  return `<text x="14" y="13.5" dy="0.36em" text-anchor="middle" font-size="${size}" font-weight="700" fill="currentColor">${esc(text)}</text>`;
}

/** HTML for a Leaflet `divIcon` (inline style is allowed by the CSP: `style-src 'unsafe-inline'`). */
export function pinIconHtml(look: PinLook, large?: boolean): string {
  const [w, h] = pinSize(large);
  return (
    `<span class="fos-pin${large ? ' is-selected' : ''}${look.variant === 'branch' ? ' is-branch' : ''}" style="--pin-fill:${cssVar(look.fill)};--pin-edge:${cssVar(look.edge)}">` +
    `<svg width="${w}" height="${h}" viewBox="0 0 ${PIN_W} ${PIN_H}" aria-hidden="true" focusable="false">` +
    `<path class="fos-pin-body" d="${PIN_PATH}"/><circle class="fos-pin-face" cx="14" cy="13.5" r="7.4"/>` +
    `<g class="fos-pin-glyph">${glyphSvg(look.glyph)}</g></svg></span>`
  );
}

/** The same pin for legends, filters and badges. */
export function PinIcon({ look, size = 16, className }: { look: PinLook; size?: number; className?: string }) {
  const g = look.glyph;
  const text = g && typeof g === 'object' && 'text' in g ? g.text.slice(0, 3) : g === 'alert' ? '!' : null;
  const path = g && typeof g === 'object' && 'path' in g ? g.path : null;
  return (
    <svg
      width={(size * PIN_W) / PIN_H}
      height={size}
      viewBox={`0 0 ${PIN_W} ${PIN_H}`}
      aria-hidden
      focusable="false"
      className={className}
      style={{ ['--pin-fill' as string]: cssVar(look.fill), ['--pin-edge' as string]: cssVar(look.edge) }}
    >
      <path className="fos-pin-body" d={PIN_PATH} />
      <circle className="fos-pin-face" cx="14" cy="13.5" r="7.4" />
      <g className="fos-pin-glyph">
        {g === 'check' && <path d={CHECK_PATH} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />}
        {g === 'dot' && <circle cx="14" cy="13.5" r="2.6" fill="currentColor" />}
        {g === 'home' && <path d={HOME_PATH} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
        {path && <path transform={FACE_TRANSFORM} d={path} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />}
        {text && (
          <text x="14" y="13.5" dy="0.36em" textAnchor="middle" fontSize={text.length > 2 ? 8 : text.length > 1 ? 9.5 : 11} fontWeight={700} fill="currentColor">
            {text}
          </text>
        )}
      </g>
    </svg>
  );
}
