import { Fragment, type ComponentType } from "react";
import { Funnel, ScrollText, Stamp as StampIcon, Undo2, type LucideIcon } from "lucide-react";
import { COS, SIN, Envelope, IsoBox, Patterns, Port, Stamp, Wire, ink, iso, path, plane, svgText } from "./iso";
import { BRANDS, type BrandId } from "./Brand";

/*
 * Three stages, three tiles, one shared viewBox (170 x 150). Everything a tile says is drawn in the SVG voice:
 * mono, uppercase, letter-spaced. The exception is real UI text (a Gmail query), which stays lowercase.
 */
const W = 170;
const H = 150;
const uiText = { ...svgText, textTransform: "none" as const, letterSpacing: 0.2, fontWeight: 400 };
const faint = { fill: "none", stroke: ink(45) };

/** A brand mark drawn straight into the SVG, sized like an icon. */
function Mark({ id, x, y, size }: { id: BrandId; x: number; y: number; size: number }) {
  return <path d={BRANDS[id].path} transform={`translate(${x} ${y}) scale(${size / 24})`} style={{ fill: "var(--ink)" }} />;
}

/** Transform for text on a box's front-left face (the v = v1 plane): x runs along u, y runs down the wall. */
function faceLeft(u: number, v1: number, z: number): string {
  const [x, y] = iso(u, v1, z);
  return `matrix(${COS} ${SIN} 0 1 ${x} ${y})`;
}

/** A letter riding a wire, hidden when motion is reduced. */
function FlyingLetter({ d, dur, begin = "0s" }: { d: string; dur: string; begin?: string }) {
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

/* Stage 1: three filters, each a Gmail search plus a label, feeding one labeled tray. */
const FILTERS: { mark: BrandId; query: string; label: string }[] = [
  { mark: "github", query: "from:github.com", label: "Dev" },
  { mark: "vercel", query: "from:vercel.com", label: "Dev" },
  { mark: "sentry", query: "from:sentry.io", label: "Dev" },
];
const CHUTE = "M85 60 V104";

function RulesTile() {
  return (
    <g>
      <Wire d={CHUTE} />
      <g transform="translate(85 118)">
        <IsoBox u0={-26} v0={-16} u1={26} v1={16} h={12} shadow>
          <g transform={plane(-23, -13, 12)}>
            <rect width={46} height={26} style={{ fill: ink(78, "var(--panel)") }} />
            <rect width={46} height={26} fill="url(#flow-01-dots)" opacity={0.35} />
          </g>
          <Envelope u={-17} v={-9} z={12} w={26} d={17} />
          <Envelope u={-9} v={-4} z={15} w={26} d={17} />
          <g transform={faceLeft(-22, 16, 9)}>
            <text x={0} y={0} style={{ ...svgText, fontSize: 7, letterSpacing: 1.6 }}>Dev</text>
          </g>
        </IsoBox>
      </g>
      {FILTERS.map((f, i) => {
        const y = 8 + i * 18;
        return (
          <g key={f.query} transform={`translate(20 ${y})`}>
            <rect width={130} height={16} rx={3} style={{ fill: "var(--panel)", stroke: ink(45) }} strokeWidth={1} />
            <Mark id={f.mark} x={5} y={3} size={10} />
            <text x={20} y={11} style={{ ...uiText, fontSize: 6.2 }}>{f.query}</text>
            <rect x={104} y={3} width={22} height={10} rx={2} style={{ fill: "var(--ink)" }} />
            <text x={115} y={10.3} textAnchor="middle" style={{ ...svgText, fill: "var(--page)", fontSize: 5, letterSpacing: 0.9 }}>{f.label}</text>
          </g>
        );
      })}
      <FlyingLetter d={CHUTE} dur="3s" />
    </g>
  );
}

/* Stage 2: the sorter and the ticket it prints: five typed answers, each a name and a probability. */
type Answer = { q: string; p: number; tag?: string; t?: number };
const ANSWERS: Answer[] = [
  { q: "category", p: 0.88, tag: "Recruiting" },
  { q: "automated", p: 0.93, t: 0.85 },
  { q: "needs action", p: 0.21, t: 0.7 },
  { q: "time-sensitive", p: 0.34 },
  { q: "disposable", p: 0.67, t: 0.8 },
];
const INTAKE = path([iso(-46, -6, 0), iso(-20, -6, 0)]);
const OUT = `M${iso(20, -4, 14)[0] + 42} ${iso(20, -4, 14)[1] + 96} H78 V76 H84`;

function JudgeTile() {
  const x0 = 88;
  const x1 = 162;
  return (
    <g>
      <g transform="translate(42 96)">
        <Wire d={INTAKE} />
        <FlyingLetter d={INTAKE} dur="2.6s" />
        <IsoBox u0={-20} v0={-20} u1={20} v1={20} h={30} tone="dark" shadow>
          <Stamp u={0} v={0} z={30} size={0.5} />
        </IsoBox>
        <Port at={iso(20, -4, 14)} s={4} />
      </g>
      <Wire d={OUT} />
      <g>
        <rect x={84} y={8} width={82} height={134} rx={3} style={{ fill: "var(--panel)", stroke: ink(45) }} strokeWidth={1} />
        <text x={x0} y={20} style={{ ...svgText, fontSize: 6.5, letterSpacing: 1.4 }}>Judgment</text>
        <path d={`M${x0} 25 H${x1}`} style={faint} strokeWidth={1} strokeDasharray="1 2" />
        {ANSWERS.map((a, i) => {
          const y = 37 + i * 21;
          const w = x1 - x0;
          return (
            <g key={a.q}>
              <text x={x0} y={y} style={{ ...svgText, fontSize: 5.6, letterSpacing: 0.4 }}>{a.q}</text>
              <text x={x1} y={y} textAnchor="end" style={{ ...svgText, fontSize: 6.5, letterSpacing: 0.3 }}>{a.p.toFixed(2).replace(/^0/, "")}</text>
              {a.tag ? (
                <g>
                  <rect x={x0} y={y + 4} width={38} height={7} rx={1.5} style={{ fill: "var(--ink)" }} />
                  <text x={x0 + 19} y={y + 9.3} textAnchor="middle" style={{ ...svgText, fill: "var(--page)", fontSize: 4.6, letterSpacing: 0.5 }}>{a.tag}</text>
                </g>
              ) : (
                <g>
                  <rect x={x0} y={y + 4} width={w} height={5} style={faint} strokeWidth={1} />
                  <rect x={x0} y={y + 4} width={w * a.p} height={5} style={{ fill: "var(--ink)" }} />
                  {a.t != null ? <path d={`M${x0 + w * a.t} ${y + 2.5} V${y + 10.5}`} style={{ stroke: "var(--ink)" }} strokeWidth={1.2} /> : null}
                </g>
              )}
            </g>
          );
        })}
      </g>
    </g>
  );
}

/* Stage 3: the receipt for one run, standing on the ledger, with the undo ring beside it. */
const ITEMS: [string, number][] = [["labeled", 212], ["archived", 96], ["trashed", 14]];
const TOTAL = ITEMS.reduce((n, [, v]) => n + v, 0);
const TEETH = Array.from({ length: 8 }, () => "l-4 5-4-5").join("");

function ReceiptTile() {
  const rx = 44;
  const rr = 96;
  return (
    <g>
      <g transform="translate(72 118)">
        <IsoBox u0={-36} v0={-22} u1={36} v1={22} h={8} shadow />
      </g>
      <Wire d="M119 58 H102" />
      <g>
        <path d={`M38 8 H102 V100 ${TEETH} Z`} style={{ fill: "var(--panel)", stroke: ink(50) }} strokeWidth={1} strokeLinejoin="round" />
        <path d="M42 8 H98" style={{ stroke: "var(--panel)" }} strokeWidth={2} />
        <path d="M42 8 H98" style={{ stroke: ink(50) }} strokeWidth={1} strokeDasharray="2 2" />
        <text x={rx} y={21} style={{ ...svgText, fontSize: 6.5, letterSpacing: 1.2 }}>Run 0142</text>
        <path d={`M${rx} 26 H${rr}`} style={faint} strokeWidth={1} strokeDasharray="1 2" />
        {ITEMS.map(([name, n], i) => {
          const y = 40 + i * 12;
          return (
            <g key={name}>
              <text x={rx} y={y} style={{ ...svgText, fontSize: 5.8, letterSpacing: 0.9 }}>{name}</text>
              <text x={rr} y={y} textAnchor="end" style={{ ...svgText, fontSize: 7, letterSpacing: 0.4 }}>{n}</text>
            </g>
          );
        })}
        <path d={`M${rx} 70 H${rr} M${rx} 72 H${rr}`} style={{ stroke: ink(60) }} strokeWidth={1} />
        <text x={rx} y={83} style={{ ...svgText, fontSize: 6.2, letterSpacing: 1.2 }}>Total</text>
        <text x={rr} y={83} textAnchor="end" style={{ ...svgText, fontSize: 7.5, letterSpacing: 0.4 }}>{TOTAL}</text>
        <path d="M44 90 H60" style={{ stroke: ink(35) }} strokeWidth={1} strokeDasharray="1 1.5" />
      </g>
      <g>
        <circle cx={136} cy={58} r={17} style={{ fill: "var(--panel)" }} />
        <circle className="wire" cx={136} cy={58} r={17} />
        <circle className="signal" cx={136} cy={58} r={17} />
        <Undo2 size={18} x={127} y={49} strokeWidth={2.2} style={{ color: "var(--ink)" }} aria-hidden="true" />
        <text x={136} y={87} textAnchor="middle" style={{ ...svgText, fontSize: 6, letterSpacing: 1.4 }}>Undo</text>
      </g>
    </g>
  );
}

type Stage = { n: string; title: string; caption: string; icon: LucideIcon; art: ComponentType };

const STAGES: Stage[] = [
  { n: "01", title: "Rules", caption: "Free searches label mail on arrival.", icon: Funnel, art: RulesTile },
  { n: "02", title: "Judge", caption: "Jev answers five typed questions, metadata only.", icon: StampIcon, art: JudgeTile },
  { n: "03", title: "Receipt", caption: "Every change recorded, one click undoes it.", icon: ScrollText, art: ReceiptTile },
];
const LINKS = ["Primary mail no rule placed", "answers past your thresholds"];

function Connector({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pl-6 sm:w-[108px] sm:flex-col sm:justify-center sm:gap-2 sm:px-2" aria-hidden="true">
      <svg viewBox="0 0 24 56" className="h-14 w-6 shrink-0 sm:hidden"><Wire d="M12 0V56" /></svg>
      <svg viewBox="0 0 96 24" className="hidden h-6 w-full sm:block"><Wire d="M0 12H96" /></svg>
      <span className="text-[12px] font-medium leading-snug text-muted sm:text-center">{label}</span>
    </div>
  );
}

export function RunFlow() {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch sm:gap-0">
      {STAGES.map((s, i) => (
        <Fragment key={s.n}>
          {i > 0 ? <Connector label={LINKS[i - 1]} /> : null}
          <div className="card relative flex flex-col">
            <span className="mono absolute left-4 top-3 text-[11px] font-bold text-muted">{s.n}</span>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block w-full" aria-hidden="true"><Patterns prefix={`flow-${s.n}`} /><s.art /></svg>
            <div className="mt-3 flex items-center gap-2 text-[16px] font-bold"><s.icon size={17} className="text-ink" aria-hidden="true" />{s.title}</div>
            <p className="mt-1 text-[13.5px] leading-snug text-muted">{s.caption}</p>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
