import { Fragment, type ComponentType } from "react";
import { Funnel, ScrollText, Stamp as StampIcon, type LucideIcon } from "lucide-react";
import { Envelope, Hex, IsoBox, Patterns, Port, Stamp, Wire, ink, iso, path } from "./iso";

/** Three sieve trays: every rule is a Gmail search plus a label change, applied on arrival and once a day. */
function RulesTile() {
  return (
    <g transform="translate(100 74)">
      <Wire d={path([iso(0, 0, 84), iso(0, 0, 38)])} />
      {[0, 1, 2].map((k) => (
        <IsoBox key={k} u0={-32} v0={-22} u1={32} v1={22} z={k * 15} h={3} shadow={k === 0}>
          {[-14, -6, 2, 10].map((v) => (
            <path key={v} d={path([iso(-27, v, k * 15 + 3), iso(27, v, k * 15 + 3)])} style={{ fill: "none", stroke: ink(22) }} strokeWidth={1} />
          ))}
        </IsoBox>
      ))}
      <Envelope u={-15} v={-10} z={33} />
    </g>
  );
}

/** The sorter again, smaller: one judgment in, typed answers out on two ports. */
function JudgeTile() {
  return (
    <g transform="translate(100 78)">
      <Wire d={path([iso(-86, -10, 0), iso(-26, -10, 0)])} />
      <IsoBox u0={-26} v0={-26} u1={26} v1={26} h={34} tone="dark" shadow>
        <Stamp u={0} v={0} z={34} size={0.64} />
      </IsoBox>
      <Wire d={path([iso(26, -8, 12), iso(36, -8, 12), iso(36, -8, 0), iso(84, -8, 0)])} />
      <Wire d={path([iso(26, 8, 12), iso(36, 8, 12), iso(36, 8, 0), iso(84, 8, 0)])} />
      <Port at={iso(26, -8, 12)} />
      <Port at={iso(26, 8, 12)} />
      <Hex at={[60, -58]} />
      <Hex at={[74, -50]} filled />
    </g>
  );
}

/** A receipt standing on the ledger, with the undo arrow beside it. */
function ReceiptTile() {
  return (
    <g transform="translate(100 88)">
      <IsoBox u0={-34} v0={-24} u1={34} v1={24} h={10} shadow />
      <g transform="translate(-16 -70)">
        <path d="M0 0H32V44l-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4Z" style={{ fill: "var(--panel)", stroke: ink(40) }} strokeWidth={1} strokeLinejoin="round" />
        {[9, 16, 23].map((y) => <path key={y} d={`M6 ${y}H26`} style={{ stroke: ink(25) }} strokeWidth={1.4} strokeLinecap="round" />)}
        <path d="M6 30H16" style={{ stroke: ink(25) }} strokeWidth={1.4} strokeLinecap="round" />
        <circle cx={24} cy={34} r={5.5} style={{ fill: "var(--accent)" }} />
        <path d="M21.4 34.2l1.9 1.9 3.6-3.9" style={{ fill: "none", stroke: "var(--page)" }} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(30 -50)">
        <path d="M13 3.5A8 8 0 1 1 3.4 10" style={{ fill: "none", stroke: "var(--ink)" }} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M0.5 8.6l3.2 2 1.8-3.3" style={{ fill: "none", stroke: "var(--ink)" }} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

type Stage = { n: string; title: string; caption: string; icon: LucideIcon; art: ComponentType };

const STAGES: Stage[] = [
  { n: "01", title: "Rules", caption: "Filters label mail on arrival. A daily pass ages out the noise.", icon: Funnel, art: RulesTile },
  { n: "02", title: "Judge", caption: "Jev answers five typed questions from metadata only.", icon: StampIcon, art: JudgeTile },
  { n: "03", title: "Receipt", caption: "Every change is recorded. One click reverses the run.", icon: ScrollText, art: ReceiptTile },
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
            <span className="mono absolute left-4 top-3 text-[11px] font-semibold text-muted">{s.n}</span>
            <svg viewBox="0 0 200 140" className="block w-full" aria-hidden="true"><Patterns prefix={`flow-${s.n}`} /><s.art /></svg>
            <div className="mt-2 flex items-center gap-2 text-[16px] font-bold"><s.icon size={17} className="text-ink" aria-hidden="true" />{s.title}</div>
            <p className="mt-1 text-[14px] leading-snug text-muted">{s.caption}</p>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
