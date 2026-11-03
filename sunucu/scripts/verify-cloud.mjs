// Explicitly creates a labelled demo receipt and sends one copy to the configured demo mailbox.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
const base = process.env.KENT_VERIFY_URL;
if (!base?.startsWith("https://"))
  throw new Error("Set KENT_VERIFY_URL to the staged HTTPS deployment.");
const origin = "https://kentbag-panel-emir-kara-s-projects.vercel.app";
async function call(path, body, token, expected = 200) {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(90000),
  });
  assert.equal(r.status, expected, `${path}: HTTP ${r.status}`);
  return { body: await r.json(), token: r.headers.get("set-auth-token") };
}
const accounts = JSON.parse(readFileSync(".local/cloud-staff.json", "utf8"));
async function login(account) {
  return (
    await call("/api/auth/sign-in/email", {
      email: account.email,
      password: account.password,
    })
  ).token;
}
assert.equal((await call("/api/health")).body.ok, true);
const center = await login(accounts.find((a) => a.role === "center"));
const road = await login(accounts.find((a) => a.unitId === "public-works"));
await call("/api/municipality/workspace", undefined, road, 401);
await call("/api/institutions/water/workspace", undefined, road, 403);
await call("/api/municipality/local-session", {}, undefined, 403);
await call("/api/institutions/water/local-session", {}, undefined, 403);
const credentialFile = ".local/cloud-verification.json";
const citizen = existsSync(credentialFile)
  ? JSON.parse(readFileSync(credentialFile, "utf8"))
  : {
      name: "KentBağ sunum testi",
      email: "sunum-vatandas@demo.kentbag.test",
      password: randomBytes(18).toString("base64url"),
    };
if (!existsSync(credentialFile)) {
  await call("/api/auth/sign-up/email", citizen);
  writeFileSync(credentialFile, JSON.stringify(citizen), { mode: 0o600 });
}
const citizenToken = await login(citizen);
await call("/api/municipality/workspace", undefined, citizenToken, 401);
const receipt = (
  await call(
    "/api/reports",
    {
      requestId: "cloud-road-demo-20261104-v1",
      kind: "issue",
      category: "road",
      description:
        "DEMO TEST KAYDI: Oltu okul girişinde yol hasarı örneği. Gerçek bir arıza bildirimi değildir.",
      location: {
        source: "manual",
        address: "DEMO ADRES: Oltu okul girişi, sunum test alanı",
      },
      photos: [],
      sharePublicly: false,
    },
    citizenToken,
  )
).body;
await call(
  "/api/municipality/institutions/forward",
  {
    id: receipt.id,
    unitId: "public-works",
    instruction:
      "DEMO: Bu yol hasarı örneğini inceleyip test görevi hazırlayın. Gerçek müdahale talebi değildir.",
    channel: "both",
  },
  center,
);
const mail = (
  await call(
    `/api/municipality/institutions/mail/${receipt.id}`,
    undefined,
    center,
  )
).body.mails;
assert.equal(mail.length, 1);
assert.equal(mail[0].recipient, "emirkara@lollore.com");
assert.equal(mail[0].state, "sent");
await call(
  "/api/institutions/public-works/actions",
  { type: "accept", id: receipt.id },
  road,
);
await call(
  "/api/institutions/public-works/actions",
  {
    type: "message",
    id: receipt.id,
    audience: "citizen",
    body: "DEMO: Bildiriminizi aldık, yol bakım değerlendirmesi yapılıyor. Bu açıklama bir sunum testidir.",
  },
  road,
);
const workspace = (await call("/api/workspace", undefined, citizenToken)).body;
assert.ok(JSON.stringify(workspace).includes("yol bakım değerlendirmesi"));
console.log(
  JSON.stringify({
    ok: true,
    report: receipt.reference,
    staffScope: "verified",
    citizenReply: "verified",
    emailState: mail[0].state,
    providerId: mail[0].providerId,
  }),
);
