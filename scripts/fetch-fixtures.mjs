#!/usr/bin/env node
/**
 * fetch-fixtures.mjs
 *
 * Builds cached fixtures of NFL Sunday games for the toast mock:
 *   fixtures/kalshi/index.json
 *   fixtures/kalshi/games/<date>-<AWAY>-<HOME>.json
 *
 * Sources (all public, no credentials):
 *   - Kalshi market data API: 1-minute candlesticks of the KXNFLGAME "will TEAM win" markets
 *     (home-team win probability).
 *   - nflverse play-by-play (time_of_day per play): real kickoff, quarter starts/ends, breaks,
 *     per-minute score/period/clock.
 *   - nflverse schedule (games.csv): which games were played on a Sunday, kickoff window, final score.
 *
 * Usage:
 *   node scripts/fetch-fixtures.mjs                 real data, last 4 completed Sundays
 *   node scripts/fetch-fixtures.mjs --sundays 3     how many Sundays
 *   node scripts/fetch-fixtures.mjs --anchor 2026-11-15   newest Sunday to consider
 *   node scripts/fetch-fixtures.mjs --synthetic     no network; deterministic generated games
 *   node scripts/fetch-fixtures.mjs --seed foo      seed for anything generated
 *
 * If a source is unreachable the script falls back (per game, or for everything) to generated data
 * and says so in index.json "notes" and in each game's "source" / "breaksSource".
 *
 * Node 22 built-ins only. All times are epoch seconds (UTC).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KALSHI = 'https://api.elections.kalshi.com/trade-api/v2';
const SERIES = 'KXNFLGAME';
const GAMES_CSV = 'https://github.com/nflverse/nfldata/raw/master/data/games.csv';
const pbpUrl = (season) =>
  `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_${season}.csv.gz`;
/** Fixed newest Sunday for `--synthetic`, so re-runs always produce identical game files. */
const SYNTH_ANCHOR = '2026-11-15';
const MAX_CANDLES_PER_CALL = 4500; // API limit is 5000 periods per request
const SIGMA = 13.45; // std dev of NFL final margin vs. the spread, used by the synthetic model

/** nflverse abbreviations -> full names. */
const TEAMS = {
  ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys', DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
  HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs',
  LA: 'Los Angeles Rams', LAC: 'Los Angeles Chargers', LV: 'Las Vegas Raiders', MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
  NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers', TB: 'Tampa Bay Buccaneers', TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
};
/** Kalshi ticker codes that differ from nflverse. (Observed: LAR, JAC. The rest are defensive.) */
const KALSHI_TO_NFLVERSE = { LAR: 'LA', JAC: 'JAX', WSH: 'WAS', LVR: 'LV', GNB: 'GB', KAN: 'KC', NWE: 'NE', NOR: 'NO', SFO: 'SF', TAM: 'TB' };
const NFLVERSE_TO_KALSHI = { LA: 'LAR', JAX: 'JAC' };
const toNflverse = (code) => KALSHI_TO_NFLVERSE[code] ?? code;
const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

// ----------------------------------------------------------------------------------------------
// small helpers
// ----------------------------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round3 = (x) => Math.round(x * 1000) / 1000;
const log = (...a) => console.log(...a);
const warn = (...a) => console.warn('[warn]', ...a);

function parseArgs(argv) {
  const a = { sundays: 4, synthetic: false, anchor: null, seed: 'pick-and-pour', out: path.join(ROOT, 'fixtures', 'kalshi') };
  for (let i = 0; i < argv.length; i++) {
    let [k, v] = argv[i].split('=');
    const val = () => (v !== undefined ? v : argv[++i]);
    if (k === '--synthetic') a.synthetic = true;
    else if (k === '--sundays') a.sundays = clamp(parseInt(val(), 10) || 4, 1, 12);
    else if (k === '--anchor') a.anchor = val();
    else if (k === '--seed') a.seed = String(val());
    else if (k === '--out') a.out = path.resolve(val());
    else if (k === '--help' || k === '-h') {
      log('node scripts/fetch-fixtures.mjs [--sundays N] [--anchor YYYY-MM-DD] [--synthetic] [--seed S] [--out DIR]');
      process.exit(0);
    }
  }
  if (a.anchor && !/^\d{4}-\d{2}-\d{2}$/.test(a.anchor)) throw new Error('--anchor must be YYYY-MM-DD');
  return a;
}

// --- dates / US Eastern time ---
const ymd = (d) => d.toISOString().slice(0, 10);
function addDays(s, n) {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
const weekdayOf = (s) => new Date(`${s}T12:00:00Z`).getUTCDay(); // 0 = Sunday
const ET_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
function etParts(epochSec) {
  const p = Object.fromEntries(ET_FMT.formatToParts(new Date(epochSec * 1000)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, h: Number(p.hour) % 24, m: Number(p.minute) };
}
/** "2026-11-15", "13:00" (US Eastern wall clock) -> epoch seconds. */
function etToEpoch(date, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const target = Date.parse(`${date}T${pad(h)}:${pad(m)}:00Z`) / 1000;
  let guess = target + 5 * 3600;
  for (let i = 0; i < 3; i++) {
    const p = etParts(guess);
    guess += target - Date.parse(`${p.date}T${pad(p.h)}:${pad(p.m)}:00Z`) / 1000;
  }
  return guess;
}
const windowLabel = (h, m) => `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
function sundayOnOrBefore(date) {
  let d = date;
  while (weekdayOf(d) !== 0) d = addDays(d, -1);
  return d;
}
/** Newest Sunday strictly before today (US Eastern), i.e. one whose games are over. */
const latestCompletedSunday = () => sundayOnOrBefore(addDays(etParts(Date.now() / 1000).date, -1));

// --- seeded RNG ---
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
function makeRng(seedStr) {
  let a = hashSeed(seedStr) || 1;
  const rng = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + (hi - lo) * rng();
  rng.gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  return rng;
}

// --- normal distribution ---
function erf(x) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
}
const phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
function probit(p) { // Acklam's inverse normal CDF
  p = clamp(p, 1e-6, 1 - 1e-6);
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - 0.02425) return -probit(1 - p);
  const q = p - 0.5, r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// ----------------------------------------------------------------------------------------------
// network
// ----------------------------------------------------------------------------------------------
async function fetchRetry(url, { tries = 4, timeout = 30000, accept = '*/*' } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { accept, 'user-agent': 'fixtures-fetch/1.0 (node)' } });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after'));
        await res.arrayBuffer().catch(() => {});
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        await sleep(retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 800 * 2 ** i);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(600 * 2 ** i);
    }
  }
  throw lastErr;
}

let lastKalshiCall = 0;
/** Polite GET against the public Kalshi API (>= 200 ms between calls, retry on 429/5xx). */
async function kalshiGet(pathname, params = {}) {
  const wait = lastKalshiCall + 200 - Date.now();
  if (wait > 0) await sleep(wait);
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  try {
    const res = await fetchRetry(`${KALSHI}${pathname}?${qs}`, { accept: 'application/json' });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } finally {
    lastKalshiCall = Date.now();
  }
}

// --- CSV (streaming, RFC 4180 quotes) ---
function makeCsvParser(onRow) {
  let row = [], field = '', inQuotes = false, quotePending = false;
  return {
    push(chunk) {
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];
        if (inQuotes) {
          if (quotePending) {
            quotePending = false;
            if (ch === '"') { field += '"'; continue; }
            inQuotes = false; // closing quote; fall through and treat ch normally
          } else {
            if (ch === '"') quotePending = true; else field += ch;
            continue;
          }
        }
        if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\n') { row.push(field); field = ''; onRow(row); row = []; }
        else if (ch === '"') inQuotes = true;
        else if (ch !== '\r') field += ch;
      }
    },
    end() {
      if (field !== '' || row.length) { row.push(field); onRow(row); }
      row = []; field = '';
    },
  };
}

/** nflverse schedule -> rows for all seasons (only the columns we need). */
async function fetchSchedule() {
  const res = await fetchRetry(GAMES_CSV, { timeout: 60000 });
  if (!res.ok) throw new Error(`games.csv HTTP ${res.status}`);
  const rows = [];
  let header = null;
  const parser = makeCsvParser((r) => {
    if (!header) { header = r; return; }
    const o = {};
    for (const k of ['game_id', 'season', 'gameday', 'weekday', 'gametime', 'away_team', 'away_score', 'home_team', 'home_score', 'overtime', 'away_moneyline', 'home_moneyline', 'spread_line']) {
      o[k] = r[header.indexOf(k)] ?? '';
    }
    rows.push(o);
  });
  parser.push(await res.text());
  parser.end();
  if (!header || !header.includes('game_id') || !header.includes('gameday')) throw new Error('games.csv: unexpected columns');
  return rows;
}

/** Stream one season of nflverse play-by-play and keep the timed plays of the wanted games. */
async function fetchPbp(season, wanted) {
  const res = await fetchRetry(pbpUrl(season), { timeout: 300000 });
  if (!res.ok) throw new Error(`play_by_play_${season}.csv.gz HTTP ${res.status}`);
  const gunzip = zlib.createGunzip();
  Readable.fromWeb(res.body).on('error', (e) => gunzip.destroy(e)).pipe(gunzip);
  gunzip.setEncoding('utf8');
  const out = new Map();
  let I = null;
  const parser = makeCsvParser((r) => {
    if (!I) {
      I = Object.fromEntries(['game_id', 'qtr', 'quarter_seconds_remaining', 'time_of_day', 'end_clock_time', 'total_home_score', 'total_away_score'].map((k) => [k, r.indexOf(k)]));
      for (const k of ['game_id', 'qtr', 'quarter_seconds_remaining', 'time_of_day', 'total_home_score', 'total_away_score']) {
        if (I[k] < 0) throw new Error(`play-by-play is missing column ${k}`);
      }
      return;
    }
    const id = r[I.game_id];
    if (!wanted.has(id)) return;
    const t = Date.parse(r[I.time_of_day]) / 1000;
    if (!Number.isFinite(t)) return; // "GAME", "END QUARTER n" marker rows carry no wall-clock time
    const e = I.end_clock_time >= 0 ? Date.parse(r[I.end_clock_time]) / 1000 : NaN;
    if (!out.has(id)) out.set(id, []);
    out.get(id).push({
      q: Number(r[I.qtr]), clock: Number(r[I.quarter_seconds_remaining]), t, e: Number.isFinite(e) ? e : null,
      hs: Number(r[I.total_home_score]) || 0, as: Number(r[I.total_away_score]) || 0,
    });
  });
  for await (const chunk of gunzip) parser.push(chunk);
  parser.end();
  return out;
}

// ----------------------------------------------------------------------------------------------
// Kalshi
// ----------------------------------------------------------------------------------------------
async function fetchKalshiEvents() {
  const out = [];
  let cursor = '';
  for (let page = 0; page < 40; page++) {
    const r = await kalshiGet('/events', { series_ticker: SERIES, with_nested_markets: true, limit: 200, ...(cursor ? { cursor } : {}) });
    if (!r.ok || !r.body) throw new Error(`Kalshi GET /events HTTP ${r.status}`);
    out.push(...(r.body.events ?? []));
    cursor = r.body.cursor;
    if (!cursor || !(r.body.events ?? []).length) break;
  }
  return out;
}

/** Index events by "<date>|<abbrA>|<abbrB>" (nflverse abbreviations, sorted). */
async function indexKalshiEvents(events) {
  const idx = new Map();
  for (const ev of events) {
    const m = /^[A-Z]+-(\d\d)([A-Z]{3})(\d\d)([A-Z]+)$/.exec(ev.event_ticker ?? '');
    if (!m || !MONTHS[m[2]]) continue;
    const date = `20${m[1]}-${pad(MONTHS[m[2]])}-${m[3]}`;
    let markets = ev.markets;
    if (!markets?.length) {
      const r = await kalshiGet('/markets', { event_ticker: ev.event_ticker });
      markets = r.ok ? r.body?.markets ?? [] : [];
    }
    if (markets.length !== 2) continue;
    const codes = markets.map((mk) => mk.ticker.split('-').pop());
    // ticker team string is AWAY then HOME, e.g. SFDAL = SF at DAL
    const order = m[4] === codes[0] + codes[1] ? [0, 1] : m[4] === codes[1] + codes[0] ? [1, 0] : null;
    const byAbbr = {};
    markets.forEach((mk, i) => { byAbbr[toNflverse(codes[i])] = mk; });
    const abbrs = Object.keys(byAbbr);
    if (abbrs.length !== 2 || !abbrs.every((x) => TEAMS[x])) continue;
    const ts = (s) => (s ? Math.round(Date.parse(s) / 1000) : null);
    idx.set(`${date}|${[...abbrs].sort().join('|')}`, {
      eventTicker: ev.event_ticker,
      seriesTicker: ev.series_ticker ?? SERIES,
      date,
      away: order ? toNflverse(codes[order[0]]) : null,
      home: order ? toNflverse(codes[order[1]]) : null,
      markets: byAbbr,
      closeTs: ts(markets[0].close_time),
      // observed: occurrence_datetime / expected_expiration_time = scheduled kickoff + 3h
      occurrenceTs: ts(markets[0].occurrence_datetime ?? markets[0].expected_expiration_time),
      settled: markets.every((mk) => mk.result === 'yes' || mk.result === 'no' || ['finalized', 'settled', 'determined'].includes(mk.status)),
    });
  }
  return idx;
}
function findKalshiEvent(idx, date, a, b) {
  if (!idx) return null;
  const pair = [a, b].sort().join('|');
  for (const d of [date, addDays(date, 1), addDays(date, -1)]) {
    const hit = idx.get(`${d}|${pair}`);
    if (hit) return hit;
  }
  return null;
}

/** Price field: strings are dollars ("0.3500"), bare integers (older API versions) are cents. */
function px(o) {
  if (!o) return null;
  const v = o.close_dollars ?? o.close;
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : v / 100;
  return Number.isFinite(n) ? n : null;
}
/** Mid of yes bid/ask close when the book is two-sided and tight, else last trade, else null (carry). */
function candlePrice(c) {
  const bid = px(c.yes_bid), ask = px(c.yes_ask), trade = px(c.price);
  if (bid !== null && ask !== null && ask >= bid && ask - bid <= 0.1) return (bid + ask) / 2;
  if (trade !== null) return trade;
  return null;
}
/** 1-minute candles for one market: Map(end_period_ts -> yes price 0..1 | null). */
async function fetchKalshiCandles(ticker, startTs, endTs, seriesTicker = SERIES) {
  const points = new Map();
  let endpoint = null;
  for (let s = startTs; s < endTs; s += MAX_CANDLES_PER_CALL * 60) {
    const e = Math.min(endTs, s + MAX_CANDLES_PER_CALL * 60);
    const attempts = [
      ['live', `/series/${seriesTicker}/markets/${ticker}/candlesticks`],
      ['historical', `/historical/markets/${ticker}/candlesticks`], // markets settled before /historical/cutoff
    ];
    for (const [name, p] of attempts) {
      const r = await kalshiGet(p, { start_ts: s, end_ts: e, period_interval: 1 });
      if (r.ok && r.body?.candlesticks?.length) {
        for (const c of r.body.candlesticks) points.set(c.end_period_ts, candlePrice(c));
        endpoint = name;
        break;
      }
    }
  }
  return { points, endpoint };
}

/** Minute grid T0..T1 from raw points; forward-fills gaps. Returns null when there is too little data. */
function candlesFromKalshi(points, T0, T1, tl, invert, winner) {
  const real = [...points.entries()].filter(([, p]) => p !== null).sort((a, b) => a[0] - b[0]);
  if (!real.length) return null;
  const lastReal = real[real.length - 1][0];
  const settle = winner === 'home' ? 0.99 : winner === 'away' ? 0.01 : 0.5;
  let cur = real[0][1]; // back-fill if nothing precedes T0
  for (const [ts, p] of real) { if (ts < T0) cur = p; else break; }
  const out = [];
  let realCount = 0;
  for (let T = T0; T <= T1; T += 60) {
    const v = points.get(T);
    if (v !== null && v !== undefined) { cur = v; realCount++; }
    let p = invert ? 1 - cur : cur;
    if (T > tl.end && T > lastReal) p = settle; // market closed after the final whistle
    out.push({ t: T, homeP: round3(clamp(p, 0.01, 0.99)) });
  }
  if (realCount < 30) return null;
  return { candles: out, realCount, filled: out.length - realCount };
}

// ----------------------------------------------------------------------------------------------
// timelines (periods, breaks, clock, score)
// ----------------------------------------------------------------------------------------------
const BREAK_LABELS = ['End of Q1', 'Halftime', 'End of Q3'];
const makeBreaks = (periods) => BREAK_LABELS.map((label, i) => ({ label, start: periods[i].end, end: periods[i + 1].start }));

/** Real timing from nflverse plays (time_of_day). Returns null if the data looks unusable. */
function pbpTimeline(plays, final) {
  const ps = plays.filter((p) => Number.isFinite(p.t) && p.q >= 1).map((p, i) => ({ ...p, i })).sort((a, b) => a.t - b.t || a.i - b.i);
  const qs = [...new Set(ps.map((p) => p.q))].sort((a, b) => a - b);
  if (qs.length < 4 || qs.some((q, i) => q !== i + 1)) return null;
  // when a play (and so its score) is over: its end_clock_time if sane, else ~10 s after the snap
  const endOf = (p) => (p.e !== null && p.e >= p.t && p.e <= p.t + 120 ? p.e : p.t + 10);
  const byQ = qs.map((q) => ps.filter((p) => p.q === q));
  const periods = byQ.map((a, i) => ({ period: qs[i], start: Math.round(a[0].t), end: Math.round(Math.max(...a.map(endOf))) }));
  for (let i = 0; i + 1 < periods.length; i++) {
    if (periods[i].end > periods[i + 1].start + 60) return null; // quarters overlap: bad timestamps
    if (periods[i].end >= periods[i + 1].start) periods[i].end = periods[i + 1].start - 1;
  }
  for (const p of periods) {
    const len = p.end - p.start;
    if (len <= 0 || (p.period <= 4 && (len < 15 * 60 || len > 110 * 60))) return null;
  }
  const breaks = makeBreaks(periods);
  if (breaks.some((b) => b.end - b.start < 20 || b.end - b.start > 60 * 60)) return null;

  const anchors = {};
  byQ.forEach((a, i) => {
    const per = periods[i];
    let c = Infinity;
    const list = a.map((p) => ({ t: p.t, clock: (c = Math.min(c, p.clock)) }));
    list.push({ t: per.end, clock: per.period <= 4 ? 0 : Math.min(c, a[a.length - 1].clock) });
    anchors[per.period] = list;
  });
  const scores = [];
  let ph = 0, pa = 0;
  for (const p of ps) {
    if (p.hs !== ph || p.as !== pa) {
      scores.push({ t: Math.round(endOf(p)), home: p.hs, away: p.as });
      ph = p.hs; pa = p.as;
    }
  }
  const end = periods[periods.length - 1].end;
  const fin = final ?? { home: ph, away: pa };
  if (fin.home !== ph || fin.away !== pa) scores.push({ t: end, home: fin.home, away: fin.away });
  return { kickoff: periods[0].start, end, periods, breaks, anchors, scores, finalScore: fin, clockMode: 'plays', breaksSource: 'nflverse' };
}

/**
 * Timeline from real-time durations (seconds) and scoring events in game-clock terms.
 * events: [{ elapsed: 0..3600, team, pts }] for regulation, [{ ot: true, clock: 600..0, team, pts }] for overtime.
 */
function durationTimeline({ kickoff, durs, events, overtime, final }) {
  const periods = [];
  let t = Math.round(kickoff);
  for (let i = 0; i < 4; i++) {
    const end = Math.round(t + durs.q[i]);
    periods.push({ period: i + 1, start: t, end });
    t = Math.round(end + (durs.gaps[i] ?? 0));
  }
  const anchors = {};
  for (const p of periods) anchors[p.period] = [{ t: p.start, clock: 900 }, { t: p.end, clock: 0 }];
  const otEvent = events.find((e) => e.ot);
  if (overtime || otEvent) {
    const start = Math.round(periods[3].end + durs.otGap);
    const endClock = otEvent ? clamp(Math.round(otEvent.clock), 0, 590) : 0;
    const end = Math.round(start + Math.max(120, ((600 - endClock) / 600) * durs.otFull));
    periods.push({ period: 5, start, end });
    anchors[5] = [{ t: start, clock: 600 }, { t: end, clock: endClock }];
  }
  const timed = events.map((e) => {
    if (e.ot) return { ...e, t: periods[4].end };
    const q = Math.min(3, Math.floor(e.elapsed / 900));
    const p = periods[q];
    return { ...e, t: Math.round(p.start + ((e.elapsed - q * 900) / 900) * (p.end - p.start)) };
  }).sort((a, b) => a.t - b.t);
  const scores = [];
  let home = 0, away = 0;
  for (const e of timed) {
    if (e.team === 'home') home += e.pts; else away += e.pts;
    scores.push({ t: e.t, home, away });
  }
  const end = periods[periods.length - 1].end;
  const fin = final ?? { home, away };
  if (fin.home !== home || fin.away !== away) scores.push({ t: end, home: fin.home, away: fin.away });
  return { kickoff: periods[0].start, end, periods, breaks: makeBreaks(periods), anchors, scores, finalScore: fin, clockMode: 'linear', breaksSource: 'estimated' };
}

/** League-average real-time shape: Q1 ends +42 min, halftime +88..+101, Q3 ends +143, game ends +190. */
function averageDurations(scale = 1) {
  const m = (x) => x * 60 * scale;
  return { q: [m(42), m(42.5), m(42), m(43.5)], gaps: [m(3.5), m(13), m(3.5)], otGap: m(4), otFull: m(18) };
}
function randomDurations(rng) {
  const m = (lo, hi) => rng.range(lo, hi) * 60;
  return { q: [m(31, 43), m(41, 55), m(31, 42), m(38, 54)], gaps: [rng.range(190, 250), rng.range(780, 930), rng.range(190, 250)], otGap: rng.range(200, 300), otFull: m(15, 25) };
}

function clockAt(list, t, mode) {
  let i = 0;
  while (i + 1 < list.length && list[i + 1].t <= t) i++;
  const a = list[i], b = list[i + 1];
  if (!b || t <= a.t) return a.clock;
  if (mode === 'linear') return Math.round(a.clock + ((b.clock - a.clock) * (t - a.t)) / (b.t - a.t));
  // between two snaps the clock runs at most in real time and never below the next snap's clock
  return Math.max(b.clock, Math.round(a.clock - (t - a.t)));
}
/** Period / clock / score at wall-clock time t. During a break: the period just finished, clock 0. */
function stateAt(tl, t) {
  const last = tl.periods[tl.periods.length - 1];
  if (t >= tl.end) {
    const a = tl.anchors[last.period];
    return { t, period: last.period, clockSeconds: a[a.length - 1].clock, homeScore: tl.finalScore.home, awayScore: tl.finalScore.away };
  }
  let period = 1, clockSeconds = 900;
  if (t >= tl.kickoff) {
    const per = tl.periods.find((p) => t >= p.start && t <= p.end);
    if (per) { period = per.period; clockSeconds = clockAt(tl.anchors[per.period], t, tl.clockMode); }
    else { period = tl.periods.filter((p) => p.end < t).pop().period; clockSeconds = 0; }
  }
  let home = 0, away = 0;
  for (const s of tl.scores) { if (s.t <= t) { home = s.home; away = s.away; } else break; }
  return { t, period, clockSeconds, homeScore: home, awayScore: away };
}
/** One state per minute from kickoff, plus a final one exactly at `end` carrying the final score. */
function statesOf(tl) {
  const out = [];
  for (let t = tl.kickoff; t < tl.end; t += 60) out.push(stateAt(tl, t));
  out.push(stateAt(tl, tl.end));
  return out;
}

// ----------------------------------------------------------------------------------------------
// generated scoring + synthetic win probability
// ----------------------------------------------------------------------------------------------
function randomPts(rng) {
  const r = rng();
  return r < 0.57 ? 7 : r < 0.93 ? 3 : r < 0.96 ? 6 : r < 0.99 ? 8 : 2;
}
function spreadTimes(rng, n) {
  const ts = Array.from({ length: n }, () => rng.range(60, 3590)).sort((a, b) => a - b);
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] < 50) ts[i] = Math.min(3598, ts[i - 1] + 50);
  return ts;
}
/** Random game whose result is consistent with pregame home win probability p0. */
function simulateScoring(rng, p0, wantWinner = null) {
  const spread = SIGMA * probit(p0);
  for (let attempt = 0; attempt < 400; attempt++) {
    const total = rng.range(36, 52);
    const mu = { home: Math.max(4, total / 2 + spread / 2), away: Math.max(4, total / 2 - spread / 2) };
    const evs = [];
    // ~11 possessions per team, each scoring with the probability that gives the expected points
    for (const team of ['home', 'away']) {
      const pScore = clamp(mu[team] / (11 * 5.4), 0.05, 0.75);
      for (let drive = 0; drive < 11; drive++) if (rng() < pScore) evs.push({ team, pts: randomPts(rng) });
    }
    const times = spreadTimes(rng, evs.length);
    for (let i = evs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [evs[i], evs[j]] = [evs[j], evs[i]]; }
    evs.forEach((e, i) => { e.elapsed = times[i]; });
    const sum = (team) => evs.filter((e) => e.team === team).reduce((s, e) => s + e.pts, 0);
    let home = sum('home'), away = sum('away'), overtime = false;
    if (home === away) {
      overtime = true;
      const team = rng() < clamp(p0, 0.35, 0.65) ? 'home' : 'away';
      const pts = rng() < 0.6 ? 3 : 6;
      evs.push({ ot: true, clock: rng.range(60, 540), team, pts });
      if (team === 'home') home += pts; else away += pts;
    }
    const winner = home > away ? 'home' : 'away';
    if (wantWinner && wantWinner !== 'tie' && winner !== wantWinner) continue;
    return { events: evs, overtime, final: { home, away } };
  }
  throw new Error('could not simulate a game with the requested winner');
}
/** Split a known team total into scoring plays (7s and 3s, with at most one 8 / 6 / 2 to make it fit). */
function decompose(score) {
  let best = null;
  for (let a8 = 0; a8 <= 1; a8++) for (let a6 = 0; a6 <= 1; a6++) for (let a2 = 0; a2 <= 1; a2++) {
    const rest = score - 8 * a8 - 6 * a6 - 2 * a2;
    if (rest < 0) continue;
    for (let a7 = Math.floor(rest / 7); a7 >= 0; a7--) {
      if ((rest - 7 * a7) % 3) continue;
      const a3 = (rest - 7 * a7) / 3;
      const cost = a8 + a6 + 3 * a2 + Math.max(0, a3 - a7 - 1) * 0.6 + (a3 > 4 ? 2 : 0);
      if (!best || cost < best.cost) best = { cost, list: [...Array(a7).fill(7), ...Array(a3).fill(3), ...Array(a8).fill(8), ...Array(a6).fill(6), ...Array(a2).fill(2)] };
    }
  }
  return best ? best.list : score > 0 ? [score] : [];
}
/** Plausible scoring sequence that adds up to a known final score (used when play-by-play is missing). */
function scoringFromFinal(rng, final, overtime) {
  const evs = [];
  for (const team of ['home', 'away']) for (const pts of decompose(final[team])) evs.push({ team, pts });
  for (let i = evs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [evs[i], evs[j]] = [evs[j], evs[i]]; }
  if (overtime && final.home !== final.away) {
    const winner = final.home > final.away ? 'home' : 'away';
    const k = evs.findIndex((e) => e.team === winner && e.pts <= 7);
    if (k >= 0) { const [e] = evs.splice(k, 1); evs.push({ ...e, ot: true, clock: rng.range(60, 540) }); }
  }
  const reg = evs.filter((e) => !e.ot);
  const times = spreadTimes(rng, reg.length);
  reg.forEach((e, i) => { e.elapsed = times[i]; });
  return { events: evs, overtime: !!overtime, final };
}

/** Synthetic home win probability on the minute grid: normal model of final margin + market-like noise. */
function synthCandles(rng, tl, p0, T0, T1, winner) {
  const spread = SIGMA * probit(p0);
  const settle = winner === 'home' ? 0.99 : winner === 'away' ? 0.01 : 0.5;
  const out = [];
  let drift = 0, noise = 0;
  for (let T = T0; T <= T1; T += 60) {
    let p;
    if (T < tl.kickoff) {
      drift = 0.92 * drift + rng.gauss() * 0.003;
      p = p0 + drift;
    } else if (T >= tl.end) {
      p = settle;
    } else {
      const s = stateAt(tl, T);
      const rem = s.period <= 4 ? (4 - s.period) * 900 + s.clockSeconds : Math.max(15, s.clockSeconds * 0.5);
      const f = Math.max(rem, 15) / 3600;
      const base = phi((s.homeScore - s.awayScore + spread * f) / (SIGMA * Math.sqrt(f)));
      noise = 0.8 * noise + rng.gauss() * 0.012;
      p = base + noise * Math.min(1, 4 * base * (1 - base) + 0.1);
    }
    out.push({ t: T, homeP: round3(clamp(Math.round(p * 200) / 200, 0.01, 0.99)) });
  }
  return out;
}

function moneylineProb(homeMl, awayMl) {
  const imp = (ml) => (ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100));
  const h = Number(homeMl), a = Number(awayMl);
  if (!Number.isFinite(h) || !Number.isFinite(a) || !h || !a) return null;
  return imp(h) / (imp(h) + imp(a));
}

// ----------------------------------------------------------------------------------------------
// assembling + writing
// ----------------------------------------------------------------------------------------------
const candleGrid = (tl) => [Math.floor((tl.kickoff - 3600) / 60) * 60, Math.ceil((tl.end + 600) / 60) * 60];
const winnerOf = (f) => (f.home > f.away ? 'home' : f.home < f.away ? 'away' : 'tie');
const synthTicker = (date, away, home) => {
  const [y, m, d] = date.split('-');
  const mon = Object.keys(MONTHS)[Number(m) - 1];
  const k = (abbr) => NFLVERSE_TO_KALSHI[abbr] ?? abbr;
  return `SYNTH-${SERIES}-${y.slice(2)}${mon}${d}${k(away)}${k(home)}`;
};

function assemble({ id, source, eventTicker, marketTicker, date, window, home, away, tl, candles }) {
  return {
    id, source, eventTicker, marketTicker, date,
    kickoff: tl.kickoff, end: tl.end, window,
    home: { abbr: home, name: TEAMS[home] ?? home },
    away: { abbr: away, name: TEAMS[away] ?? away },
    winner: winnerOf(tl.finalScore),
    finalScore: tl.finalScore,
    breaksSource: tl.breaksSource,
    periods: tl.periods, breaks: tl.breaks,
    states: statesOf(tl),
    candles,
  };
}

/** Compact but diffable: one top-level key per line, arrays on a single line. */
const gameJson = (g) => `{\n${Object.keys(g).map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(g[k])}`).join(',\n')}\n}\n`;

function writeFixtures(outDir, source, notes, sundays) {
  const gamesDir = path.join(outDir, 'games');
  fs.mkdirSync(gamesDir, { recursive: true });
  const keep = new Set();
  let bytes = 0;
  for (const s of sundays) for (const g of s.games) {
    const body = gameJson(g);
    fs.writeFileSync(path.join(gamesDir, `${g.id}.json`), body);
    keep.add(`${g.id}.json`);
    bytes += Buffer.byteLength(body);
  }
  for (const f of fs.readdirSync(gamesDir)) if (f.endsWith('.json') && !keep.has(f)) fs.unlinkSync(path.join(gamesDir, f)); // stale fixtures
  const index = { generatedAt: new Date().toISOString(), source, notes, sundays: sundays.map((s) => ({ date: s.date, games: s.games.map((g) => g.id) })) };
  const indexBody = `${JSON.stringify(index, null, 2)}\n`;
  fs.writeFileSync(path.join(outDir, 'index.json'), indexBody);
  bytes += Buffer.byteLength(indexBody);

  log(`\nWrote ${keep.size} games + index.json to ${outDir} (${(bytes / 1024).toFixed(0)} KB)`);
  for (const s of sundays) {
    const by = {};
    for (const g of s.games) by[g.window] = (by[g.window] ?? 0) + 1;
    const real = s.games.filter((g) => g.source === 'kalshi').length;
    const realBreaks = s.games.filter((g) => g.breaksSource === 'nflverse').length;
    log(`  ${s.date}  ${String(s.games.length).padStart(2)} games  kalshi prices ${real}/${s.games.length}  nflverse breaks ${realBreaks}/${s.games.length}  [${Object.entries(by).map(([w, n]) => `${w} x${n}`).join(', ')}]`);
  }
  log(`  notes: ${notes}`);
}

// ----------------------------------------------------------------------------------------------
// synthetic mode
// ----------------------------------------------------------------------------------------------
function buildSyntheticGame(seed, { date, away, home, hhmm }) {
  const id = `${date}-${away}-${home}`;
  const rng = makeRng(`${seed}:${id}`);
  const [h, m] = hhmm.split(':').map(Number);
  const p0 = clamp(0.55 + rng.gauss() * 0.14, 0.18, 0.86);
  const sim = simulateScoring(rng, p0);
  const tl = durationTimeline({ kickoff: etToEpoch(date, hhmm) + rng.range(120, 200), durs: randomDurations(rng), events: sim.events, overtime: sim.overtime, final: sim.final });
  const [T0, T1] = candleGrid(tl);
  const eventTicker = synthTicker(date, away, home);
  return assemble({
    id, source: 'synthetic', eventTicker, marketTicker: `${eventTicker}-${NFLVERSE_TO_KALSHI[home] ?? home}`, date,
    window: windowLabel(h, m), home, away, tl, candles: synthCandles(rng, tl, p0, T0, T1, winnerOf(tl.finalScore)),
  });
}

function runSynthetic(args, reason) {
  const anchor = sundayOnOrBefore(args.anchor ?? (args.synthetic ? SYNTH_ANCHOR : latestCompletedSunday()));
  const sundays = [];
  for (let i = 0; i < args.sundays; i++) {
    const date = addDays(anchor, -7 * i);
    const rng = makeRng(`${args.seed}:${date}`);
    const teams = Object.keys(TEAMS);
    for (let k = teams.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [teams[k], teams[j]] = [teams[j], teams[k]]; }
    const n = rng() < 0.5 ? 13 : 14; // 3 or 2 pairs of teams on bye
    const slots = [...Array(8).fill('13:00'), '16:05', '16:05', ...Array(n === 14 ? 3 : 2).fill('16:25'), '20:20'];
    const games = slots.map((hhmm, g) => buildSyntheticGame(args.seed, { date, away: teams[2 * g], home: teams[2 * g + 1], hhmm }));
    sundays.push({ date, games });
  }
  const notes = `${reason} Everything here is generated (seed "${args.seed}"): matchups, scores, period/break times and win-probability paths are synthetic, not real Kalshi or nflverse data.`;
  writeFixtures(args.out, 'synthetic', notes, sundays);
}

// ----------------------------------------------------------------------------------------------
// real mode
// ----------------------------------------------------------------------------------------------
async function runReal(args) {
  let schedule = null, kidx = null;
  const problems = [];
  try {
    schedule = await fetchSchedule();
    log(`nflverse schedule: ${schedule.length} rows`);
  } catch (e) { problems.push(`nflverse schedule unavailable (${e.message})`); warn(problems.at(-1)); }
  try {
    const events = await fetchKalshiEvents();
    kidx = await indexKalshiEvents(events);
    log(`Kalshi ${SERIES}: ${events.length} events, ${kidx.size} usable`);
  } catch (e) { problems.push(`Kalshi events unavailable (${e.message})`); warn(problems.at(-1)); }
  if (!schedule && !kidx) return false;

  // --- which Sundays, which games ---
  const gamesOn = (date) => {
    if (schedule) {
      return schedule
        .filter((r) => r.gameday === date && r.weekday === 'Sunday' && r.home_score !== '' && r.away_score !== '' && TEAMS[r.home_team] && TEAMS[r.away_team])
        .map((r) => {
          const [h, m] = r.gametime.split(':').map(Number);
          return {
            date, away: r.away_team, home: r.home_team, nflId: r.game_id, season: Number(r.season),
            schedKick: etToEpoch(date, r.gametime), window: windowLabel(h, m),
            final: { home: Number(r.home_score), away: Number(r.away_score) }, overtime: r.overtime === '1',
            p0: moneylineProb(r.home_moneyline, r.away_moneyline) ?? (r.spread_line !== '' ? phi(Number(r.spread_line) / SIGMA) : null),
          };
        });
    }
    // no schedule: take the settled Kalshi events dated that Sunday (kickoff = occurrence time - 3h)
    return [...kidx.values()].filter((k) => k.date === date && k.settled && k.home && k.occurrenceTs).map((k) => {
      const schedKick = k.occurrenceTs - 3 * 3600;
      const et = etParts(schedKick);
      const homeMarket = k.markets[k.home];
      return {
        date, away: k.away, home: k.home, nflId: null, season: null, schedKick, window: windowLabel(et.h, et.m),
        final: null, overtime: false, p0: null,
        winnerHint: homeMarket.result === 'yes' ? 'home' : homeMarket.result === 'no' ? 'away' : null,
      };
    });
  };
  const anchor = sundayOnOrBefore(args.anchor ?? latestCompletedSunday());
  const chosen = [];
  for (let i = 0; i < args.sundays + 6 && chosen.length < args.sundays; i++) {
    const date = addDays(anchor, -7 * i);
    const games = gamesOn(date).sort((a, b) => a.schedKick - b.schedKick || a.home.localeCompare(b.home));
    if (games.length) chosen.push({ date, games }); else log(`${date}: no completed Sunday games found, skipping`);
  }
  if (!chosen.length) { problems.push('no completed Sunday games found'); return false; }

  // --- play-by-play for those games ---
  const pbp = new Map();
  const seasons = [...new Set(chosen.flatMap((s) => s.games.map((g) => g.season)).filter(Boolean))];
  for (const season of seasons) {
    const wanted = new Set(chosen.flatMap((s) => s.games).filter((g) => g.season === season).map((g) => g.nflId));
    try {
      const got = await fetchPbp(season, wanted);
      for (const [id, plays] of got) pbp.set(id, plays);
      log(`nflverse play-by-play ${season}: ${got.size}/${wanted.size} games`);
    } catch (e) { problems.push(`nflverse play-by-play ${season} unavailable (${e.message})`); warn(problems.at(-1)); }
  }

  // --- build each game ---
  const sundays = [];
  const stats = { games: 0, kalshi: 0, nflverse: 0, synthPrices: [], estimated: [], madeUpScores: [], inverted: [], endpoints: new Set() };
  for (const s of chosen) {
    const built = [];
    for (const g of s.games) {
      const id = `${g.date}-${g.away}-${g.home}`;
      const rng = makeRng(`${args.seed}:${id}`);
      const kev = findKalshiEvent(kidx, g.date, g.away, g.home);

      let tl = g.nflId && pbp.has(g.nflId) ? pbpTimeline(pbp.get(g.nflId), g.final) : null;
      if (!tl) {
        let sim;
        if (g.final) sim = scoringFromFinal(rng, g.final, g.overtime);
        else { sim = simulateScoring(rng, 0.5, g.winnerHint); stats.madeUpScores.push(id); }
        const nominal = 190 * 60 + (sim.overtime ? 20 * 60 : 0);
        const hinted = kev?.closeTs ? kev.closeTs - 150 - g.schedKick : nominal; // markets close ~2-3 min after the final whistle
        const scale = hinted / nominal;
        tl = durationTimeline({ kickoff: g.schedKick, durs: averageDurations(scale > 0.8 && scale < 1.3 ? scale : 1), events: sim.events, overtime: sim.overtime, final: sim.final });
        stats.estimated.push(id);
      }
      const winner = winnerOf(tl.finalScore);
      const [T0, T1] = candleGrid(tl);

      let candles = null, source = 'synthetic', marketTicker = null, detail = 'no Kalshi event';
      if (kev) {
        for (const [abbr, invert] of [[g.home, false], [g.away, true]]) {
          const market = kev.markets[abbr];
          if (!market) continue;
          try {
            const { points, endpoint } = await fetchKalshiCandles(market.ticker, T0 - 1800, T1, kev.seriesTicker);
            const res = candlesFromKalshi(points, T0, T1, tl, invert, winner);
            if (res) {
              candles = res.candles; source = 'kalshi'; marketTicker = market.ticker;
              detail = `${res.realCount} real + ${res.filled} filled minutes (${endpoint}${invert ? ', 1 - away market' : ''})`;
              stats.endpoints.add(endpoint);
              if (invert) stats.inverted.push(id);
              const kWinner = market.result === 'yes' ? (invert ? 'away' : 'home') : market.result === 'no' ? (invert ? 'home' : 'away') : null;
              if (kWinner && winner !== 'tie' && kWinner !== winner) warn(`${id}: Kalshi settled ${kWinner} but the score says ${winner}`);
              break;
            }
            detail = `no usable candles for ${market.ticker}`;
          } catch (e) { detail = `candles failed for ${market.ticker} (${e.message})`; }
        }
      }
      if (!candles) {
        candles = synthCandles(rng, tl, g.p0 ?? clamp(0.55 + rng.gauss() * 0.12, 0.2, 0.85), T0, T1, winner);
        marketTicker = kev?.markets[g.home]?.ticker ?? `${synthTicker(g.date, g.away, g.home)}-${NFLVERSE_TO_KALSHI[g.home] ?? g.home}`;
        stats.synthPrices.push(id);
      }
      const game = assemble({ id, source, eventTicker: kev?.eventTicker ?? synthTicker(g.date, g.away, g.home), marketTicker, date: g.date, window: g.window, home: g.home, away: g.away, tl, candles });
      built.push(game);
      stats.games++;
      if (source === 'kalshi') stats.kalshi++;
      if (tl.breaksSource === 'nflverse') stats.nflverse++;
      const pre = candles.find((c) => c.t >= tl.kickoff) ?? candles[0];
      log(`  ${id.padEnd(22)} ${g.window.padStart(8)}  ${source.padEnd(9)} breaks:${tl.breaksSource.padEnd(9)} kickoff homeP ${pre.homeP.toFixed(3)}  final ${tl.finalScore.away}-${tl.finalScore.home}${tl.periods.length > 4 ? ' OT' : ''}  ${detail}`);
    }
    sundays.push({ date: s.date, games: built });
  }
  if (!stats.kalshi && !stats.nflverse) { problems.push('neither Kalshi candles nor nflverse timing could be fetched for any game'); return false; }

  const list = (ids) => (ids.length > 6 ? `${ids.slice(0, 6).join(', ')} and ${ids.length - 6} more` : ids.join(', '));
  const notes = [
    `Prices: real Kalshi ${SERIES} 1-minute candlesticks for ${stats.kalshi} of ${stats.games} games (mid of yes bid/ask close, else last trade, forward-filled; clamped to 0.01..0.99).`,
    stats.synthPrices.length ? `Synthetic model prices (source "synthetic") for: ${list(stats.synthPrices)}.` : '',
    stats.inverted.length ? `Home price derived as 1 - away market for: ${list(stats.inverted)}.` : '',
    `Period/break times and scores: real nflverse play-by-play time_of_day for ${stats.nflverse} of ${stats.games} games; clockSeconds between plays is interpolated.`,
    stats.estimated.length ? `Estimated timing from league averages (breaksSource "estimated") for: ${list(stats.estimated)}.` : '',
    stats.madeUpScores.length ? `Scores were generated (no nflverse schedule) for: ${list(stats.madeUpScores)}.` : '',
    problems.length ? `Problems: ${problems.join('; ')}.` : '',
  ].filter(Boolean).join(' ');
  writeFixtures(args.out, stats.kalshi ? 'kalshi' : 'synthetic', notes, sundays);
  return true;
}

// ----------------------------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.synthetic) return runSynthetic(args, 'Generated with --synthetic.');
  let ok = false, why = 'Kalshi and nflverse could not be reached';
  try { ok = await runReal(args); } catch (e) { why = `real fetch failed: ${e.message}`; warn(e.stack ?? e.message); }
  if (!ok) {
    warn(`${why}; falling back to synthetic fixtures`);
    runSynthetic(args, `Fallback: ${why}.`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
