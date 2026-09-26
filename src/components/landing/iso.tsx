import type { CSSProperties, ReactNode } from "react";

/**
 * Isometric helpers shared by the landing diagrams. Points live in a (u, v, z) space:
 * u runs down-right on screen, v runs down-left, z rises. Every fill is a color-mix of theme tokens,
 * so the art follows the light and dark palettes without a second set of colors.
 */
export const COS = 0.866;
export const SIN = 0.5;
export type Pt = readonly [number, number];

export function iso(u: number, v: number, z = 0): Pt {
  return [(u - v) * COS, (u + v) * SIN - z];
}
const r = (n: number) => Math.round(n * 10) / 10;
export const poly = (points: readonly Pt[]) => points.map(([x, y]) => `${r(x)},${r(y)}`).join(" ");
export const path = (points: readonly Pt[]) => points.map(([x, y], i) => `${i ? "L" : "M"}${r(x)} ${r(y)}`).join(" ");
/** A transform that maps local x along u and local y along v onto the horizontal plane at height z, anchored at (u, v). */
export function plane(u: number, v: number, z: number): string {
  const [x, y] = iso(u, v, z);
  return `matrix(${COS} ${SIN} ${-COS} ${SIN} ${r(x)} ${r(y)})`;
}

const mix = (a: string, pct: number, b = "transparent") => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
export const ink = (pct: number, base = "transparent") => mix("var(--ink)", pct, base);
export const accent = (pct: number, base = "transparent") => mix("var(--accent)", pct, base);

type Faces = { top: CSSProperties; left: CSSProperties; right: CSSProperties };
export const tones: Record<"plain" | "accent" | "dark", Faces> = {
  plain: {
    top: { fill: mix("var(--panel)", 94, "var(--page)"), stroke: ink(34) },
    left: { fill: ink(9, "var(--panel)"), stroke: ink(26) },
    right: { fill: ink(15, "var(--panel)"), stroke: ink(28) },
  },
  accent: {
    top: { fill: mix("var(--accent-soft)", 72, "var(--panel)"), stroke: accent(55) },
    left: { fill: accent(22, "var(--accent-soft)"), stroke: accent(45) },
    right: { fill: accent(36, "var(--accent-soft)"), stroke: accent(50) },
  },
  dark: {
    top: { fill: ink(84, "var(--panel)"), stroke: ink(100) },
    left: { fill: ink(92, "var(--panel)"), stroke: ink(100) },
    right: { fill: ink(97, "var(--panel)"), stroke: ink(100) },
  },
};
export const shadowStyle: CSSProperties = { fill: ink(7) };
const portStyle: CSSProperties = { fill: "var(--accent)", stroke: mix("var(--panel)", 70) };
const hexStyle: CSSProperties = { fill: mix("var(--page)", 86), stroke: ink(36) };
const hexFilledStyle: CSSProperties = { fill: mix("var(--accent-soft)", 68, "var(--page)"), stroke: accent(60) };
/** Uppercase, letter-spaced, monospace: the voice of every label drawn inside a diagram. */
export const svgText: CSSProperties = { fill: "var(--ink)", fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" };

/** Monochrome fills for emphasis: diagonal hatching and a dot screen. Give each SVG its own prefix. */
export function Patterns({ prefix }: { prefix: string }) {
  return (
    <defs>
      <pattern id={`${prefix}-hatch`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={6} style={{ stroke: ink(60) }} strokeWidth={1.2} />
      </pattern>
      <pattern id={`${prefix}-dots`} width={5} height={5} patternUnits="userSpaceOnUse">
        <circle cx={1.2} cy={1.2} r={0.9} style={{ fill: ink(60) }} />
      </pattern>
    </defs>
  );
}

type BoxProps = {
  u0: number; v0: number; u1: number; v1: number;
  z?: number; h: number;
  tone?: keyof typeof tones;
  shadow?: boolean;
  children?: ReactNode;
};

/** A box drawn as its three visible faces: left (+v), right (+u), and top. Children paint on top of it. */
export function IsoBox({ u0, v0, u1, v1, z = 0, h, tone = "plain", shadow = false, children }: BoxProps) {
  const t = tones[tone];
  const top = z + h;
  const stroke = { strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const, strokeLinejoin: "round" as const };
  return (
    <g>
      {shadow ? <polygon points={poly([iso(u0 + 5, v0 + 5), iso(u1 + 11, v0 + 5), iso(u1 + 11, v1 + 11), iso(u0 + 5, v1 + 11)])} style={shadowStyle} /> : null}
      <polygon points={poly([iso(u0, v1, top), iso(u1, v1, top), iso(u1, v1, z), iso(u0, v1, z)])} style={t.left} {...stroke} />
      <polygon points={poly([iso(u1, v0, top), iso(u1, v1, top), iso(u1, v1, z), iso(u1, v0, z)])} style={t.right} {...stroke} />
      <polygon points={poly([iso(u0, v0, top), iso(u1, v0, top), iso(u1, v1, top), iso(u0, v1, top)])} style={t.top} {...stroke} />
      {children}
    </g>
  );
}

/** A small accent hexagon marking where a wire meets a face. */
export function Port({ at, s = 5 }: { at: Pt; s?: number }) {
  const [x, y] = at;
  const pts: Pt[] = [[x, y - 1.2 * s], [x + s, y - 0.6 * s], [x + s, y + 0.6 * s], [x, y + 1.2 * s], [x - s, y + 0.6 * s], [x - s, y - 0.6 * s]];
  return <polygon points={poly(pts)} style={portStyle} strokeWidth={1} />;
}

/** A floating packet: outlined, or filled when it carries something. */
export function Hex({ at, s = 9, filled = false }: { at: Pt; s?: number; filled?: boolean }) {
  const [x, y] = at;
  const w = s * 0.87;
  const pts: Pt[] = [[x, y - s], [x + w, y - s / 2], [x + w, y + s / 2], [x, y + s], [x - w, y + s / 2], [x - w, y - s / 2]];
  return <polygon points={poly(pts)} style={filled ? hexFilledStyle : hexStyle} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
}

/** A static wire with an animated signal riding along it, in the direction the path is drawn. */
export function Wire({ d, signal = true }: { d: string; signal?: boolean }) {
  return (
    <>
      <path className="wire-halo" d={d} />
      <path className="wire" d={d} />
      {signal ? <path className="signal" d={d} /> : null}
    </>
  );
}

/** A flat envelope lying on the plane at height z, with its flap drawn on the top face. */
export function Envelope({ u, v, z = 0, w = 30, d = 20 }: { u: number; v: number; z?: number; w?: number; d?: number }) {
  return (
    <IsoBox u0={u} v0={v} u1={u + w} v1={v + d} z={z} h={3}>
      <g transform={plane(u, v, z + 3)}>
        <path d={`M0.5 0.5 L${w / 2} ${d * 0.58} L${w - 0.5} 0.5`} style={{ fill: "none", stroke: ink(48) }} strokeWidth={1.1} strokeLinejoin="round" />
      </g>
    </IsoBox>
  );
}

/** The JEV stamp: a perforated tape on a top face, centered at (u, v). */
export function Stamp({ u, v, z, size = 1 }: { u: number; v: number; z: number; size?: number }) {
  const w = 60 * size;
  const h = 44 * size;
  return (
    <g transform={plane(u, v, z)}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={5 * size} style={{ fill: "var(--accent-soft)", stroke: accent(75) }} strokeWidth={1.2} strokeDasharray={`${2.6 * size} ${2.6 * size}`} />
      <text x={0} y={1.5 * size} textAnchor="middle" dominantBaseline="middle" style={{ ...svgText, fontSize: 20 * size, letterSpacing: 2 * size }}>JEV</text>
      <text x={0} y={16.5 * size} textAnchor="middle" style={{ ...svgText, fontSize: 6.5 * size, letterSpacing: 1.8 * size }}>SORTER</text>
    </g>
  );
}
