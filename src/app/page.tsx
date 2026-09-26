import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowRight, BadgeDollarSign, BrainCircuit, Coins, Gauge, History, KeyRound, Lock, LogOut, Search, ShieldCheck, Tags, Trash2, Undo2, Workflow } from "lucide-react";
import { auth } from "@/auth";
import { GmailMark } from "@/components/GmailMark";
import { SignInButton } from "@/components/SignInButton";
import { HeroScene } from "@/components/landing/HeroScene";
import { RunFlow } from "@/components/landing/RunFlow";
import { SearchDiagram } from "@/components/landing/SearchDiagram";
import { TrashDiagram } from "@/components/landing/TrashDiagram";
import { JudgmentCard } from "@/components/landing/JudgmentCard";
import { ClosingBand } from "@/components/landing/ClosingBand";
import { IconCard, Seam, SectionHead } from "@/components/landing/Section";
import { LabelGrid } from "@/components/landing/LabelGrid";
import { defaultPolicy } from "@/lib/policy/schema";
import { ESTIMATED_TOKENS_PER_MESSAGE, USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";

export const dynamic = "force-dynamic";

const lede = "mt-5 max-w-[640px] text-[clamp(17px,1.5vw,21px)] leading-snug text-muted";

export default async function Landing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  const { error } = await searchParams;
  const policy = defaultPolicy();
  const perThousand = 1000 * ESTIMATED_TOKENS_PER_MESSAGE * USD_PER_INPUT_TOKEN;
  const cta = session?.user
    ? <Link href="/app" className="btn-primary text-[15px]"><GmailMark size={16} /> Open your dashboard <ArrowRight size={16} aria-hidden="true" /></Link>
    : <SignInButton label="Connect Gmail" className="btn-primary text-[15px]" />;
  const costs: { icon: LucideIcon; n: string; t: string }[] = [
    { icon: BadgeDollarSign, n: "$0", t: "for every rule, every day" },
    { icon: Coins, n: `$${perThousand.toFixed(2)}`, t: "per 1,000 emails judged" },
    { icon: Gauge, n: `$${policy.ai.budgetUsdPerRun.toFixed(2)}`, t: "cap per run, yours to change" },
  ];

  return (
    <div>
      <section id="hero" className="section relative grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:gap-12">
        <div className="dither" aria-hidden="true" />
        <div className="relative">
          <h1 className="rise text-[clamp(40px,5.3vw,76px)] font-bold leading-[1.0] tracking-[-0.03em]">
            Your Gmail,
            <br />
            sorted.
          </h1>
          <p className={`rise rise-2 ${lede}`}>Rules you can read. Typed AI judgments for pennies. A straight answer to what to trash.</p>
          {error === "scope" ? (
            <p className="mt-5 max-w-[560px] border border-ink p-4 text-[15px]">Sign in again and leave the Gmail box checked. Mailroom never sends or deletes anything.</p>
          ) : null}
          <div className="rise rise-3 mt-8 flex flex-wrap gap-3">
            {cta}
            <a href="#how" className="btn text-[15px]">How it works <ArrowDown size={16} aria-hidden="true" /></a>
          </div>
          <p className="rise rise-4 mt-6 inline-flex items-center gap-2 text-[14px] text-muted"><Undo2 size={15} aria-hidden="true" /> Every run previews first and can be undone.</p>
        </div>
        <div className="relative rise rise-3">
          <HeroScene />
        </div>
      </section>

      <Seam />

      <section id="how" className="section">
        <SectionHead icon={Workflow} line1="Rules, then Jev," line2="then a receipt.">Free searches do the bulk. One cheap judgment places the rest. Everything has an undo.</SectionHead>
        <div className="mt-12"><RunFlow /></div>
      </section>

      <Seam />

      <section id="search" className="section">
        <SectionHead icon={Search} line1="Ask in plain words." line2="Get a Gmail query.">Type it like you would say it. Edit the query if you want. Act on the results in bulk.</SectionHead>
        <div className="mt-12"><SearchDiagram /></div>
      </section>

      <Seam />

      <section id="trash" className="section">
        <SectionHead icon={Trash2} line1="Decide once," line2="sender by sender.">Jev scores every sender. You click. It becomes a standing rule.</SectionHead>
        <div className="mt-12"><TrashDiagram /></div>
      </section>

      <Seam />

      <section id="policy" className="section">
        <SectionHead icon={Tags} line1="Thirteen labels." line2="Nothing custom." />
        <div className="mt-12"><LabelGrid policy={policy} /></div>
        <p className={lede}>Never sends. Never unsubscribes. Never deletes for good. Never trashes work, people, or money.</p>
      </section>

      <Seam />

      <section id="ai" className="section grid items-center gap-12 lg:grid-cols-2">
        <SectionHead icon={BrainCircuit} line1="Five typed questions." line2="One judgment each.">Metadata only. Probabilities, not prose. Judged once, cached forever.</SectionHead>
        <JudgmentCard />
      </section>

      <Seam />

      <section id="cost" className="section">
        <SectionHead icon={Coins} line1="Rules are free." line2="Judgments cost cents." />
        <ul className="m-0 mt-12 grid list-none gap-4 p-0 sm:grid-cols-3">
          {costs.map(({ icon: Icon, n, t }) => (
            <li key={t} className="card py-8">
              <span className="tile tile--sm" aria-hidden="true"><Icon size={18} strokeWidth={2.2} /></span>
              <div className="display mt-5 text-[clamp(44px,5.5vw,72px)] leading-none">{n}</div>
              <div className="mt-3 text-[16px] text-muted">{t}</div>
            </li>
          ))}
        </ul>
      </section>

      <Seam />

      <section id="trust" className="section">
        <SectionHead icon={ShieldCheck} line1="Your mail stays" line2="in Google." />
        <ul className="display m-0 mt-12 grid list-none gap-4 p-0 text-[clamp(19px,2.1vw,26px)] leading-tight sm:grid-cols-2">
          <IconCard icon={Lock} className="py-7">Bodies never leave Google.</IconCard>
          <IconCard icon={KeyRound} className="py-7">Tokens encrypted at rest.</IconCard>
          <IconCard icon={History} className="py-7">Trash keeps 30 days. Undo keeps more.</IconCard>
          <IconCard icon={LogOut} className="py-7">Disconnect deletes everything.</IconCard>
        </ul>
        <p className={lede}>Unverified with Google for now: the owner and up to 100 people can connect.</p>
      </section>

      <Seam />

      <ClosingBand cta={cta} />
    </div>
  );
}
