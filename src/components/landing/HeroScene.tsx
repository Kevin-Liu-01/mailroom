import { COS, SIN, Envelope, Hex, IsoBox, Patterns, Port, Stamp, Wire, accent, ink, iso, path, poly, svgText, type Pt } from "./iso";

const BINS = [
  { label: "Work" },
  { label: "Receipts" },
  { label: "Promos" },
  { label: "Social" },
  { label: "Trash", tag: "30 days" },
] as const;

// The bin rack recedes along (1, 1), so the five boxes stack down the screen.
const UC = 84;
const VC = -200;
const STEP = 31;
const HALF = 20;
const BIN_H = 34;
const SORTER = 56;
// Wires leave the sorter's right face, run under the rack, climb on its right, and enter each bin at its top corner.
const TURN = 290;
const CLIMB_X = 332;
const ORIGIN: Pt = [169, 190];

type BinGeom = { j: number; label: string; tag?: string; cu: number; cv: number; wire: string; sorterPort: Pt; binPort: Pt; entry: string };

function layout(): BinGeom[] {
  return BINS.map((bin, j) => {
    const cu = UC + STEP * j;
    const cv = VC + STEP * j;
    const q = 30 - 15 * j;
    const climbX = CLIMB_X - 10 * j;
    const U = TURN - 8 * j;
    const w = U - climbX / COS;
    const binPort = iso(cu + HALF, cv - HALF, BIN_H);
    const L = (climbX - binPort[0]) / COS;
    const top: Pt = [climbX, binPort[1] + L * SIN];
    const sorterPort = iso(SORTER, q, 20);
    return {
      j, label: bin.label, tag: "tag" in bin ? bin.tag : undefined, cu, cv, sorterPort, binPort,
      wire: path([sorterPort, iso(SORTER + 10, q, 20), iso(SORTER + 10, q, 0), iso(U, q, 0), iso(U, w, 0), top]),
      entry: path([top, binPort]),
    };
  });
}

function Bin({ b }: { b: BinGeom }) {
  const { cu, cv } = b;
  const labelY = (cu + cv) * SIN - 17 + 5;
  const labelX = iso(cu - HALF, cv + HALF)[0] - 9;
  return (
    <g>
      <IsoBox u0={cu - HALF} v0={cv - HALF} u1={cu + HALF} v1={cv + HALF} h={BIN_H} shadow>
        <polygon
          points={poly([iso(cu - HALF + 5, cv - HALF + 5, BIN_H), iso(cu + HALF - 5, cv - HALF + 5, BIN_H), iso(cu + HALF - 5, cv + HALF - 5, BIN_H), iso(cu - HALF + 5, cv + HALF - 5, BIN_H)])}
          style={{ fill: b.tag ? "url(#hero-dots)" : "url(#hero-hatch)", stroke: ink(50) }}
          strokeWidth={1}
        />
      </IsoBox>
      <text x={labelX} y={labelY} textAnchor="end" style={{ ...svgText, fontSize: 11.5 }}>{b.label}</text>
      {b.tag ? (
        <g>
          <rect x={labelX - 58} y={labelY + 6} width={58} height={16} rx={2} style={{ fill: "var(--ink)", stroke: "var(--ink)" }} strokeWidth={1} />
          <text x={labelX - 29} y={labelY + 17.5} textAnchor="middle" style={{ ...svgText, fill: "var(--page)", fontSize: 8.5, letterSpacing: 1 }}>{b.tag}</text>
        </g>
      ) : null}
    </g>
  );
}

export function HeroScene() {
  const bins = layout();
  const beltWire = path([iso(0, 128, 9), iso(0, 58, 9)]);
  const stack = [
    { du: 0, dv: 0 }, { du: 2, dv: -1 }, { du: -1, dv: 1 }, { du: 1, dv: 0 },
  ];
  return (
    <svg viewBox="0 0 520 380" className="relative block h-auto w-full" role="img" aria-label="Isometric mailroom: envelopes ride a belt into the JEV sorter, and wires carry them to bins for Work, Receipts, Promos, Social, and Trash">
      <Patterns prefix="hero" />
      <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]})`}>
        {/* Packets in the air: unsorted mail arriving, sorted mail leaving. */}
        <g>
          <Hex at={[-118, -8]} />
          <Hex at={[-134, -17]} filled />
          <Hex at={[-118, -26]} />
          <circle cx={-134} cy={-33} r={2} style={{ fill: accent(66) }} />
          <Hex at={[302, -150]} />
          <Hex at={[318, -141]} filled />
          <Hex at={[302, -132]} />
          <circle cx={318} cy={-125} r={2} style={{ fill: accent(66) }} />
        </g>

        {/* Ground wires first, so the boxes sit on top of them. */}
        <g>
          {bins.map((b) => <Wire key={b.label} d={b.wire} />)}
        </g>

        {/* The sorter. */}
        <IsoBox u0={-SORTER} v0={-SORTER} u1={SORTER} v1={SORTER} h={72} tone="dark" shadow>
          <polygon points={poly([iso(-18, SORTER, 13), iso(18, SORTER, 13), iso(18, SORTER, 0), iso(-18, SORTER, 0)])} style={{ fill: "var(--accent-soft)", stroke: accent(70) }} strokeWidth={1} />
          <path d={path([iso(-50, -SORTER, 62), iso(50, -SORTER, 62)])} style={{ fill: "none", stroke: ink(30, "var(--panel)") }} strokeWidth={1} />
          <ellipse cx={iso(SORTER, -44, 58)[0]} cy={iso(SORTER, -44, 58)[1]} rx={4.2} ry={2.4} style={{ fill: "var(--accent)" }} />
          <ellipse cx={iso(SORTER, -32, 58)[0]} cy={iso(SORTER, -32, 58)[1]} rx={4.2} ry={2.4} style={{ fill: ink(55, "var(--panel)") }} />
          <ellipse cx={iso(SORTER, -20, 58)[0]} cy={iso(SORTER, -20, 58)[1]} rx={4.2} ry={2.4} style={{ fill: ink(35, "var(--panel)") }} />
          <path d={path([iso(SORTER, 8, 6), iso(SORTER, 48, 6)]) + " " + path([iso(SORTER, 8, 11), iso(SORTER, 48, 11)]) + " " + path([iso(SORTER, 8, 16), iso(SORTER, 48, 16)])} style={{ fill: "none", stroke: ink(30, "var(--panel)") }} strokeWidth={1} />
          <Stamp u={0} v={0} z={72} />
        </IsoBox>
        {bins.map((b) => <Port key={b.label} at={b.sorterPort} />)}

        {/* Intake: a belt from the envelope stack into the sorter's front face. */}
        <IsoBox u0={-18} v0={56} u1={18} v1={130} h={8} shadow>
          {[64, 74, 94, 104, 114, 124].map((v) => (
            <path key={v} d={path([iso(-18, v, 8), iso(18, v, 8)])} style={{ fill: "none", stroke: ink(18) }} strokeWidth={1} />
          ))}
        </IsoBox>
        <Wire d={beltWire} />
        <Envelope u={-15} v={82} z={8} />
        {stack.map(({ du, dv }, i) => <Envelope key={i} u={-15 + du} v={142 + dv} z={i * 3.5} />)}

        {/* The rack, nearest bin last so it overlaps the ones behind it. */}
        {bins.map((b) => <Bin key={b.label} b={b} />)}
        <g>
          {bins.map((b) => <Wire key={b.label} d={b.entry} />)}
          {bins.map((b) => <Port key={b.label} at={b.binPort} />)}
        </g>
      </g>
    </svg>
  );
}
