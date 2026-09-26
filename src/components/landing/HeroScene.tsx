import { Envelope, Hex, IsoBox, Patterns, Port, Stamp, Wire, ink, iso, path, poly, svgText, type Pt } from "./iso";

/**
 * The hero: mail rides a belt into the JEV sorter tower. Five wires leave the tower's right face at
 * staggered heights, run above the rack, and each one drops into its own open bucket.
 * The buckets are the point of the picture, so they are big, open-topped, tagged, and full.
 */
type BinSpec = { label: string; fill: number; trash?: boolean; tag?: string };
const BINS: BinSpec[] = [
  { label: "Work", fill: 3 },
  { label: "Receipts", fill: 2 },
  { label: "Promos", fill: 4 },
  { label: "Social", fill: 2 },
  { label: "Trash", fill: 3, trash: true, tag: "30 days" },
];

const TOWER = 42;           // half footprint of the sorter
const TOWER_H = 124;
const HALF = 37;            // half footprint of a bucket
const BIN_H = 50;           // wall height
const RIM = 4;              // wall thickness
const STEP = 98;            // bucket spacing along -v (the row climbs up and to the right)
const RACK_U = 160;         // every bucket is centred on this u
const RACK_V0 = 52;         // nearest bucket, v
const RAIL_U = 148;         // wires run above this u and drop from it
const DROP_Z = BIN_H + 12;  // a drop ends here, just above the pile
const ORIGIN: Pt = [144, 262];

type Bin = BinSpec & { cu: number; cv: number; wire: string; length: number; port: Pt };

function layout(): Bin[] {
  return BINS.map((bin, j) => {
    const cu = RACK_U;
    const cv = RACK_V0 - STEP * j;
    const q = 26 - 13 * j;   // port along the tower's right face, front to back
    const z = 82 + 9 * j;    // rail height: the farther the bucket, the higher the rail
    const pts: Pt[] = [iso(TOWER, q, z), iso(RAIL_U, q, z), iso(RAIL_U, cv, z), iso(RAIL_U, cv, DROP_Z)];
    const length = RAIL_U - TOWER + Math.abs(cv - q) + (z - DROP_Z);
    return { ...bin, cu, cv, wire: path(pts), length, port: pts[0] };
  });
}

/** A standing letter inside a bucket: a vertical card in the u/z plane with a flap, poking above the rim. */
function StandingLetter({ u, v, z0, w, h }: { u: number; v: number; z0: number; w: number; h: number }) {
  const pts: Pt[] = [iso(u, v, z0), iso(u + w, v, z0), iso(u + w, v, z0 + h), iso(u, v, z0 + h)];
  return (
    <g>
      <polygon points={poly(pts)} style={{ fill: "var(--panel)", stroke: ink(70) }} strokeWidth={1} strokeLinejoin="round" />
      <path d={path([iso(u, v, z0 + h), iso(u + w / 2, v, z0 + h - w * 0.55), iso(u + w, v, z0 + h)])} style={{ fill: "none", stroke: ink(55) }} strokeWidth={1} strokeLinejoin="round" />
    </g>
  );
}

/** Upright plates on the front-right face: the bucket's name, with an outlined note stacked under it when there is one. */
function Plate({ at, label, sub }: { at: Pt; label: string; sub?: string }) {
  const [x, y] = at;
  const w = Math.round(label.length * 7.7 + 18);
  const w2 = sub ? Math.round(sub.length * 6.6 + 14) : 0;
  const y0 = sub ? -20 : -9;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={y0} width={w} height={18} style={{ fill: "var(--ink)", stroke: "var(--page)" }} strokeWidth={1.2} />
      <text x={0} y={y0 + 13} textAnchor="middle" style={{ ...svgText, fill: "var(--page)", fontSize: 11 }}>{label}</text>
      {sub ? (
        <g transform="translate(0 2)">
          <rect x={-w2 / 2} y={0} width={w2} height={18} style={{ fill: "var(--page)", stroke: "var(--ink)" }} strokeWidth={1.2} />
          <text x={0} y={13} textAnchor="middle" style={{ ...svgText, fontSize: 9.5, letterSpacing: 1 }}>{sub}</text>
        </g>
      ) : null}
    </g>
  );
}

function Bucket({ b }: { b: Bin }) {
  const u0 = b.cu - HALF, u1 = b.cu + HALF, v0 = b.cv - HALF, v1 = b.cv + HALF;
  const top = BIN_H;
  const stroke = { strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const, strokeLinejoin: "round" as const };
  const wallFill = b.trash ? "url(#hero-hatch)" : ink(9, "var(--panel)");
  const wallFillR = b.trash ? "url(#hero-hatch)" : ink(16, "var(--panel)");
  const letters = Array.from({ length: b.fill }, (_, k) => ({ u: u0 + RIM + 5 + k * 10, v: v0 + RIM + 12 + k * 8, h: top + 4 + (k % 2) * 4 - k }));
  return (
    <g>
      {/* shadow */}
      <polygon points={poly([iso(u0 + 6, v0 + 6), iso(u1 + 12, v0 + 6), iso(u1 + 12, v1 + 12), iso(u0 + 6, v1 + 12)])} style={{ fill: ink(7) }} />
      {/* interior: floor and the two far inner walls */}
      <polygon points={poly([iso(u0 + RIM, v0 + RIM, 4), iso(u1 - RIM, v0 + RIM, 4), iso(u1 - RIM, v1 - RIM, 4), iso(u0 + RIM, v1 - RIM, 4)])} style={{ fill: ink(78, "var(--panel)") }} />
      <polygon points={poly([iso(u0 + RIM, v0 + RIM, top), iso(u1 - RIM, v0 + RIM, top), iso(u1 - RIM, v0 + RIM, 4), iso(u0 + RIM, v0 + RIM, 4)])} style={{ fill: ink(62, "var(--panel)") }} />
      <polygon points={poly([iso(u0 + RIM, v0 + RIM, top), iso(u0 + RIM, v1 - RIM, top), iso(u0 + RIM, v1 - RIM, 4), iso(u0 + RIM, v0 + RIM, 4)])} style={{ fill: ink(48, "var(--panel)") }} />
      {/* letters standing inside */}
      {letters.map((l, k) => <StandingLetter key={k} u={l.u} v={l.v} z0={6} w={2 * HALF - 2 * RIM - 14 - k * 10} h={l.h} />)}
      {/* outer front faces */}
      <polygon points={poly([iso(u0, v1, top), iso(u1, v1, top), iso(u1, v1, 0), iso(u0, v1, 0)])} style={{ fill: wallFill, stroke: ink(60) }} {...stroke} />
      <polygon points={poly([iso(u1, v0, top), iso(u1, v1, top), iso(u1, v1, 0), iso(u1, v0, 0)])} style={{ fill: wallFillR, stroke: ink(60) }} {...stroke} />
      {/* rim: outer top minus inner opening */}
      <path
        d={`${path([iso(u0, v0, top), iso(u1, v0, top), iso(u1, v1, top), iso(u0, v1, top)])} Z ${path([iso(u0 + RIM, v0 + RIM, top), iso(u1 - RIM, v0 + RIM, top), iso(u1 - RIM, v1 - RIM, top), iso(u0 + RIM, v1 - RIM, top)])} Z`}
        fillRule="evenodd" style={{ fill: "var(--panel)", stroke: ink(70) }} {...stroke}
      />
      <Plate at={iso(u1, b.cv, top / 2 + 2)} label={b.label} sub={b.tag} />
    </g>
  );
}

/** A letter riding a wire: animateMotion along the same path the signal uses. */
function FlyingLetter({ d, begin, dur }: { d: string; begin: string; dur: string }) {
  return (
    <g className="travel">
      <g transform="translate(-6 -4)">
        <rect width={12} height={8} rx={1} style={{ fill: "var(--panel)", stroke: "var(--ink)" }} strokeWidth={1} />
        <path d="M0.5 0.8 L6 4.4 L11.5 0.8" style={{ fill: "none", stroke: "var(--ink)" }} strokeWidth={1} />
      </g>
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={d} rotate="0" />
    </g>
  );
}

export function HeroScene() {
  const bins = layout();
  const beltWire = path([iso(0, 116, 9), iso(0, TOWER + 4, 9)]);
  const stack = [{ du: 0, dv: 0 }, { du: 2, dv: -1 }, { du: -1, dv: 1 }, { du: 1, dv: 0 }];
  const seam = "color-mix(in srgb, var(--page) 22%, transparent)";
  return (
    <svg viewBox="0 30 660 392" className="relative block h-auto w-full" role="img" aria-label="Isometric mailroom: letters ride a belt into the JEV sorter tower and travel along five overhead wires into open buckets labeled Work, Receipts, Promos, Social, and Trash">
      <Patterns prefix="hero" />
      <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]})`}>
        {/* judgment packets in the air above the tower */}
        <g>
          <Hex at={[-62, -182]} />
          <Hex at={[-46, -191]} filled />
          <Hex at={[-62, -200]} />
        </g>

        {/* the sorter tower */}
        <IsoBox u0={-TOWER} v0={-TOWER} u1={TOWER} v1={TOWER} h={TOWER_H} tone="dark" shadow>
          <polygon points={poly([iso(-16, TOWER, 14), iso(16, TOWER, 14), iso(16, TOWER, 0), iso(-16, TOWER, 0)])} style={{ fill: "var(--page)", stroke: ink(70) }} strokeWidth={1} />
          <path d={path([iso(-TOWER, TOWER, 66), iso(TOWER, TOWER, 66), iso(TOWER, -TOWER, 66)])} style={{ fill: "none", stroke: seam }} strokeWidth={1} />
          <Stamp u={0} v={0} z={TOWER_H} />
        </IsoBox>
        {bins.map((b) => <Port key={b.label} at={b.port} s={4} />)}

        {/* intake belt and the waiting stack */}
        <IsoBox u0={-18} v0={TOWER + 2} u1={18} v1={118} h={8} shadow>
          {[54, 64, 74, 84, 94, 104, 114].map((v) => <path key={v} d={path([iso(-18, v, 8), iso(18, v, 8)])} style={{ fill: "none", stroke: ink(18) }} strokeWidth={1} />)}
        </IsoBox>
        <Wire d={beltWire} />
        <Envelope u={-15} v={72} z={8} />
        {stack.map(({ du, dv }, i) => <Envelope key={i} u={-15 + du} v={130 + dv} z={i * 3.5} />)}

        {/* the buckets, far to near */}
        {[...bins].reverse().map((b) => <Bucket key={b.label} b={b} />)}

        {/* overhead wires, above everything they cross */}
        <g>{bins.map((b) => <Wire key={b.label} d={b.wire} />)}</g>

        {/* letters in flight */}
        {bins.map((b, j) => <FlyingLetter key={b.label} d={b.wire} begin={`${j * 0.7}s`} dur={`${(1.4 + b.length / 105).toFixed(2)}s`} />)}
      </g>
    </svg>
  );
}
