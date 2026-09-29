import { COS, SIN, Envelope, IsoBox, Patterns, Stamp, Wire, ink, iso, path, poly, svgText, type Pt } from "./iso";
import { BrandGlyph, type BrandId } from "./Brand";

/**
 * The hero: mail rides a belt into the JEV sorter tower. One row of sockets on the tower's right face
 * feeds five wires at the same height; far buckets ride the inner rails so no wire ever crosses another.
 * Every letter carries the mark of who sent it. The viewBox is computed from the geometry, so nothing clips.
 */
type BinSpec = { label: string; brands: BrandId[]; trash?: boolean; tag?: string };
const BINS: BinSpec[] = [
  { label: "Work", brands: ["slack", "notion", "figma"] },
  { label: "Receipts", brands: ["amazon", "doordash", "ubereats"] },
  { label: "Promos", brands: ["target", "starbucks", "nike", "adidas"] },
  { label: "Social", brands: ["linkedin", "instagram", "youtube"] },
  { label: "Trash", brands: ["github", "substack", "ticketmaster"], trash: true, tag: "30 days" },
];

const TOWER = 42;           // half footprint of the sorter
const TOWER_H = 124;
const HALF = 38;            // half footprint of a bucket
const BIN_H = 52;           // wall height
const RIM = 4;              // wall thickness
const STEP = 98;            // bucket spacing along -v (the row climbs up and to the right)
const RACK_U = 160;         // every bucket is centred on this u
const RACK_V0 = 52;         // nearest bucket, v
const PORT_Z = 108;         // the front socket's height; the row is level on screen, so sockets further back sit a little lower
const socketZ = (q: number) => PORT_Z - (30 - q) / 2; // keeps (TOWER + q) / 2 - z constant: a screen-horizontal row
const DROP_Z = BIN_H + 12;  // a drop ends here, just above the pile
const BELT_FAR = 122;       // where the belt starts
const railU = (j: number) => 178 - 12 * j; // far buckets take the inner rails, near buckets the outer ones

type Bin = BinSpec & { cu: number; cv: number; wire: string; length: number; port: Pt; railU: number };

function layout(): Bin[] {
  return BINS.map((bin, j) => {
    const cu = RACK_U;
    const cv = RACK_V0 - STEP * j;
    const q = 30 - 15 * j;   // socket position along the tower's right face, front to back
    const z = socketZ(q);
    const ru = railU(j);
    const pts: Pt[] = [iso(TOWER, q, z), iso(ru, q, z), iso(ru, cv, z), iso(ru, cv, DROP_Z)];
    const length = ru - TOWER + Math.abs(cv - q) + (z - DROP_Z);
    return { ...bin, cu, cv, wire: path(pts), length, port: pts[0], railU: ru };
  });
}

/** Everything that sticks out, so the viewBox can hug the drawing with a margin. */
function bounds(bins: Bin[]): { x: number; y: number; w: number; h: number } {
  const far = bins[bins.length - 1];
  const pts: Pt[] = [
    iso(-TOWER - 16, -TOWER - 16), iso(TOWER + 16, -TOWER - 16), iso(TOWER + 16, BELT_FAR + 46), iso(-TOWER - 16, BELT_FAR + 46),
    iso(RACK_U - HALF - 16, far.cv - HALF - 16), iso(RACK_U + HALF + 16, far.cv - HALF - 16), iso(RACK_U + HALF + 16, RACK_V0 + HALF + 16), iso(RACK_U - HALF - 16, RACK_V0 + HALF + 16),
    iso(-TOWER, -TOWER, TOWER_H), iso(TOWER, -TOWER, TOWER_H), iso(-TOWER, TOWER, TOWER_H),
    ...bins.map((b) => iso(b.railU, b.cv, PORT_Z + 16)),
    iso(TOWER, 30, PORT_Z + 16),
    ...bins.map((b) => iso(RACK_U + HALF, b.cv, 0)),
  ];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const pad = 14;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2 + 36, h: maxY - minY + pad * 2 };
}

/** Transform for drawing on a v = const face: local x runs along u, local y runs down (z decreasing). */
const faceLeft = (u: number, v: number, z: number) => {
  const [x, y] = iso(u, v, z);
  return `matrix(${COS} ${SIN} 0 1 ${x} ${y})`;
};

/** A standing letter inside a bucket: a vertical card in the u/z plane with a flap and the sender's mark as its seal. */
function StandingLetter({ u, v, z0, w, h, brand }: { u: number; v: number; z0: number; w: number; h: number; brand: BrandId }) {
  const pts: Pt[] = [iso(u, v, z0), iso(u + w, v, z0), iso(u + w, v, z0 + h), iso(u, v, z0 + h)];
  const flap = w * 0.5;
  const s = Math.min(16, Math.max(10, w * 0.34));
  return (
    <g>
      <polygon points={poly(pts)} style={{ fill: "var(--panel)", stroke: ink(82) }} strokeWidth={1.25} strokeLinejoin="round" />
      <path d={path([iso(u, v, z0 + h), iso(u + w / 2, v, z0 + h - flap), iso(u + w, v, z0 + h)])} style={{ fill: "none", stroke: ink(62) }} strokeWidth={1.1} strokeLinejoin="round" />
      <g transform={faceLeft(u + w / 2 - s / 2, v, z0 + h - flap + s / 2 + 1)}>
        <rect x={-2.5} y={-2.5} width={s + 5} height={s + 5} rx={2.5} style={{ fill: "var(--panel)", stroke: ink(35) }} strokeWidth={0.9} />
        <BrandGlyph id={brand} x={0} y={0} size={s} />
      </g>
    </g>
  );
}

/** Upright plates on the front-right face: the bucket's name, with an outlined note stacked under it when there is one. */
function Plate({ at, label, sub }: { at: Pt; label: string; sub?: string }) {
  const [x, y] = at;
  const w = Math.round(label.length * 8.3 + 20);
  const w2 = sub ? Math.round(sub.length * 6.8 + 16) : 0;
  const y0 = sub ? -22 : -10;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={y0} width={w} height={20} rx={1} style={{ fill: "var(--ink)", stroke: "var(--page)" }} strokeWidth={1.5} />
      <text x={0} y={y0 + 14.5} textAnchor="middle" style={{ ...svgText, fill: "var(--page)", fontSize: 12, letterSpacing: 1.4 }}>{label}</text>
      {sub ? (
        <g transform="translate(0 2)">
          <rect x={-w2 / 2} y={0} width={w2} height={19} rx={1} style={{ fill: "var(--page)", stroke: "var(--ink)" }} strokeWidth={1.5} />
          <text x={0} y={13.5} textAnchor="middle" style={{ ...svgText, fontSize: 10, letterSpacing: 1 }}>{sub}</text>
        </g>
      ) : null}
    </g>
  );
}

function Bucket({ b }: { b: Bin }) {
  const u0 = b.cu - HALF, u1 = b.cu + HALF, v0 = b.cv - HALF, v1 = b.cv + HALF;
  const top = BIN_H;
  const stroke = { strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" as const, strokeLinejoin: "round" as const };
  const wallFill = b.trash ? "url(#hero-hatch)" : ink(12, "var(--panel)");
  const wallFillR = b.trash ? "url(#hero-hatch)" : ink(24, "var(--panel)");
  const letters = b.brands.map((brand, k) => ({ brand, u: u0 + RIM + 5 + k * 10, v: v0 + RIM + 12 + k * 8, w: 2 * HALF - 2 * RIM - 14 - k * 10, h: top + 5 + (k % 2) * 4 - k }));
  return (
    <g>
      <polygon points={poly([iso(u0 + 6, v0 + 6), iso(u1 + 13, v0 + 6), iso(u1 + 13, v1 + 13), iso(u0 + 6, v1 + 13)])} style={{ fill: ink(12) }} />
      <polygon points={poly([iso(u0 + RIM, v0 + RIM, 4), iso(u1 - RIM, v0 + RIM, 4), iso(u1 - RIM, v1 - RIM, 4), iso(u0 + RIM, v1 - RIM, 4)])} style={{ fill: ink(82, "var(--panel)") }} />
      <polygon points={poly([iso(u0 + RIM, v0 + RIM, top), iso(u1 - RIM, v0 + RIM, top), iso(u1 - RIM, v0 + RIM, 4), iso(u0 + RIM, v0 + RIM, 4)])} style={{ fill: ink(66, "var(--panel)") }} />
      <polygon points={poly([iso(u0 + RIM, v0 + RIM, top), iso(u0 + RIM, v1 - RIM, top), iso(u0 + RIM, v1 - RIM, 4), iso(u0 + RIM, v0 + RIM, 4)])} style={{ fill: ink(52, "var(--panel)") }} />
      {letters.map((l) => <StandingLetter key={l.brand} u={l.u} v={l.v} z0={6} w={l.w} h={l.h} brand={l.brand} />)}
      <polygon points={poly([iso(u0, v1, top), iso(u1, v1, top), iso(u1, v1, 0), iso(u0, v1, 0)])} style={{ fill: wallFill, stroke: ink(85) }} {...stroke} />
      <polygon points={poly([iso(u1, v0, top), iso(u1, v1, top), iso(u1, v1, 0), iso(u1, v0, 0)])} style={{ fill: wallFillR, stroke: ink(85) }} {...stroke} />
      <path
        d={`${path([iso(u0, v0, top), iso(u1, v0, top), iso(u1, v1, top), iso(u0, v1, top)])} Z ${path([iso(u0 + RIM, v0 + RIM, top), iso(u1 - RIM, v0 + RIM, top), iso(u1 - RIM, v1 - RIM, top), iso(u0 + RIM, v1 - RIM, top)])} Z`}
        fillRule="evenodd" style={{ fill: "var(--panel)", stroke: ink(85) }} {...stroke}
      />
      <Plate at={iso(u1, b.cv, top / 2 + 2)} label={b.label} sub={b.tag} />
    </g>
  );
}

/** A letter riding a wire or the belt, carrying its sender's mark. */
function FlyingLetter({ d, begin, dur, brand }: { d: string; begin: string; dur: string; brand: BrandId }) {
  return (
    <g className="travel">
      <g transform="translate(-14 -9.5)">
        <rect width={28} height={19} rx={1.5} style={{ fill: "var(--panel)", stroke: "var(--ink)" }} strokeWidth={1.5} />
        <path d="M0.8 1.3 L14 8 L27.2 1.3" style={{ fill: "none", stroke: "var(--ink)" }} strokeWidth={1.2} />
        <BrandGlyph id={brand} x={9.5} y={8.6} size={9} />
      </g>
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={d} rotate="0" />
    </g>
  );
}

/** A socket on the tower face where a wire starts. */
function Socket({ at }: { at: Pt }) {
  return (
    <g>
      <circle cx={at[0]} cy={at[1]} r={4.4} style={{ fill: "var(--page)", stroke: ink(70) }} strokeWidth={1} />
      <circle cx={at[0]} cy={at[1]} r={1.7} style={{ fill: "var(--ink)" }} />
    </g>
  );
}

/** A flat slab the machines stand on. */
function Slab({ u0, v0, u1, v1 }: { u0: number; v0: number; u1: number; v1: number }) {
  return <polygon points={poly([iso(u0, v0), iso(u1, v0), iso(u1, v1), iso(u0, v1)])} style={{ fill: ink(5), stroke: ink(32) }} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
}

export function HeroScene() {
  const bins = layout();
  const box = bounds(bins);
  const beltPath = path([iso(0, BELT_FAR - 6, 9), iso(0, TOWER + 2, 9)]);
  const stack: { du: number; dv: number; brand: BrandId }[] = [
    { du: 0, dv: 0, brand: "chase" }, { du: 2, dv: -1, brand: "uber" }, { du: -1, dv: 1, brand: "spotify" }, { du: 1, dv: 0, brand: "linkedin" },
  ];
  const beltMail: { brand: BrandId; begin: string }[] = [{ brand: "amazon", begin: "0s" }, { brand: "chase", begin: "1.5s" }, { brand: "linkedin", begin: "3s" }];
  const seam = "color-mix(in srgb, var(--page) 24%, transparent)";
  const far = bins[bins.length - 1];
  return (
    <svg viewBox={`${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.w.toFixed(1)} ${box.h.toFixed(1)}`} className="relative block h-auto w-full overflow-visible" role="img" aria-label="Isometric mailroom: letters stamped with sender logos ride a belt into the JEV sorter tower and travel along five wires into open buckets labeled Work, Receipts, Promos, Social, and Trash">
      <Patterns prefix="hero" />
      {/* the floor */}
      <Slab u0={-TOWER - 16} v0={-TOWER - 16} u1={TOWER + 16} v1={BELT_FAR + 46} />
      <Slab u0={RACK_U - HALF - 16} v0={far.cv - HALF - 16} u1={RACK_U + HALF + 16} v1={RACK_V0 + HALF + 16} />

      {/* the sorter tower */}
      <IsoBox u0={-TOWER} v0={-TOWER} u1={TOWER} v1={TOWER} h={TOWER_H} tone="dark" shadow weight={1.5}>
        <polygon points={poly([iso(-16, TOWER, 14), iso(16, TOWER, 14), iso(16, TOWER, 0), iso(-16, TOWER, 0)])} style={{ fill: "var(--page)", stroke: ink(70) }} strokeWidth={1} />
        <path d={path([iso(-TOWER, TOWER, 66), iso(TOWER, TOWER, 66), iso(TOWER, -TOWER, 66)])} style={{ fill: "none", stroke: seam }} strokeWidth={1} />
        <path d={path([iso(TOWER, -TOWER, socketZ(-TOWER)), iso(TOWER, TOWER, socketZ(TOWER))])} style={{ fill: "none", stroke: seam }} strokeWidth={1} />
        {[14, 22, 30].map((z) => <path key={z} d={path([iso(TOWER, 6, z), iso(TOWER, 36, z)])} style={{ fill: "none", stroke: seam }} strokeWidth={1.2} />)}
        <Stamp u={0} v={0} z={TOWER_H} />
      </IsoBox>

      {/* intake belt and the waiting stack */}
      <IsoBox u0={-18} v0={TOWER + 2} u1={18} v1={BELT_FAR} h={8} shadow weight={1.25}>
        {[54, 64, 74, 84, 94, 104, 114].map((v) => <path key={v} d={path([iso(-18, v, 8), iso(18, v, 8)])} style={{ fill: "none", stroke: ink(22) }} strokeWidth={1} />)}
      </IsoBox>
      <Wire d={beltPath} />
      {stack.map(({ du, dv, brand }, i) => (
        <Envelope key={brand} u={-15 + du} v={BELT_FAR + 12 + dv} z={i * 3.5} weight={1.25} mark={i === stack.length - 1 ? <BrandGlyph id={brand} x={11.5} y={7} size={7} /> : undefined} />
      ))}
      {beltMail.map((m) => <FlyingLetter key={m.brand} d={beltPath} brand={m.brand} begin={m.begin} dur="4.5s" />)}

      {/* the buckets, far to near */}
      {[...bins].reverse().map((b) => <Bucket key={b.label} b={b} />)}

      {/* wires, above everything they cross, starting at the socket row */}
      <g>{bins.map((b) => <Wire key={b.label} d={b.wire} />)}</g>
      {bins.map((b) => <Socket key={b.label} at={b.port} />)}

      {/* letters in flight */}
      {bins.map((b, j) => <FlyingLetter key={b.label} d={b.wire} brand={b.brands[0]} begin={`${j * 0.7}s`} dur={`${(1.4 + b.length / 105).toFixed(2)}s`} />)}
    </svg>
  );
}
