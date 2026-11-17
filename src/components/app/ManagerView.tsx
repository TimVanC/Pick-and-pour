"use client";

import { useState, type FormEvent } from "react";
import {
  formatCents,
  gameClockLabel,
  type AppState,
  type ReportView,
} from "@/lib/app-types";
import { JURISDICTIONS, jurisdiction, maxCap, type JurisdictionCode } from "@/lib/discount";
import {
  Button,
  ErrorNote,
  dollarsToCents,
  fieldClass,
  labelClass,
  pct,
  post,
  useAction,
  usePoll,
} from "./client";

type StaffState = Extract<AppState, { auth: "staff" }>;
type Tab = "games" | "settings" | "staff" | "report";

const TABS: { id: Tab; label: string }[] = [
  { id: "games", label: "Games" },
  { id: "settings", label: "Settings" },
  { id: "staff", label: "Staff" },
  { id: "report", label: "Report" },
];

const CUTOFFS = [
  { value: 0, label: "Before kickoff only" },
  { value: 1, label: "Until the end of Q1" },
  { value: 2, label: "Until halftime" },
  { value: 3, label: "Until the end of Q3" },
  { value: 4, label: "Any time before the final whistle" },
];

export function ManagerView({ state, refresh }: { state: StaffState; refresh: () => void }) {
  const [tab, setTab] = useState<Tab>("games");
  return (
    <div className="grid gap-5">
      <div role="tablist" aria-label="Manager sections" className="grid grid-cols-4 gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className="min-h-14 rounded-2xl border-2 border-cream/20 font-display text-base font-semibold uppercase tracking-wide text-cream/70 aria-selected:border-gold aria-selected:bg-gold aria-selected:text-charcoal"
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "games" && <Games state={state} refresh={refresh} />}
      {tab === "settings" && <Settings state={state} refresh={refresh} />}
      {tab === "staff" && <Staff state={state} refresh={refresh} />}
      {tab === "report" && <Report />}
    </div>
  );
}

function useManagerAction(refresh: () => void) {
  const action = useAction();
  const send = (payload: Record<string, unknown>) =>
    action.run(async () => {
      await post("/api/app/manager", payload);
      refresh();
    });
  return { ...action, send };
}

/* -------------------------------- Games -------------------------------- */

function Games({ state, refresh }: { state: StaffState; refresh: () => void }) {
  const { busy, error, send, run } = useManagerAction(refresh);
  // Games that can still be featured, plus the ones on the board now.
  const schedule = state.games.filter((game) => game.featured || game.status !== "final");
  const windows = [...new Set(schedule.map((game) => game.windowLabel))];
  const lockWindowUntil = state.venue.settings.lockWindowUntil;
  const windowOpen =
    lockWindowUntil !== null &&
    new Date(lockWindowUntil).getTime() > new Date(state.serverTime).getTime();
  const tvPath = state.manager ? `/tv/${state.manager.tvToken}` : "";

  return (
    <div className="grid gap-6">
      <ErrorNote>{error}</ErrorNote>

      {state.manager?.canSimulate && (
        <div className="rounded-3xl bg-charcoal-800 p-5">
          <h2 className="font-display text-2xl font-bold uppercase">Demo game day</h2>
          <p className="mt-1 text-cream/70">
            Starts six made-up games that play themselves in about ten minutes each: three kick
            off in a minute, then a late window and a night game. These are not real games.
          </p>
          <Button className="mt-4 w-full" disabled={busy} onClick={() => send({ action: "newSlate" })}>
            Start a new demo slate
          </Button>
        </div>
      )}

      {state.manager && state.manager.replaySundays.length > 0 && (
        <ReplayCard sundays={state.manager.replaySundays} busy={busy} send={send} />
      )}

      {state.venue.settings.posProvider === "mock-toast" && (
        <div className="rounded-3xl bg-charcoal-800 p-5">
          <h2 className="font-display text-2xl font-bold uppercase">Mock POS</h2>
          <p className="mt-1 text-cream/70">
            Opens six sample tabs in the stand-in POS, each with a first drink, so there are open
            checks to attach picks to.
          </p>
          <Button
            variant="ghost"
            className="mt-4 w-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await post("/api/app/pos", { action: "seed" });
                refresh();
              })
            }
          >
            Open sample tabs
          </Button>
        </div>
      )}

      <div className="rounded-3xl bg-charcoal-800 p-5">
        <h2 className="font-display text-2xl font-bold uppercase">TV board</h2>
        <p className="mt-1 text-cream/70">
          Open this link on the bar TV. Anyone with the link can see the board, so keep it to
          your own screens.
        </p>
        <a
          href={tvPath}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-gold px-5 font-display text-lg font-semibold uppercase tracking-wide text-charcoal"
        >
          Open the TV board
        </a>
      </div>

      <div className="rounded-3xl bg-charcoal-800 p-5">
        <h2 className="font-display text-2xl font-bold uppercase">Lock-in window</h2>
        <p className="mt-1 text-cream/70">
          Lock-ins open by themselves at every break. Open a window by hand if you need one in
          between.
        </p>
        <Button
          variant={windowOpen ? "danger" : "ghost"}
          className="mt-4 w-full"
          disabled={busy}
          onClick={() => send({ action: "lockWindow", minutes: windowOpen ? 0 : 5 })}
        >
          {windowOpen ? "Close the window now" : "Open lock-ins for 5 minutes"}
        </Button>
      </div>

      {windows.length === 0 && (
        <p className="text-cream/70">No games on the schedule. Start a demo slate above.</p>
      )}

      {windows.map((label) => (
        <section key={label}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold">
              {label} window
            </h2>
            <Button
              variant="ghost"
              className="min-h-11 px-4 text-sm"
              disabled={busy}
              onClick={() => send({ action: "featureWindow", windowLabel: label })}
            >
              Feature all
            </Button>
          </div>
          <ul className="mt-2 grid gap-2">
            {schedule
              .filter((game) => game.windowLabel === label)
              .map((game) => (
                <li key={game.id}>
                  <label className="flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-charcoal-700 px-4 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-display text-lg font-semibold uppercase">
                        {game.away.name} at {game.home.name}
                      </span>
                      <span className="block text-sm text-cream/60">{gameClockLabel(game)}</span>
                    </span>
                    <input
                      type="checkbox"
                      className="size-11 shrink-0 accent-gold"
                      checked={game.featured}
                      disabled={busy || game.status === "final"}
                      onChange={(event) =>
                        send({ action: "feature", gameId: game.id, featured: event.target.checked })
                      }
                      aria-label={`Feature ${game.away.name} at ${game.home.name}`}
                    />
                  </label>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const REPLAY_SPEEDS = [
  { value: 10, label: "10× (a game takes about 20 minutes)" },
  { value: 30, label: "30× (a game takes about 6 minutes)" },
  { value: 60, label: "60× (a game takes about 3 minutes)" },
];

/** Start a replay of a recorded NFL Sunday. */
function ReplayCard({
  sundays,
  busy,
  send,
}: {
  sundays: { date: string; games: number; source: string }[];
  busy: boolean;
  send: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [date, setDate] = useState(sundays[0].date);
  const [speed, setSpeed] = useState(30);
  const real = sundays[0].source === "kalshi";
  return (
    <div className="rounded-3xl bg-charcoal-800 p-5">
      <h2 className="font-display text-2xl font-bold uppercase">Replay a past Sunday</h2>
      <p className="mt-1 text-cream/70">
        {real
          ? "Plays a past NFL Sunday back as if it were live, using the recorded minute-by-minute win chances from Kalshi's public market data and the real quarter breaks. For testing only."
          : "Plays back generated game days in the same shape as recorded ones. These are not real games."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="replay-date" className={labelClass}>
            Sunday
          </label>
          <select
            id="replay-date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={fieldClass}
          >
            {sundays.map((sunday) => (
              <option key={sunday.date} value={sunday.date}>
                {sunday.date} ({sunday.games} games)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="replay-speed" className={labelClass}>
            Speed
          </label>
          <select
            id="replay-speed"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            className={fieldClass}
          >
            {REPLAY_SPEEDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-2 text-sm text-cream/60">
        At faster speeds the quarter breaks pass in seconds. Use 10× to practise lock-ins, or
        open a lock-in window by hand.
      </p>
      <Button
        className="mt-4 w-full"
        disabled={busy}
        onClick={() => send({ action: "newReplay", date, speed })}
      >
        Start the replay
      </Button>
    </div>
  );
}

/* ------------------------------- Settings ------------------------------- */

function Settings({ state, refresh }: { state: StaffState; refresh: () => void }) {
  const { busy, error, send } = useManagerAction(refresh);
  const settings = state.venue.settings;
  const [code, setCode] = useState(state.venue.jurisdictionCode);
  const [scale, setScale] = useState(settings.scale);
  const [cap, setCap] = useState(settings.cap);
  const [maxCovered, setMaxCovered] = useState((settings.maxCoveredCents / 100).toFixed(0));
  const [cutoff, setCutoff] = useState(settings.lateCutoffPeriod);
  const [posProvider, setPosProvider] = useState(settings.posProvider);
  const [saved, setSaved] = useState(false);
  const profile = jurisdiction(code);
  // A connected POS carries item costs, which lets New Jersey use the higher cap.
  const costFloors = posProvider !== "manual";
  const highestCap = maxCap(profile, costFloors);

  const save = async () => {
    setSaved(false);
    const ok = await send({
      action: "settings",
      jurisdictionCode: code,
      scale,
      cap,
      maxCoveredCents: dollarsToCents(maxCovered),
      lateCutoffPeriod: cutoff,
      posProvider,
    });
    setSaved(ok);
  };

  return (
    <div className="grid gap-5">
      <ErrorNote>{error}</ErrorNote>

      <div>
        <label htmlFor="jurisdiction" className={labelClass}>
          Jurisdiction
        </label>
        <select
          id="jurisdiction"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={fieldClass}
        >
          {(Object.keys(JURISDICTIONS) as JurisdictionCode[]).map((key) => (
            <option key={key} value={key}>
              {JURISDICTIONS[key].name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-cream/60">{profile.rulesText}</p>
      </div>

      {/* A profile only shows the limits it leaves editable. */}
      {!profile.scaleLocked && (
        <Slider
          id="scale"
          label="Scale (house multiplier)"
          value={Math.min(profile.scaleMax, Math.max(profile.scaleMin, scale))}
          min={profile.scaleMin}
          max={profile.scaleMax}
          step={0.05}
          display={scale.toFixed(2)}
          onChange={setScale}
          hint="Lower it to bring the average discount down. 0.75 is the default."
        />
      )}
      {!profile.capLocked && (
        <Slider
          id="cap"
          label="Cap (biggest discount)"
          value={Math.min(highestCap, cap)}
          min={0.2}
          max={highestCap}
          step={0.05}
          display={pct(Math.min(highestCap, cap))}
          onChange={setCap}
          hint={
            costFloors && profile.itemLimit === "cost"
              ? `No pick can pay more than this. With item costs from the POS, ${profile.name} allows up to ${pct(highestCap)}, and no item is ever discounted below its cost.`
              : `No pick can pay more than this. ${profile.name} allows up to ${pct(highestCap)}.`
          }
        />
      )}
      {profile.scaleLocked && profile.capLocked && (
        <p className="rounded-2xl bg-charcoal-800 p-4 text-cream/80">
          {profile.name} fixes the scale at {profile.scaleDefault} and the cap at{" "}
          {pct(profile.cap)}, so there is nothing to adjust here.
        </p>
      )}

      <div>
        <label htmlFor="pos" className={labelClass}>
          Tabs come from
        </label>
        <select
          id="pos"
          value={posProvider}
          onChange={(event) => setPosProvider(event.target.value as typeof posProvider)}
          className={fieldClass}
        >
          <option value="manual">Typed in by the bartender</option>
          <option value="mock-toast">Toast open checks (mock POS for testing)</option>
        </select>
        <p className="mt-2 text-sm text-cream/60">
          {posProvider === "manual"
            ? "The bartender types a name and the tab subtotal, and applies the discount in the POS by hand."
            : "Open checks appear in New pick, and the discount is worked out item by item and posted to the check. This is a stand-in for Toast with a made-up menu, not a live connection."}
        </p>
      </div>

      <div>
        <label htmlFor="max-covered" className={labelClass}>
          Most spend a pick covers ($)
        </label>
        <input
          id="max-covered"
          inputMode="numeric"
          value={maxCovered}
          onChange={(event) => setMaxCovered(event.target.value)}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="cutoff" className={labelClass}>
          New picks allowed
        </label>
        <select
          id="cutoff"
          value={cutoff}
          onChange={(event) => setCutoff(Number(event.target.value))}
          className={fieldClass}
        >
          {CUTOFFS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-cream/60">One active pick per tab, and never both sides of a game.</p>

      <Button disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save settings"}
      </Button>
      {saved && (
        <p role="status" className="text-center font-semibold text-gold">
          Saved. New picks use these settings; existing picks keep theirs.
        </p>
      )}
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <output htmlFor={id} className="font-display text-3xl font-bold tabular-nums text-gold">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-10 w-full accent-gold"
      />
      <p className="text-sm text-cream/60">{hint}</p>
    </div>
  );
}

/* --------------------------------- Staff --------------------------------- */

function Staff({ state, refresh }: { state: StaffState; refresh: () => void }) {
  const { busy, error, send } = useManagerAction(refresh);

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await send({
      action: "addStaff",
      name: String(data.get("name") ?? ""),
      role: String(data.get("role") ?? "bartender"),
      pin: String(data.get("pin") ?? ""),
    });
    if (ok) form.reset();
  };

  return (
    <div className="grid gap-5">
      <ErrorNote>{error}</ErrorNote>
      <ul className="grid gap-2">
        {state.manager?.staff.map((member) => (
          <li
            key={member.id}
            className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-charcoal-700 px-4 py-2"
          >
            <span>
              <span className="block font-display text-lg font-semibold uppercase">{member.name}</span>
              <span className="block text-sm capitalize text-cream/60">{member.role}</span>
            </span>
            {member.id !== state.staff.id && (
              <Button
                variant="danger"
                className="min-h-11 px-4 text-sm"
                disabled={busy}
                onClick={() => send({ action: "removeStaff", staffId: member.id })}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="grid gap-4 rounded-3xl bg-charcoal-800 p-5">
        <h2 className="font-display text-2xl font-bold uppercase">Add a staff member</h2>
        <div>
          <label htmlFor="staff-name" className={labelClass}>
            Name
          </label>
          <input id="staff-name" name="name" required maxLength={40} className={fieldClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="staff-role" className={labelClass}>
              Role
            </label>
            <select id="staff-role" name="role" className={fieldClass}>
              <option value="bartender">Bartender</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label htmlFor="staff-pin" className={labelClass}>
              4-digit PIN
            </label>
            <input
              id="staff-pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              required
              autoComplete="off"
              className={fieldClass}
            />
          </div>
        </div>
        <Button type="submit" disabled={busy}>
          Add
        </Button>
      </form>
    </div>
  );
}

/* --------------------------------- Report --------------------------------- */

function Report() {
  const [date, setDate] = useState("");
  const query = date ? `?date=${date}` : "";
  const { data } = usePoll<ReportView>(`/api/app/manager${query}`, 15000);

  return (
    <div className="grid gap-5">
      <div>
        <label htmlFor="report-date" className={labelClass}>
          Game day
        </label>
        <input
          id="report-date"
          type="date"
          value={date || data?.date || ""}
          onChange={(event) => setDate(event.target.value)}
          className={fieldClass}
        />
      </div>

      {!data ? (
        <p className="text-cream/70">Loading the report…</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <Metric label="Picks" value={String(data.picks)} />
            <Metric label="Players" value={String(data.players)} />
            <Metric label="Covered spend" value={formatCents(data.coveredCents)} />
            <Metric label="Discounts given" value={formatCents(data.discountCents)} />
            <Metric
              label="Average discount"
              value={data.averageDiscount === null ? "—" : pct(data.averageDiscount)}
            />
            <Metric
              label="Pick to settle"
              value={data.minutesToSettle === null ? "—" : `${data.minutesToSettle} min`}
            />
            <Metric label="Won" value={String(data.won)} />
            <Metric label="Full price" value={String(data.lost)} />
            <Metric label="Locked in" value={String(data.locked)} />
            <Metric label="Still open" value={String(data.open)} />
          </dl>
          {data.voided > 0 && <p className="text-cream/60">{data.voided} voided, not counted above.</p>}
          <a
            href={`/api/app/manager?date=${data.date}&format=csv`}
            className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-cream/30 px-5 font-display text-lg font-semibold uppercase tracking-wide"
          >
            Download CSV
          </a>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-charcoal-800 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-cream/60">{label}</dt>
      <dd className="font-display text-3xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
