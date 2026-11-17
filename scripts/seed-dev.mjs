// Creates a demo venue for LOCAL DEVELOPMENT ONLY, in the database in DATABASE_URL
// (.env.local points at the Neon `dev` branch).
//
//   npm run db:seed
//
// The sign-in values below are public test values. Never run this against the
// production database: create your real venue on /app with the setup code instead.
import { randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const DEV_VENUE = {
  name: "Demo Bar (dev)",
  passcode: "demo-venue",
  staff: [
    { name: "Morgan", role: "manager", pin: "1234" },
    { name: "Riley", role: "bartender", pin: "5678" },
  ],
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
if (process.env.VERCEL_ENV === "production") {
  console.error("Refusing to seed test sign-ins into production.");
  process.exit(1);
}

// Same "salt:hash" format as src/server/session.ts.
const hash = (value) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 32).toString("hex")}`;
};

const sql = neon(url);
const existing = await sql`select 1 from venues where name = ${DEV_VENUE.name} limit 1`;
if (existing.length > 0) {
  console.log("Demo venue already exists; nothing to do.");
  process.exit(0);
}

const settings = {
  scale: 0.75,
  cap: 0.65,
  maxCoveredCents: 10000,
  lateCutoffPeriod: 3,
  lockWindowUntil: null,
  favoriteTeams: [],
};
const [venue] = await sql`
  insert into venues (name, jurisdiction_code, tv_token, passcode_hash, settings)
  values (
    ${DEV_VENUE.name}, 'NJ', ${randomBytes(18).toString("base64url")},
    ${hash(DEV_VENUE.passcode)}, ${JSON.stringify(settings)}::jsonb
  )
  returning id
`;
for (const member of DEV_VENUE.staff) {
  await sql`
    insert into staff (venue_id, name, role, pin_hash)
    values (${venue.id}, ${member.name}, ${member.role}, ${hash(member.pin)})
  `;
}
console.log("Created the demo venue. Sign-in values are at the top of scripts/seed-dev.mjs.");
