"use client";

import { useState, type FormEvent } from "react";
import {
  formatCents,
  gameClockLabel,
  type AppState,
  type GameView,
  type PickView,
  type Side,
} from "@/lib/app-types";
import { coveredSpendCents, discountCents, winDiscount } from "@/lib/discount";
import {
  Button,
  ErrorNote,
  Qr,
  dollarsToCents,
  fieldClass,
  labelClass,
  pct,
  post,
  useAction,
  useOrigin,
  usePoll,
} from "./client";
import { ManagerView } from "./ManagerView";

type StaffState = Extract<AppState, { auth: "staff" }>;
type View =
  | { name: "today" }
  | { name: "new"; gameId: string | null }
  | { name: "picks" }
  | { name: "pick"; id: string }
  | { name: "manager" };

const POLL_MS = 4000;

export function BartenderApp() {
  const { data, failedSince, refresh } = usePoll<AppState>("/api/app/state", POLL_MS);

  if (!data) {
    return (
      <Centered>
        <p className="font-display text-2xl uppercase tracking-wide text-cream/70">
          {failedSince ? "Reconnecting…" : "Loading…"}
        </p>
      </Centered>
    );
  }
  if (data.auth === "none") return <SignIn onDone={refresh} />;
  if (data.auth === "device") {
    return <PinPad venueName={data.venueName} onDone={refresh} />;
  }
  return <Shell state={data} offline={failedSince !== null} refresh={refresh} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-charcoal p-5 text-cream">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function Logo() {
  return (
    <p className="font-display text-3xl font-bold uppercase tracking-wide">
      Pick <span className="text-gold">&amp;</span> Pour
    </p>
  );
}

/* ------------------------------ Sign-in ------------------------------ */

function SignIn({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"signin" | "setup">("signin");
  const { busy, error, run, clearError } = useAction();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    run(async () => {
      await post("/api/app/session", { action: mode, ...form });
      onDone();
    });
  };

  return (
    <Centered>
      <Logo />
      <h1 className="mt-6 font-display text-4xl font-bold uppercase">
        {mode === "signin" ? "Sign in this device" : "Set up your bar"}
      </h1>
      <p className="mt-2 text-cream/70">
        {mode === "signin"
          ? "Enter your venue passcode once. After that, staff unlock with a PIN."
          : "One time only. You'll need the setup code that came with your account."}
      </p>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        {mode === "setup" && (
          <>
            <Field label="Setup code" name="setupCode" type="password" />
            <Field label="Bar name" name="venueName" autoComplete="organization" />
            <Field label="Your name" name="managerName" autoComplete="name" />
          </>
        )}
        <Field
          label={mode === "setup" ? "Choose a venue passcode (6+ characters)" : "Venue passcode"}
          name="passcode"
          type="password"
        />
        {mode === "setup" && (
          <Field
            label="Choose your 4-digit manager PIN"
            name="pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
          />
        )}
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" disabled={busy}>
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create venue"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          clearError();
          setMode(mode === "signin" ? "setup" : "signin");
        }}
        className="mt-6 min-h-11 text-cream/70 underline underline-offset-4"
      >
        {mode === "signin" ? "First time? Set up a new venue" : "Back to sign in"}
      </button>
    </Centered>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <input id={name} name={name} required autoComplete="off" {...props} className={fieldClass} />
    </div>
  );
}

function PinPad({ venueName, onDone }: { venueName: string; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const { busy, error, run } = useAction();

  const press = (digit: string) => {
    if (busy || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      run(async () => {
        try {
          await post("/api/app/session", { action: "pin", pin: next });
          onDone();
        } finally {
          setPin("");
        }
      });
    }
  };

  return (
    <Centered>
      <Logo />
      <p className="mt-1 text-cream/70">{venueName}</p>
      <h1 className="mt-6 font-display text-4xl font-bold uppercase">Enter your PIN</h1>
      <div aria-label={`${pin.length} of 4 digits entered`} className="mt-5 flex gap-3">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`size-5 rounded-full border-2 border-cream/50 ${index < pin.length ? "bg-gold" : ""}`}
          />
        ))}
      </div>
      <div className="mt-4 min-h-14">
        <ErrorNote>{error}</ErrorNote>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <Button key={digit} variant="ghost" className="min-h-16 text-3xl" onClick={() => press(digit)}>
            {digit}
          </Button>
        ))}
        <Button
          variant="ghost"
          className="min-h-16 text-sm"
          onClick={() => post("/api/app/session", { action: "signout" }).then(onDone)}
        >
          Sign out
        </Button>
        <Button variant="ghost" className="min-h-16 text-3xl" onClick={() => press("0")}>
          0
        </Button>
        <Button variant="ghost" className="min-h-16 text-base" onClick={() => setPin(pin.slice(0, -1))}>
          Delete
        </Button>
      </div>
    </Centered>
  );
}

/* ------------------------------- Shell ------------------------------- */

function Shell({
  state,
  offline,
  refresh,
}: {
  state: StaffState;
  offline: boolean;
  refresh: () => void;
}) {
  const [view, setView] = useState<View>({ name: "today" });
  const featured = state.games.filter((game) => game.featured);
  const stale = featured.some((game) => game.stale);
  const active = state.picks.filter((pick) =>
    ["open", "locked", "settled"].includes(pick.status),
  ).length;
  const isManager = state.staff.role === "manager";

  const tabs: { view: View; label: string }[] = [
    { view: { name: "today" }, label: "Today" },
    { view: { name: "picks" }, label: active ? `Picks (${active})` : "Picks" },
    ...(isManager ? [{ view: { name: "manager" } as View, label: "Manager" }] : []),
  ];
  const currentTab = view.name === "new" ? "today" : view.name === "pick" ? "picks" : view.name;

  return (
    <div className="flex min-h-dvh flex-col bg-charcoal text-cream">
      <header className="sticky top-0 z-20 border-b border-cream/10 bg-charcoal/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold uppercase tracking-wide">
              {state.venue.name}
            </p>
            <p className="truncate text-sm text-cream/60">
              {state.staff.name} · {isManager ? "Manager" : "Bartender"}
            </p>
          </div>
          <Button
            variant="ghost"
            className="min-h-11 px-4 text-sm"
            onClick={() => post("/api/app/session", { action: "lock" }).then(refresh)}
          >
            Switch staff
          </Button>
        </div>
        {(offline || stale) && (
          <p role="status" className="bg-tomato px-4 py-2 text-center font-semibold">
            {offline
              ? "Reconnecting… numbers may be out of date."
              : "The line feed is stale. New picks and lock-ins are paused."}
          </p>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28">
        {view.name === "today" && <Today state={state} go={setView} />}
        {view.name === "new" && (
          <NewPick state={state} gameId={view.gameId} go={setView} refresh={refresh} />
        )}
        {view.name === "picks" && <Picks state={state} go={setView} />}
        {view.name === "pick" && (
          <PickDetail state={state} pickId={view.id} go={setView} refresh={refresh} />
        )}
        {view.name === "manager" && isManager && <ManagerView state={state} refresh={refresh} />}
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-cream/10 bg-charcoal-800"
      >
        <div className="mx-auto flex max-w-3xl">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              aria-current={currentTab === tab.view.name ? "page" : undefined}
              onClick={() => setView(tab.view)}
              className="min-h-16 flex-1 font-display text-lg font-semibold uppercase tracking-wide text-cream/60 aria-[current=page]:bg-charcoal-700 aria-[current=page]:text-gold"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function teamOf(game: GameView, side: Side) {
  return side === "home" ? game.home : game.away;
}

function windowsOf(games: GameView[]): { label: string; games: GameView[] }[] {
  const labels = [...new Set(games.map((game) => game.windowLabel))];
  return labels.map((label) => ({
    label,
    games: games.filter((game) => game.windowLabel === label),
  }));
}

/* ------------------------------- Today ------------------------------- */

function Today({ state, go }: { state: StaffState; go: (view: View) => void }) {
  const featured = state.games.filter((game) => game.featured);
  const anyOpen = featured.some((game) => game.entryOpen);

  return (
    <div className="grid gap-6">
      <Button
        className="min-h-20 w-full text-2xl"
        disabled={!anyOpen}
        onClick={() => go({ name: "new", gameId: null })}
      >
        + New pick
      </Button>

      {featured.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-cream/30 p-6 text-center">
          <p className="font-display text-2xl uppercase">No games featured yet</p>
          <p className="mt-2 text-cream/70">
            {state.manager
              ? "Open Manager → Games to start a demo slate and feature games."
              : "Ask a manager to feature today's games."}
          </p>
        </div>
      )}

      {windowsOf(featured).map((window) => (
        <section key={window.label}>
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold">
            {window.label} window
          </h2>
          <ul className="mt-2 grid gap-3">
            {window.games.map((game) => (
              <li key={game.id}>
                <button
                  type="button"
                  disabled={!game.entryOpen}
                  onClick={() => go({ name: "new", gameId: game.id })}
                  className="w-full rounded-3xl bg-charcoal-800 p-4 text-left active:bg-charcoal-700 disabled:opacity-70"
                >
                  <GameSummary game={game} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function GameSummary({ game }: { game: GameView }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-sm uppercase tracking-widest text-cream/60">
          {gameClockLabel(game)}
        </span>
        <span className="flex gap-2">
          {game.lockOpen && <Badge tone="gold">Lock-ins open</Badge>}
          {game.suspended && <Badge tone="tomato">Line paused</Badge>}
          {game.status !== "final" && !game.entryOpen && !game.suspended && (
            <Badge tone="muted">Picks closed</Badge>
          )}
        </span>
      </div>
      <div className="mt-2 grid gap-1">
        {(["away", "home"] as const).map((side) => {
          const team = teamOf(game, side);
          return (
            <div key={side} className="flex items-baseline justify-between gap-3">
              <span className="truncate font-display text-xl font-semibold uppercase">
                {team.name}
                {game.winner === side && <span className="text-gold"> ✓</span>}
              </span>
              <span className="flex shrink-0 items-baseline gap-4 tabular-nums">
                {team.line && game.status !== "final" && (
                  <span className="text-cream/70">
                    {team.line} · {pct(team.p ?? 0)}
                  </span>
                )}
                <span className="w-8 text-right font-display text-2xl font-bold">
                  {team.score}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Badge({ tone, children }: { tone: "gold" | "tomato" | "muted"; children: React.ReactNode }) {
  const tones = {
    gold: "bg-gold text-charcoal",
    tomato: "bg-tomato text-cream",
    muted: "bg-charcoal-600 text-cream/80",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ------------------------------ New pick ------------------------------ */

function NewPick({
  state,
  gameId,
  go,
  refresh,
}: {
  state: StaffState;
  gameId: string | null;
  go: (view: View) => void;
  refresh: () => void;
}) {
  const [chosenGame, setChosenGame] = useState(gameId);
  const [side, setSide] = useState<Side | null>(null);
  const { busy, error, run } = useAction();
  const game = state.games.find((item) => item.id === chosenGame);
  const open = state.games.filter((item) => item.featured && item.entryOpen);

  if (!game) {
    return (
      <Step title="1. Choose the game" onBack={() => go({ name: "today" })}>
        {open.length === 0 && <p className="text-cream/70">No games are open for picks right now.</p>}
        <ul className="grid gap-3">
          {open.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setChosenGame(item.id)}
                className="w-full rounded-3xl bg-charcoal-800 p-4 text-left active:bg-charcoal-700"
              >
                <GameSummary game={item} />
              </button>
            </li>
          ))}
        </ul>
      </Step>
    );
  }

  if (!side) {
    return (
      <Step
        title="2. Choose the side"
        onBack={() => (gameId ? go({ name: "today" }) : setChosenGame(null))}
      >
        <p className="text-cream/70">{gameClockLabel(game)}</p>
        {!game.entryOpen && (
          <ErrorNote>
            {game.suspended
              ? "The line is paused for a play under review. One moment."
              : "This game is closed for new picks."}
          </ErrorNote>
        )}
        <div className="grid gap-3">
          {(["away", "home"] as const).map((option) => {
            const team = teamOf(game, option);
            return (
              <button
                key={option}
                type="button"
                disabled={!game.entryOpen || team.p === null}
                onClick={() => setSide(option)}
                className="rounded-3xl border-2 border-cream/20 bg-charcoal-800 p-5 text-left active:border-gold disabled:opacity-50"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-2xl font-bold uppercase">{team.name}</span>
                  <span className="tabular-nums text-cream/70">
                    {team.line} · {pct(team.p ?? 0)}
                  </span>
                </span>
                <span className="mt-2 block font-display text-4xl font-bold text-gold">
                  {pct(winDiscount(state.venue.limits, team.p ?? 1))} off if they win
                </span>
              </button>
            );
          })}
        </div>
      </Step>
    );
  }

  const team = teamOf(game, side);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run(async () => {
      const result = await post<{ pickId: string }>("/api/app/picks", {
        action: "create",
        gameId: game.id,
        side,
        tabLabel: String(form.get("tabLabel") ?? ""),
        seat: String(form.get("seat") ?? ""),
        subtotalCents: dollarsToCents(String(form.get("subtotal") ?? "")),
      });
      refresh();
      go({ name: "pick", id: result.pickId });
    });
  };

  return (
    <Step title="3. Label the tab" onBack={() => setSide(null)}>
      <div className="rounded-3xl bg-charcoal-800 p-4">
        <p className="font-display text-2xl font-bold uppercase">{team.name}</p>
        <p className="text-cream/70">
          {team.line} · {pct(team.p ?? 0)} ·{" "}
          <span className="font-semibold text-gold">
            {pct(winDiscount(state.venue.limits, team.p ?? 1))} off if they win
          </span>
        </p>
      </div>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Guest first name" name="tabLabel" autoFocus maxLength={60} />
          <Field label="Seat" name="seat" required={false} inputMode="numeric" maxLength={12} />
        </div>
        <Field
          label="Tab so far, if any ($)"
          name="subtotal"
          required={false}
          inputMode="decimal"
          placeholder="0.00"
        />
        <p className="text-sm text-cream/60">
          Only spend after this pick counts, up to {formatCents(state.venue.settings.maxCoveredCents)}.
        </p>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="min-h-16 text-xl" disabled={busy}>
          {busy ? "Saving…" : "Confirm pick"}
        </Button>
      </form>
    </Step>
  );
}

function Step({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="min-h-11 px-4 text-sm" onClick={onBack}>
          ← Back
        </Button>
        <h1 className="font-display text-2xl font-bold uppercase">{title}</h1>
      </div>
      {children}
    </div>
  );
}

/* -------------------------------- Picks -------------------------------- */

/** One line that says where a pick stands. */
function pickStatusText(pick: PickView): { text: string; tone: "gold" | "muted" | "plain" } {
  if (pick.status === "open") {
    return pick.lockValue !== null && pick.lockValue >= 0.005
      ? { text: `Lock-in now ${pct(pick.lockValue)}`, tone: "plain" }
      : { text: "Full price if locked now", tone: "muted" };
  }
  if (pick.status === "locked") return { text: `Locked ${pct(pick.dFinal ?? 0)} · apply`, tone: "gold" };
  if (pick.status === "settled") {
    return (pick.dFinal ?? 0) > 0
      ? { text: `Won ${pct(pick.dFinal ?? 0)} off · apply`, tone: "gold" }
      : { text: "Full price · close out", tone: "muted" };
  }
  if (pick.status === "applied") {
    return {
      text: pick.discountCents ? `${formatCents(pick.discountCents)} applied` : "Closed at full price",
      tone: "muted",
    };
  }
  return { text: "Void", tone: "muted" };
}

function Picks({ state, go }: { state: StaffState; go: (view: View) => void }) {
  const [filter, setFilter] = useState("all");
  const gamesWithPicks = state.games.filter((game) =>
    state.picks.some((pick) => pick.gameId === game.id),
  );
  const visible = state.picks.filter((pick) => filter === "all" || pick.gameId === filter);
  const active = visible.filter((pick) => ["open", "locked", "settled"].includes(pick.status));
  const done = visible.filter((pick) => ["applied", "void"].includes(pick.status));

  return (
    <div className="grid gap-5">
      <div>
        <label htmlFor="game-filter" className={labelClass}>
          Game
        </label>
        <select
          id="game-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className={fieldClass}
        >
          <option value="all">All games</option>
          {gamesWithPicks.map((game) => (
            <option key={game.id} value={game.id}>
              {game.away.name} at {game.home.name}
            </option>
          ))}
        </select>
      </div>

      {active.length === 0 && (
        <p className="rounded-3xl border-2 border-dashed border-cream/30 p-6 text-center text-cream/70">
          No active picks. Tap Today, then New pick.
        </p>
      )}

      {gamesWithPicks
        .filter((game) => active.some((pick) => pick.gameId === game.id))
        .map((game) => (
          <section key={game.id}>
            <h2 className="flex items-baseline justify-between gap-3 font-display text-lg font-semibold uppercase">
              <span className="truncate">
                {game.away.abbr} {game.away.score} · {game.home.abbr} {game.home.score}
              </span>
              <span className="shrink-0 text-sm tracking-widest text-cream/60">
                {gameClockLabel(game)}
              </span>
            </h2>
            <ul className="mt-2 grid gap-2">
              {active
                .filter((pick) => pick.gameId === game.id)
                .map((pick) => (
                  <PickRow key={pick.id} pick={pick} game={game} go={go} />
                ))}
            </ul>
          </section>
        ))}

      {done.length > 0 && (
        <details className="rounded-3xl bg-charcoal-800 p-4">
          <summary className="min-h-11 cursor-pointer font-display text-lg uppercase tracking-wide text-cream/70">
            Finished ({done.length})
          </summary>
          <ul className="mt-2 grid gap-2">
            {done.map((pick) => (
              <PickRow
                key={pick.id}
                pick={pick}
                game={state.games.find((game) => game.id === pick.gameId)}
                go={go}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function PickRow({
  pick,
  game,
  go,
}: {
  pick: PickView;
  game: GameView | undefined;
  go: (view: View) => void;
}) {
  const status = pickStatusText(pick);
  const tones = { gold: "text-gold", muted: "text-cream/60", plain: "text-cream" };
  return (
    <li>
      <button
        type="button"
        onClick={() => go({ name: "pick", id: pick.id })}
        className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl bg-charcoal-700 px-4 py-2 text-left active:bg-charcoal-600"
      >
        <span className="min-w-0">
          <span className="block truncate font-display text-xl font-semibold uppercase">
            {pick.tabLabel}
            {pick.seat && <span className="text-cream/60"> · seat {pick.seat}</span>}
          </span>
          <span className="block truncate text-sm text-cream/70">
            {game ? teamOf(game, pick.side).name : "Game"} {pick.entryLine} · {pct(pick.dWin)} if
            they win
          </span>
        </span>
        <span className={`shrink-0 text-right font-semibold ${tones[status.tone]}`}>
          {status.text}
        </span>
      </button>
    </li>
  );
}

/* ----------------------------- Pick detail ----------------------------- */

function PickDetail({
  state,
  pickId,
  go,
  refresh,
}: {
  state: StaffState;
  pickId: string;
  go: (view: View) => void;
  refresh: () => void;
}) {
  const pick = state.picks.find((item) => item.id === pickId);
  const game = pick ? state.games.find((item) => item.id === pick.gameId) : undefined;
  const [confirming, setConfirming] = useState<"lock" | "close" | "void" | null>(null);
  const [subtotal, setSubtotal] = useState("");
  const [showQr, setShowQr] = useState(true);
  const { busy, error, run } = useAction();
  const origin = useOrigin();

  if (!pick) {
    return (
      <Step title="Pick" onBack={() => go({ name: "picks" })}>
        <p className="text-cream/70">Loading this pick…</p>
      </Step>
    );
  }

  const act = (action: string, extra: Record<string, unknown> = {}) =>
    run(async () => {
      await post("/api/app/picks", { action, pickId: pick.id, ...extra });
      setConfirming(null);
      refresh();
    });

  const team = game ? teamOf(game, pick.side) : null;
  const status = pickStatusText(pick);
  const canLock = Boolean(game?.lockOpen) && (pick.lockValue ?? 0) >= 0.005;
  const lockHint = !game
    ? ""
    : game.status !== "live"
      ? "Lock-ins open at the first break."
      : game.suspended
        ? "The line is paused for a play under review."
        : !game.lockOpen
          ? "Lock-ins open at the next break."
          : (pick.lockValue ?? 0) < 0.005
            ? "The line has moved against this pick, so there is nothing to lock in."
            : "";

  const subtotalCents = dollarsToCents(subtotal);
  const covered = coveredSpendCents(
    subtotalCents,
    pick.subtotalAtPickCents,
    state.venue.settings.maxCoveredCents,
  );
  const discount = discountCents(pick.dFinal ?? 0, covered);
  const fullPrice = (pick.dFinal ?? 0) <= 0;
  const guestUrl = origin ? `${origin}/p/${pick.guestToken}` : "";

  return (
    <Step title={pick.tabLabel + (pick.seat ? ` · seat ${pick.seat}` : "")} onBack={() => go({ name: "picks" })}>
      <div className="rounded-3xl bg-charcoal-800 p-5">
        <p className="font-display text-sm uppercase tracking-widest text-cream/60">
          {game ? `${game.away.abbr} ${game.away.score} · ${game.home.abbr} ${game.home.score} · ${gameClockLabel(game)}` : "Game"}
        </p>
        <p className="mt-1 font-display text-3xl font-bold uppercase">{team?.name ?? "Pick"}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Entry line" value={`${pick.entryLine} · ${pct(pick.pEntry)}`} />
          <Stat label="If they win" value={`${pct(pick.dWin)} off`} highlight />
          <Stat label="Status" value={status.text} />
          <Stat label="Taken by" value={pick.staffName ?? "—"} />
        </dl>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {pick.undoUntil && (
        <Button variant="ghost" disabled={busy} onClick={() => act("undo")}>
          Undo {pick.status === "locked" ? "lock-in" : "pick"} (30 seconds)
        </Button>
      )}

      {pick.status === "open" && confirming === null && (
        <div className="grid gap-3">
          <Button
            variant="gold"
            className="min-h-20 text-2xl"
            disabled={!canLock || busy}
            onClick={() => setConfirming("lock")}
          >
            {canLock ? `Lock in ${pct(pick.lockValue ?? 0)}` : "Lock in"}
          </Button>
          {lockHint && <p className="text-center text-cream/70">{lockHint}</p>}
          <Button variant="ghost" disabled={busy} onClick={() => setConfirming("close")}>
            Guest leaving? Close out at full price
          </Button>
        </div>
      )}

      {confirming === "lock" && (
        <Confirm
          title={`Freeze ${pct(pick.lockValue ?? 0)} off for ${pick.tabLabel}?`}
          body="The pick stops here. They keep this discount whatever happens next."
          yes="Confirm lock-in"
          busy={busy}
          onYes={() => act("lock")}
          onNo={() => setConfirming(null)}
        />
      )}
      {confirming === "close" && (
        <Confirm
          title="Close this pick at full price?"
          body="Use this when a guest leaves mid-game without locking in."
          yes="Close at full price"
          busy={busy}
          onYes={() => act("close")}
          onNo={() => setConfirming(null)}
        />
      )}

      {(pick.status === "locked" || pick.status === "settled") && (
        <div className="grid gap-4 rounded-3xl border-2 border-gold/60 p-5">
          {fullPrice ? (
            <>
              <p className="font-display text-5xl font-bold uppercase">Full price</p>
              <p className="text-cream/70">
                {pick.result === "closed"
                  ? "Closed out before the game ended."
                  : "Their side didn't win. Ring the tab as usual."}
              </p>
              <Button disabled={busy} onClick={() => act("apply", { subtotalCents: 0 })}>
                Mark closed
              </Button>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="subtotal" className={labelClass}>
                  Tab subtotal now ($)
                </label>
                <input
                  id="subtotal"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={subtotal}
                  onChange={(event) => setSubtotal(event.target.value)}
                  className={fieldClass}
                />
              </div>
              <dl className="grid grid-cols-3 gap-3">
                <Stat label="Covered spend" value={formatCents(covered)} />
                <Stat label="Discount" value={pct(pick.dFinal ?? 0)} />
                <Stat label="Take off" value={formatCents(discount)} highlight />
              </dl>
              <p className="text-sm text-cream/60">
                Before tax. Covers spend after the pick
                {pick.subtotalAtPickCents > 0 && ` (${formatCents(pick.subtotalAtPickCents)} was on the tab)`}
                , up to {formatCents(state.venue.settings.maxCoveredCents)}. Suggest the tip on the
                full amount.
              </p>
              <Button
                className="min-h-16 text-xl"
                disabled={busy || subtotalCents <= 0}
                onClick={() => act("apply", { subtotalCents })}
              >
                Mark applied in POS
              </Button>
            </>
          )}
        </div>
      )}

      {pick.status === "applied" && (
        <div className="rounded-3xl bg-charcoal-800 p-5">
          <p className="font-display text-3xl font-bold uppercase text-gold">
            {pick.discountCents ? `${formatCents(pick.discountCents)} applied` : "Closed at full price"}
          </p>
          {pick.discountCents ? (
            <p className="mt-1 text-cream/70">
              {pct(pick.dFinal ?? 0)} off {formatCents(pick.coveredCents ?? 0)} covered spend.
            </p>
          ) : null}
        </div>
      )}

      {pick.status !== "void" && pick.status !== "applied" && (
        <div className="rounded-3xl bg-charcoal-800 p-5">
          <button
            type="button"
            onClick={() => setShowQr(!showQr)}
            className="min-h-11 font-display text-lg uppercase tracking-wide text-cream/80"
          >
            Guest QR code {showQr ? "▾" : "▸"}
          </button>
          {showQr && guestUrl && (
            <div className="mt-2 flex items-center gap-4">
              <Qr value={guestUrl} className="size-36 shrink-0" />
              <p className="text-cream/70">
                The guest scans this to follow their own pick on their phone.
              </p>
            </div>
          )}
        </div>
      )}

      {state.staff.role === "manager" && pick.status !== "void" && confirming === null && (
        <Button variant="danger" disabled={busy} onClick={() => setConfirming("void")}>
          Void this pick
        </Button>
      )}
      {confirming === "void" && (
        <Confirm
          title="Void this pick?"
          body="It is removed from the game and logged. This can't be undone."
          yes="Void pick"
          busy={busy}
          onYes={() => act("void")}
          onNo={() => setConfirming(null)}
        />
      )}
    </Step>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-cream/60">{label}</dt>
      <dd className={`font-display text-xl font-semibold tabular-nums ${highlight ? "text-gold" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function Confirm({
  title,
  body,
  yes,
  busy,
  onYes,
  onNo,
}: {
  title: string;
  body: string;
  yes: string;
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div role="alertdialog" aria-label={title} className="grid gap-3 rounded-3xl border-2 border-gold p-5">
      <p className="font-display text-2xl font-bold uppercase">{title}</p>
      <p className="text-cream/70">{body}</p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="ghost" disabled={busy} onClick={onNo}>
          Cancel
        </Button>
        <Button variant="gold" disabled={busy} onClick={onYes}>
          {busy ? "Saving…" : yes}
        </Button>
      </div>
    </div>
  );
}
