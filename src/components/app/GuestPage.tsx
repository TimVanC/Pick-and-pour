"use client";

import { useParams } from "next/navigation";
import { formatCents, gameClockLabel, type GuestState } from "@/lib/app-types";
import { pct, usePoll } from "./client";

const POLL_MS = 5000;

/** What a guest sees after scanning their QR code: their own pick, live. */
export function GuestPage() {
  const { token } = useParams<{ token: string }>();
  const { data, status, failedSince } = usePoll<GuestState>(`/api/p/${token}`, POLL_MS);

  if (status === 404) {
    return (
      <Frame>
        <h1 className="font-display text-4xl font-bold uppercase">This pick link has expired</h1>
        <p className="mt-3 text-cream/70">
          Pick links stop working a day after the game. Ask your bartender about today&apos;s
          games.
        </p>
      </Frame>
    );
  }
  if (!data) {
    return (
      <Frame>
        <p className="font-display text-2xl uppercase text-cream/70">
          {failedSince ? "Reconnecting…" : "Loading your pick…"}
        </p>
      </Frame>
    );
  }

  const { pick, game } = data;
  const team = pick.side === "home" ? game.home : game.away;
  const other = pick.side === "home" ? game.away : game.home;

  return (
    <Frame venueName={data.venueName}>
      {failedSince && (
        <p role="status" className="mb-4 rounded-2xl bg-tomato px-4 py-2 text-center font-semibold">
          Reconnecting…
        </p>
      )}

      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold">
        {pick.tabLabel}
        {pick.seat && ` · seat ${pick.seat}`} · your pick
      </p>
      <h1 className="mt-1 font-display text-5xl font-bold uppercase leading-none">{team.name}</h1>
      <p className="mt-2 text-cream/70">
        vs {other.name} · picked at {pick.entryLine} ({pct(pick.pEntry)} to win)
      </p>

      <div className="mt-5 rounded-3xl bg-charcoal-800 p-4">
        <p className="text-center font-display text-sm uppercase tracking-widest text-cream/60">
          {gameClockLabel(game)}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-center">
          {[game.away, game.home].map((side) => (
            <div key={side.abbr}>
              {/* The full names are in the headline; the score box uses the short codes so nothing truncates on a phone. */}
              <p className="font-display text-lg uppercase text-cream/80">{side.abbr}</p>
              <p className="font-display text-5xl font-bold tabular-nums">{side.score}</p>
            </div>
          ))}
        </div>
      </div>

      <Outcome data={data} />

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold uppercase">How lock-in works</h2>
        <p className="mt-2 text-cream/80">
          At a quarter break or halftime, if your side is doing better than when you picked, you
          can lock in a smaller discount on the spot. Tell your bartender; once locked, it&apos;s
          yours whatever happens next.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-xl font-bold uppercase">House rules</h2>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-cream/80">
          <li>{data.rulesText}</li>
          <li>Free to play. You never pay more than menu price.</li>
          <li>
            The discount covers up to {formatCents(data.maxCoveredCents)} of your tab after your
            pick, before tax.
          </li>
          <li>One pick per tab at a time. Lock-ins are final.</li>
          <li>Please enjoy responsibly.</li>
        </ul>
      </section>
    </Frame>
  );
}

function Outcome({ data }: { data: GuestState }) {
  const { pick, game } = data;
  const base = "mt-5 rounded-3xl p-5 text-center";

  if (pick.status === "void") {
    return (
      <div className={`${base} bg-charcoal-800`}>
        <p className="font-display text-3xl font-bold uppercase">Pick cancelled</p>
        <p className="mt-1 text-cream/70">Ask your bartender if you&apos;d like a new one.</p>
      </div>
    );
  }
  if (pick.status === "applied") {
    return (
      <div className={`${base} bg-gold text-charcoal`}>
        <p className="font-display text-lg font-semibold uppercase">
          {pick.discountCents ? "Taken off your tab" : "Settled"}
        </p>
        <p className="font-display text-6xl font-bold tabular-nums">
          {pick.discountCents ? formatCents(pick.discountCents) : "Full price"}
        </p>
        {pick.discountCents ? (
          <p className="mt-1">
            {pct(pick.dFinal ?? 0)} off {formatCents(pick.coveredCents ?? 0)}. Thanks for playing!
          </p>
        ) : null}
      </div>
    );
  }
  if (pick.status === "locked") {
    return (
      <div className={`${base} bg-gold text-charcoal`}>
        <p className="font-display text-lg font-semibold uppercase">Locked in</p>
        <p className="font-display text-7xl font-bold tabular-nums">{pct(pick.dFinal ?? 0)} off</p>
        <p className="mt-1">It comes off when you close your tab.</p>
      </div>
    );
  }
  if (pick.status === "settled") {
    const won = (pick.dFinal ?? 0) > 0;
    return (
      <div className={`${base} ${won ? "bg-gold text-charcoal" : "bg-charcoal-800"}`}>
        <p className="font-display text-lg font-semibold uppercase">
          {won ? "They won!" : pick.result === "closed" ? "Closed out" : "Not this time"}
        </p>
        <p className="font-display text-6xl font-bold tabular-nums">
          {won ? `${pct(pick.dFinal ?? 0)} off` : "Full price"}
        </p>
        <p className="mt-1">
          {won ? "It comes off when you close your tab." : "Thanks for playing. Pick again next game."}
        </p>
      </div>
    );
  }

  const lock = pick.lockValue ?? 0;
  return (
    <>
      <div className={`${base} bg-gold text-charcoal`}>
        <p className="font-display text-lg font-semibold uppercase">If they win</p>
        <p className="font-display text-7xl font-bold tabular-nums">{pct(pick.dWin)} off</p>
      </div>
      <div className={`${base} mt-3 border-2 border-cream/25`}>
        <p className="font-display text-lg font-semibold uppercase text-cream/70">
          Lock in right now
        </p>
        <p
          key={pct(lock)}
          className="animate-tick-flash rounded font-display text-5xl font-bold tabular-nums"
        >
          {lock >= 0.005 ? `${pct(lock)} off` : "Nothing yet"}
        </p>
        <p className="mt-1 text-cream/70">
          {game.lockOpen
            ? "Lock-ins are open. Tell your bartender now."
            : game.status === "live"
              ? "Lock-ins open at the next break."
              : "Lock-ins open at the first break."}
        </p>
      </div>
    </>
  );
}

function Frame({ venueName, children }: { venueName?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-charcoal text-cream">
      <div className="mx-auto max-w-md px-5 py-6">
        <header className="mb-6 flex items-baseline justify-between gap-3">
          <p className="font-display text-2xl font-bold uppercase tracking-wide">
            Pick <span className="text-gold">&amp;</span> Pour
          </p>
          {venueName && <p className="truncate text-cream/70">{venueName}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}
