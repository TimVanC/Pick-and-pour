"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  gameClockLabel,
  nextLockInLabel,
  type GameView,
  type Side,
  type TvState,
} from "@/lib/app-types";
import { lockInDiscount, winDiscount } from "@/lib/discount";
import { Qr, pct, useOrigin, usePoll } from "./client";

const POLL_MS = 4000;
/** After this long without data the board says "Reconnecting" instead of showing old numbers. */
const STALE_AFTER_MS = 2 * 60 * 1000;
/** With more than four games the board shows four at a time and rotates. */
const PAGE_SIZE = 4;
const ROTATE_MS = 15 * 1000;

export function TvBoardLive() {
  const { token } = useParams<{ token: string }>();
  const { data, status, failedSince } = usePoll<TvState>(`/api/tv/${token}`, POLL_MS);
  const [now, setNow] = useState(() => Date.now());
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const games = data?.games ?? [];
  const pages = Math.max(1, Math.ceil(games.length / PAGE_SIZE));
  useEffect(() => {
    if (pages <= 1) return;
    const timer = window.setInterval(() => setPage((current) => current + 1), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [pages]);

  const reconnecting = failedSince !== null && now - failedSince > STALE_AFTER_MS;
  const shown = games.slice((page % pages) * PAGE_SIZE, (page % pages) * PAGE_SIZE + PAGE_SIZE);
  const origin = useOrigin();
  const rulesUrl = origin ? `${origin}/house-rules` : "";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-charcoal p-[1.5vw] text-cream">
      <header className="flex items-center justify-between gap-[2vw] pb-[1.2vw]">
        <div>
          <p className="font-display text-[3.2vw] font-bold uppercase leading-none tracking-wide">
            Pick <span className="text-gold">&amp;</span> Pour
          </p>
          <p className="mt-[0.4vw] text-[1.3vw] text-cream/70">
            Pick a side with your bartender. Team wins, tab drops.
          </p>
        </div>
        <p className="flex items-center gap-[0.8vw] font-display text-[2vw] font-semibold uppercase tracking-widest text-gold">
          <span className="size-[1vw] rounded-full bg-tomato animate-live-dot" />
          {data ? nextLockInLabel(games) : "Loading"}
        </p>
        <div className="flex items-center gap-[1vw]">
          <p className="text-right text-[1.1vw] leading-tight text-cream/70">
            House
            <br />
            rules
          </p>
          {rulesUrl && <Qr value={rulesUrl} className="size-[6vw]" />}
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {status === 404 ? (
          <Message title="Board not found" body="Check the TV link in Manager → Games." />
        ) : reconnecting ? (
          <Message title="Reconnecting" body="Live numbers will be back in a moment." />
        ) : !data ? (
          <Message title="Loading the board" body="" />
        ) : games.length === 0 ? (
          <Message title="No games on the board" body="Featured games show up here on game day." />
        ) : (
          <div
            className={`grid h-full gap-[1.2vw] ${shown.length > 1 ? "grid-cols-2" : "grid-cols-1"} ${shown.length > 2 ? "grid-rows-2" : "grid-rows-1"}`}
          >
            {shown.map((game) => (
              <GameCard key={game.id} game={game} limits={data.limits} zoom={shown.length === 1 ? 1.7 : shown.length === 2 ? 1.3 : 1} />
            ))}
          </div>
        )}
      </main>

      <footer className="flex items-center justify-between pt-[0.8vw] text-[1.1vw] text-cream/60">
        <p>Free to play. Never above menu price. {data?.rulesText}</p>
        {pages > 1 && (
          <p>
            Games {(page % pages) + 1} of {pages}
          </p>
        )}
      </footer>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="font-display text-[6vw] font-bold uppercase">{title}</p>
      {body && <p className="mt-[1vw] text-[2vw] text-cream/70">{body}</p>}
    </div>
  );
}

function GameCard({
  game,
  limits,
  zoom,
}: {
  game: GameView;
  limits: TvState["limits"];
  /** Text scale: bigger when fewer games share the screen. */
  zoom: number;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-[1.5vw] bg-charcoal-800 p-[1.2vw]">
      <p
        className="text-center font-display font-semibold uppercase tracking-widest text-cream/70"
        style={{ fontSize: `${1.6 * zoom}vw` }}
      >
        {gameClockLabel(game)}
        {game.suspended && <span className="text-tomato"> · line paused</span>}
      </p>
      <div className="mt-[0.8vw] grid min-h-0 flex-1 grid-cols-2 gap-[1vw]">
        <SidePanel game={game} side="away" limits={limits} zoom={zoom} />
        <SidePanel game={game} side="home" limits={limits} zoom={zoom} />
      </div>
    </section>
  );
}

function SidePanel({
  game,
  side,
  limits,
  zoom,
}: {
  game: GameView;
  side: Side;
  limits: TvState["limits"];
  /** Text scale: bigger when fewer games share the screen. */
  zoom: number;
}) {
  const team = side === "home" ? game.home : game.away;
  const kickoff = team.kickoffP ?? team.p;
  const dWin = kickoff === null ? null : winDiscount(limits, kickoff);
  const lock =
    dWin === null || kickoff === null || team.p === null
      ? null
      : lockInDiscount(dWin, kickoff, team.p);
  const final = game.status === "final";
  const won = final && game.winner === side;
  const size = (vw: number) => ({ fontSize: `${vw * zoom}vw` });

  return (
    <div
      className={`flex min-h-0 flex-col justify-between rounded-[1.2vw] p-[1.1vw] ${won ? "bg-gold text-charcoal" : "bg-charcoal"}`}
    >
      <div>
        <div className="flex items-baseline justify-between gap-[1vw]">
          <p className="line-clamp-2 font-display font-bold uppercase leading-[1.05]" style={size(2)}>
            {team.name}
          </p>
          <p className="font-display font-bold leading-none tabular-nums" style={size(3.6)}>
            {team.score}
          </p>
        </div>
        {!final && team.line && team.p !== null && (
          <p className="mt-[0.4vw] tabular-nums text-cream/70" style={size(1.5)}>
            {team.line} · {pct(team.p)}
          </p>
        )}
      </div>

      {final ? (
        <p className="font-display font-bold uppercase leading-none" style={size(2.6)}>
          {won ? `Winner · ${dWin === null ? "" : pct(dWin)} off` : "Full price"}
        </p>
      ) : (
        <div className="grid gap-[0.6vw]">
          <div className="rounded-[0.8vw] bg-gold px-[1vw] py-[0.6vw] text-charcoal">
            <p className="font-semibold uppercase tracking-wider" style={size(0.95)}>
              Kickoff pick · off if they win
            </p>
            <p className="font-display font-bold leading-none tabular-nums" style={size(3.4)}>
              {dWin === null ? "—" : pct(dWin)}
            </p>
          </div>
          <div className="rounded-[0.8vw] border-[0.15vw] border-cream/25 px-[1vw] py-[0.6vw]">
            <p className="font-semibold uppercase tracking-wider text-cream/70" style={size(0.95)}>
              Kickoff pick · lock in now
            </p>
            <p
              key={lock === null ? "none" : pct(lock)}
              className="animate-tick-flash rounded font-display font-bold leading-none tabular-nums"
              style={size(2.6)}
            >
              {game.status === "scheduled"
                ? "At the first break"
                : lock === null
                  ? "—"
                  : lock >= 0.005
                    ? pct(lock)
                    : "Full price"}
            </p>
          </div>
          {game.entryOpen && game.status === "live" && team.p !== null && (
            <p className="text-cream/70" style={size(1.2)}>
              New pick now: <span className="font-semibold text-cream">{pct(winDiscount(limits, team.p))} off</span>{" "}
              if they win
            </p>
          )}
        </div>
      )}
    </div>
  );
}
