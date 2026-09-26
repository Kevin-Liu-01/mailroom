import { COS, SIN, Envelope, Hex, IsoBox, Patterns, Port, Stamp, Wire, ink, iso, path, poly, svgText, type Pt } from "./iso";

/**
 * The hero: mail rides a belt into the JEV sorter; wires carry it to five open buckets.
 * The buckets are the point of the picture, so they are big, open-topped, stenciled, and full.
 */
type BinSpec = { label: string; fill: number; trash?: boolean; tag?: string };
const BINS: BinSpec[] = [
  { label: "Work", fill: 3 },
  { label: "Receipts", fill: 2 },
  { label: "Promos", fill: 4 },
  { label: "Social", fill: 2 },
  { label: "Trash", fill: 3, trash: true, tag: "30 days" },
];

const SORTER = 52;
const HALF = 34;          // half footprint of a bucket
const BIN_H = 58;         // wall height
const RIM = 4;            // wall thickness
const STEP = 78;          // spacing along the rack's axis (-v: the row climbs up and to the right)
const RACK_U = 160;       // every bucket sits at this u
const RACK_V0 = 52;       // nearest bucket, v
const ORIGIN: Pt = [150, 252];

type Bin = BinSpec & { cu: number; cv: number; wire: string; sorterPort: Pt; mouth: Pt };

function layout(): Bin[] {
  return BINS.map((bin, j) => {
    const cu = RACK_U;
    const cv = RACK_V0 - STEP * j;
    // Wires leave the sorter's right face at staggered spots, run along the ground toward the rack,
    // turn to the bucket's row, then climb into its open mouth.
    const q = 34 - 16 * j;
    const h = 12 + 7 * j;
    const sorterPort = iso(SORTER, q, h);
    const turnU = RACK_U - HALF - 14 - 5 * j;
    const mouth = iso(cu, cv, BIN_H + 22);
    const wire = path([sorterPort, iso(SORTER + 12, q, h), iso(SORTER + 12, q, 0), iso(turnU, q, 0), iso(turnU, cv, 0), iso(cu - HALF + 6, cv, BIN_H + 22), mouth]);
    return { ...bin, cu, cv, wire, sorterPort, mouth };
  });
}

/** Transform for drawing on the bucket's front-left face (the v = v1 plane): x runs along u, y runs down. */
const faceLeft = (u: number, v1: number, z: number) => {
  const [x, y] = iso(u, v1, z);
  return `matrix(${COS} ${SIN} 0 1 ${x} ${y})`;
};

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

function Bucket({ b }: { b: Bin }) {
  const u0 = b.cu - HALF, u1 = b.cu + HALF, v0 = b.cv - HALF, v1 = b.cv + HALF;
  const top = BIN_H;
  const stroke = { strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const, strokeLinejoin: "round" as const };
  const wallFill = b.trash ? "url(#hero-hatch)" : ink(9, "var(--panel)");
  const wallFillR = b.trash ? "url(#hero-hatch)" : ink(16, "var(--panel)");
  const letters = Array.from({ length: b.fill }, (_, k) => ({ u: u0 + RIM + 5 + k * 10, v: v0 + RIM + 12 + k * 8, h: top + 8 + (k % 2) * 9 - k * 2 }));
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
      {/* stencil on the front-left face */}
      <g transform={faceLeft(u0 + 5, v1, top - 10)}>
        {b.trash ? <rect x={-1} y={-11} width={2 * HALF - 8} height={15} style={{ fill: "var(--page)" }} /> : null}
        <text x={0} y={0} style={{ ...svgText, fontSize: 13, letterSpacing: 2 }}>{b.label}</text>
        {b.tag ? (
          <g transform="translate(0 6)">
            <rect x={-1} y={0} width={2 * HALF - 8} height={12} style={{ fill: "var(--ink)" }} />
            <text x={(2 * HALF - 10) / 2} y={9} textAnchor="middle" style={{ ...svgText, fill: "var(--page)", fontSize: 7.5, letterSpacing: 1.4 }}>{b.tag}</text>
          </g>
        ) : null}
      </g>
      {/* a small hex port where the wire meets the mouth */}
      <Port at={b.mouth} s={3.5} />
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
  const beltWire = path([iso(0, 128, 9), iso(0, 58, 9)]);
  const stack = [{ du: 0, dv: 0 }, { du: 2, dv: -1 }, { du: -1, dv: 1 }, { du: 1, dv: 0 }];
  return (
    <svg viewBox="0 40 600 360" className="relative block h-auto w-full" role="img" aria-label="Isometric mailroom: letters ride a belt into the JEV sorter and fly along wires into open buckets stenciled Work, Receipts, Promos, Social, and Trash">
      <Patterns prefix="hero" />
      <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]})`}>
        {/* judgment packets in the air */}
        <g>
          <Hex at={[-4, -150]} />
          <Hex at={[12, -159]} filled />
          <Hex at={[-4, -168]} />
        </g>

        {/* ground wires under everything */}
        <g>{bins.map((b) => <Wire key={b.label} d={b.wire} />)}</g>

        {/* the sorter */}
        <IsoBox u0={-SORTER} v0={-SORTER} u1={SORTER} v1={SORTER} h={70} tone="dark" shadow>
          <polygon points={poly([iso(-16, SORTER, 13), iso(16, SORTER, 13), iso(16, SORTER, 0), iso(-16, SORTER, 0)])} style={{ fill: "var(--page)", stroke: ink(70) }} strokeWidth={1} />
          <ellipse cx={iso(SORTER, -40, 56)[0]} cy={iso(SORTER, -40, 56)[1]} rx={4} ry={2.3} style={{ fill: "var(--page)" }} />
          <ellipse cx={iso(SORTER, -29, 56)[0]} cy={iso(SORTER, -29, 56)[1]} rx={4} ry={2.3} style={{ fill: ink(55, "var(--panel)") }} />
          <ellipse cx={iso(SORTER, -18, 56)[0]} cy={iso(SORTER, -18, 56)[1]} rx={4} ry={2.3} style={{ fill: ink(35, "var(--panel)") }} />
          <Stamp u={0} v={0} z={70} />
        </IsoBox>
        {bins.map((b) => <Port key={b.label} at={b.sorterPort} s={3.5} />)}

        {/* intake belt and the waiting stack */}
        <IsoBox u0={-18} v0={56} u1={18} v1={130} h={8} shadow>
          {[64, 74, 94, 104, 114, 124].map((v) => <path key={v} d={path([iso(-18, v, 8), iso(18, v, 8)])} style={{ fill: "none", stroke: ink(18) }} strokeWidth={1} />)}
        </IsoBox>
        <Wire d={beltWire} />
        <Envelope u={-15} v={82} z={8} />
        {stack.map(({ du, dv }, i) => <Envelope key={i} u={-15 + du} v={142 + dv} z={i * 3.5} />)}

        {/* the buckets, far to near */}
        {[...bins].reverse().map((b) => <Bucket key={b.label} b={b} />)}

        {/* letters in flight */}
        {bins.map((b, j) => <FlyingLetter key={b.label} d={b.wire} begin={`${j * 0.9}s`} dur="5.2s" />)}
      </g>
    </svg>
  );
}
