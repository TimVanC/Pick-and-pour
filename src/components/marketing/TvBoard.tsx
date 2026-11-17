"use client";

import { useEffect, useState } from "react";
import { demoBoard, type DemoGame } from "@/content/home";
import {
  NJ_DEFAULT_PROFILE,
  formatPercent,
  lockInDiscount,
  probabilityToLine,
  vigFreeProbability,
  winDiscount,
} from "@/lib/discount";

const TICK_MS = 2200;

type LiveGame = {
  /** Live win chance of side A. */
  probabilityA: number;
  /** +1 when side A's chance just rose, -1 when it fell, 0 at load. */
  direction: -1 | 0 | 1;
  clockSeconds: number;
};

function initialState(games: DemoGame[]): LiveGame[] {
  return games.map((game) => ({
    probabilityA: game.liveProbabilityA,
    direction: 0,
    clockSeconds: game.clockSeconds,
  }));
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Marketing mockup of the venue TV board. The lines drift at random on a timer;
 * the discounts are computed from them with the real discount math.
 */
export function TvBoard() {
  const games = demoBoard.games;
  const [live, setLive] = useState(() => initialState(games));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setLive((current) =>
        current.map((game) => {
          const step = (Math.random() - 0.5) * 0.06;
          const next = Math.min(0.92, Math.max(0.08, game.probabilityA + step));
          return {
            probabilityA: next,
            direction: next >= game.probabilityA ? 1 : -1,
            clockSeconds: Math.max(1, game.clockSeconds - 1),
          };
        }),
      );
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      role="img"
      aria-label="Example TV board: two featured games, each side showing its live line, the discount if that side wins, and the discount to lock in now."
      className="rounded-[2rem] border-4 border-charcoal-600 bg-black p-2 shadow-2xl shadow-black/60 sm:p-3"
    >
      <div aria-hidden="true" className="rounded-[1.4rem] bg-charcoal-800 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 border-b border-cream/10 pb-3">
          <span className="font-display text-lg font-bold uppercase tracking-wide text-cream sm:text-xl">
            Pick <span className="text-gold">&amp;</span> Pour
          </span>
          <span className="flex items-center gap-2 font-display text-xs uppercase tracking-widest text-gold sm:text-sm">
            <span className="size-2 rounded-full bg-tomato animate-live-dot" />
            {demoBoard.nextLockIn}
          </span>
        </div>

        <div className="mt-3 grid gap-3">
          {games.map((game, index) => (
            <GameCard key={game.id} game={game} live={live[index]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GameCard({ game, live }: { game: DemoGame; live: LiveGame }) {
  const [a, b] = game.sides;
  const entryA = vigFreeProbability(a.entryLine, b.entryLine);

  return (
    <div className="rounded-2xl bg-charcoal p-3">
      <p className="text-center font-display text-xs uppercase tracking-widest text-cream/60">
        {game.period} · {formatClock(live.clockSeconds)}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <SidePanel
          side={a}
          entry={entryA}
          now={live.probabilityA}
          direction={live.direction}
        />
        <SidePanel
          side={b}
          entry={1 - entryA}
          now={1 - live.probabilityA}
          direction={live.direction === 0 ? 0 : live.direction === 1 ? -1 : 1}
        />
      </div>
    </div>
  );
}

function SidePanel({
  side,
  entry,
  now,
  direction,
}: {
  side: DemoGame["sides"][number];
  entry: number;
  now: number;
  direction: -1 | 0 | 1;
}) {
  const dWin = winDiscount(NJ_DEFAULT_PROFILE, entry);
  const dLock = lockInDiscount(dWin, entry, now);
  const lockLabel = dLock >= 0.005 ? formatPercent(dLock) : "Full price";
  const arrow = direction === 1 ? "▲" : direction === -1 ? "▼" : "";

  return (
    <div className="rounded-xl bg-charcoal-800 p-2.5 sm:p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-display text-base font-semibold uppercase tracking-wide text-cream sm:text-lg">
          {side.name}
        </span>
        <span className="font-display text-2xl font-bold tabular-nums text-cream sm:text-3xl">
          {side.score}
        </span>
      </div>

      <p className="mt-1 text-xs tabular-nums text-cream/70 sm:text-sm">
        <span key={probabilityToLine(now)} className="animate-tick-flash rounded px-0.5">
          {probabilityToLine(now)}
        </span>{" "}
        · {formatPercent(now)}{" "}
        <span className={direction === 1 ? "text-gold" : "text-cream/40"}>
          {arrow}
        </span>
      </p>

      <dl className="mt-2 grid gap-1.5">
        <div className="rounded-lg bg-gold px-2 py-1.5 text-charcoal">
          <dt className="text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]">
            Off if they win
          </dt>
          <dd className="font-display text-2xl font-bold leading-none tabular-nums sm:text-3xl">
            {formatPercent(dWin)}
          </dd>
        </div>
        <div className="rounded-lg border border-cream/15 px-2 py-1.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-cream/60 sm:text-[11px]">
            Lock in now
          </dt>
          <dd
            key={lockLabel}
            className="animate-tick-flash rounded font-display text-xl font-semibold leading-tight tabular-nums text-cream sm:text-2xl"
          >
            {lockLabel}
          </dd>
        </div>
      </dl>
    </div>
  );
}
