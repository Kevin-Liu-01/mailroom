import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { HeroScene } from "@/components/landing/HeroScene";
import { RunFlow } from "@/components/landing/RunFlow";
import { SearchDiagram } from "@/components/landing/SearchDiagram";
import { TrashDiagram } from "@/components/landing/TrashDiagram";
import { JudgmentCard } from "@/components/landing/JudgmentCard";
import { ClosingBand } from "@/components/landing/ClosingBand";
import { ReticleSpacer } from "@/components/landing/Section";
import { CATEGORIES, defaultPolicy } from "@/lib/policy/schema";
import { ESTIMATED_TOKENS_PER_MESSAGE, USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";

export const dynamic = "force-dynamic";

const h2 = "text-[clamp(34px,4.6vw,64px)] font-bold leading-[1.05] tracking-[-0.03em]";
const lede = "mt-5 max-w-[640px] text-[clamp(17px,1.5vw,21px)] leading-snug text-muted";

export default async function Landing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  const { error } = await searchParams;
  const policy = defaultPolicy();
  const perThousand = 1000 * ESTIMATED_TOKENS_PER_MESSAGE * USD_PER_INPUT_TOKEN;
  const cta = session?.user ? <Link href="/app" className="btn-primary text-[15px]">Open your dashboard <ArrowRight size={16} /></Link> : <SignInButton label="Connect Gmail" />;
  const tag = (id: string) => policy.categories.skipInbox.includes(id as never) ? "skips inbox" : policy.categories.protected.includes(id as never) ? "protected" : policy.categories.neverImportant.includes(id as never) ? "not important" : "stays";

  return (
    <div>
      <section id="hero" className="section relative grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="dither" aria-hidden="true" />
        <div className="relative">
          <h1 className="rise text-[clamp(44px,6.4vw,92px)] font-bold leading-[0.98] tracking-[-0.04em]">
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
            <a href="#how" className="btn text-[15px]">How it works</a>
          </div>
          <p className="rise rise-4 mt-6 text-[14px] text-muted">Every run previews first and can be undone.</p>
        </div>
        <div className="relative rise rise-3">
          <HeroScene />
        </div>
      </section>

      <ReticleSpacer />

      <section id="how" className="section">
        <h2 className={h2}>Rules first. Jev second.<br /><span className="text-muted">Receipt last.</span></h2>
        <p className={lede}>Free searches do the bulk. One cheap judgment places the rest. Everything has an undo.</p>
        <div className="mt-12"><RunFlow /></div>
      </section>

      <ReticleSpacer />

      <section id="search" className="section">
        <h2 className={h2}>Ask in plain words.<br /><span className="text-muted">Get a Gmail query.</span></h2>
        <p className={lede}>Type it like you would say it. Edit the query if you want. Act on the results in bulk.</p>
        <div className="mt-12"><SearchDiagram /></div>
      </section>

      <ReticleSpacer />

      <section id="trash" className="section">
        <h2 className={h2}>Decide once,<br /><span className="text-muted">sender by sender.</span></h2>
        <p className={lede}>Jev scores every sender. You click. It becomes a standing rule.</p>
        <div className="mt-12"><TrashDiagram /></div>
      </section>

      <ReticleSpacer />

      <section id="policy" className="section">
        <h2 className={h2}>Thirteen labels.<br /><span className="text-muted">Nothing custom.</span></h2>
        <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.filter((c) => c.label).map((c) => (
            <li key={c.id} className="card flex items-center justify-between gap-3 py-5">
              <span className="text-[19px] font-bold leading-tight">{c.label}</span>
              <span className={`chip ${tag(c.id) === "skips inbox" ? "chip--accent" : ""}`}>{tag(c.id)}</span>
            </li>
          ))}
        </ul>
        <p className={lede}>Never sends. Never unsubscribes. Never deletes for good. Never trashes work, people, or money.</p>
      </section>

      <ReticleSpacer />

      <section id="ai" className="section grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className={h2}>Five typed questions.<br /><span className="text-muted">One judgment per email.</span></h2>
          <p className={lede}>Metadata only. Probabilities, not prose. Judged once, cached forever.</p>
        </div>
        <JudgmentCard />
      </section>

      <ReticleSpacer />

      <section id="cost" className="section">
        <h2 className={h2}>Rules are free.<br /><span className="text-muted">Judgments cost cents.</span></h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ["$0", "for every rule, every day"],
            [`$${perThousand.toFixed(2)}`, "per 1,000 emails judged"],
            [`$${policy.ai.budgetUsdPerRun.toFixed(2)}`, "cap per run, yours to change"],
          ].map(([n, t]) => (
            <div key={t} className="card py-8">
              <div className="text-[clamp(40px,5vw,64px)] font-bold leading-none tracking-[-0.03em]">{n}</div>
              <div className="mt-3 text-[16px] text-muted">{t}</div>
            </div>
          ))}
        </div>
      </section>

      <ReticleSpacer />

      <section id="trust" className="section">
        <h2 className={h2}>Your mail stays<br /><span className="text-muted">in Google.</span></h2>
        <ul className="mt-12 grid gap-4 text-[clamp(18px,2vw,26px)] font-bold leading-tight sm:grid-cols-2">
          <li className="card py-7">Bodies never leave Google.</li>
          <li className="card py-7">Tokens encrypted at rest.</li>
          <li className="card py-7">Trash keeps 30 days. Undo keeps more.</li>
          <li className="card py-7">Disconnect deletes everything.</li>
        </ul>
        <p className={lede}>Unverified with Google for now: the owner and up to 100 people can connect.</p>
      </section>

      <ReticleSpacer />

      <ClosingBand cta={cta} />
    </div>
  );
}
