import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { PushMessage } from "../src/push.ts";
import { ORIGIN, startTestApi, TEST_PASSWORD, type Headers, type TestApi } from "./harness.ts";

let clock = new Date("2026-11-18T09:00:00Z");
const sent: { tokens: string[]; msg: PushMessage }[] = [];
let api: TestApi;
let citizen: Headers;
let center: Headers;
let electricity: Headers;
let water: Headers;

before(async () => {
  api = await startTestApi({
    now: () => clock,
    pushSend: async (tokens, msg) => {
      sent.push({ tokens, msg });
      return { invalidTokens: [] };
    },
  });
  citizen = await api.signUpCitizen("vatandas2@example.test");
  center = await api.login("demo-merkez@kentbag.app");
  electricity = await api.login("demo-kurum-electricity@kentbag.app");
  water = await api.login("demo-kurum-water@kentbag.app");
  await api.db.query("UPDATE team SET located_at=$1", [clock]);
});
after(async () => api.close());

const signIn = (email: string, password = TEST_PASSWORD) =>
  request(api.app).post("/api/auth/sign-in/email").set("Origin", ORIGIN).send({ email, password });
const bearer = (r: request.Response): Headers => ({ Origin: ORIGIN, Authorization: `Bearer ${r.headers["set-auth-token"]}` });

test("announcements reach the citizen home screen and can be ended by their author", async () => {
  await request(api.app).post("/api/push/token").set(citizen).send({ token: "citizen-token-1", enabled: true }).expect(204);
  const crew = await api.login("demo-elk-ariza@kentbag.app");
  await request(api.app).post("/api/push/token").set(crew).send({ token: "crew-token-1", enabled: true }).expect(204);
  sent.length = 0;
  const posted = (
    await request(api.app)
      .post("/api/staff/announcements")
      .set(electricity)
      .send({ title: "Planlı elektrik kesintisi", body: "Trafo bakımı nedeniyle 10.00-12.00 arası elektrik verilemeyecek.", neighborhood: "Cumhuriyet", hours: 6 })
      .expect(201)
  ).body.announcement;
  assert.equal(posted.from, "Elektrik Dağıtımı");
  assert.ok(sent.some((s) => s.tokens.includes("citizen-token-1")), "citizens are notified");
  assert.ok(!sent.some((s) => s.tokens.includes("crew-token-1")), "staff devices are not");

  await request(api.app).post("/api/staff/announcements").set(center).send({ title: "Su", body: "Kısa", hours: 2 }).expect(400);
  await request(api.app).post("/api/staff/announcements").set(center).send({ title: "Kar uyarısı", body: "Bu gece yoğun kar bekleniyor, araçlarınızı yol kenarına park etmeyin.", hours: 12 }).expect(201);
  let seen = (await request(api.app).get("/api/announcements").set(citizen).expect(200)).body.announcements;
  assert.deepEqual(seen.map((a: { title: string }) => a.title).sort(), ["Kar uyarısı", "Planlı elektrik kesintisi"]);

  const list = (await request(api.app).get("/api/staff/announcements").set(water).expect(200)).body.announcements;
  assert.ok(list.every((a: { canEnd: boolean }) => !a.canEnd), "water cannot end others' announcements");
  await request(api.app).post(`/api/staff/announcements/${posted.id}/end`).set(water).expect(404);
  await request(api.app).post(`/api/staff/announcements/${posted.id}/end`).set(electricity).expect(204);
  seen = (await request(api.app).get("/api/announcements").set(citizen).expect(200)).body.announcements;
  assert.deepEqual(seen.map((a: { title: string }) => a.title), ["Kar uyarısı"]);

  clock = new Date(clock.getTime() + 13 * 3_600_000);
  assert.equal((await request(api.app).get("/api/announcements").set(citizen).expect(200)).body.announcements.length, 0);
});

test("center opens and closes staff accounts; institutions manage only their own crews", async () => {
  await request(api.app)
    .post("/api/staff/accounts")
    .set(center)
    .send({ name: "Su Kurumu Sorumlusu", email: "su.sorumlu@example.test", password: "Ilk-sifre-123", role: "institution", institution: "water" })
    .expect(201);
  const inst = await signIn("su.sorumlu@example.test", "Ilk-sifre-123").expect(200);
  assert.equal((await request(api.app).get("/api/me").set(bearer(inst)).expect(200)).body.institution, "water");

  await request(api.app)
    .post("/api/staff/accounts")
    .set(electricity)
    .send({ name: "Başka Kurum Ekibi", email: "x@example.test", password: "Ilk-sifre-123", role: "crew", teamId: "su-ariza" })
    .expect(403);
  await request(api.app)
    .post("/api/staff/accounts")
    .set(electricity)
    .send({ name: "Kurum Hesabı", email: "y@example.test", password: "Ilk-sifre-123", role: "institution", institution: "electricity" })
    .expect(403);
  const created = (
    await request(api.app)
      .post("/api/staff/accounts")
      .set(electricity)
      .send({ name: "Yeni Trafo Teknisyeni", email: "teknisyen@example.test", password: "Ilk-sifre-123", role: "crew", teamId: "elk-trafo" })
      .expect(201)
  ).body.account;
  assert.equal(created.teamName, "Trafo müdahale ekibi");
  const accounts = (await request(api.app).get("/api/staff/accounts").set(electricity).expect(200)).body.accounts;
  assert.ok(accounts.every((a: { role: string; institution: string }) => a.role === "crew" && a.institution === "electricity"));

  // An address that already has an account is never promoted (it may belong to someone else).
  const person = await api.signUpCitizen("donusen@example.test");
  await request(api.app)
    .post("/api/staff/accounts")
    .set(center)
    .send({ name: "Dönüşen", email: "Donusen@example.test", password: "Ilk-sifre-123", role: "center" })
    .expect(409);
  assert.equal((await request(api.app).get("/api/me").set(person).expect(200)).body.role, "citizen");

  const tech = bearer(await signIn("teknisyen@example.test", "Ilk-sifre-123").expect(200));
  await request(api.app).patch(`/api/staff/accounts/${created.userId}`).set(water).send({ active: false }).expect(404);
  await request(api.app).patch(`/api/staff/accounts/${created.userId}`).set(electricity).send({ active: false }).expect(200);
  await request(api.app).get("/api/me").set(tech).expect(401);
  await request(api.app).get("/api/me").set(bearer(await signIn("teknisyen@example.test", "Ilk-sifre-123").expect(200))).expect(403);
});

test("a citizen applies to a crew; that institution approves and the account becomes crew", async () => {
  const applicant = await api.signUpCitizen("basvuru@example.test");
  await request(api.app).post("/api/applications").set(applicant).send({ teamId: "elk-bakim", phone: "0555 111 22 33", note: "Elektrik teknikeriyim." }).expect(201);
  await request(api.app).post("/api/applications").set(applicant).send({ teamId: "elk-bakim", phone: "0555 111 22 33" }).expect(409);
  const mine = (await request(api.app).get("/api/applications/mine").set(applicant).expect(200)).body.application;
  assert.equal(mine.status, "pending");
  assert.equal(mine.teamName, "Şebeke bakım ekibi");

  assert.ok(!(await request(api.app).get("/api/staff/applications").set(water).expect(200)).body.applications.some((a: { id: string }) => a.id === mine.id));
  await request(api.app).post(`/api/staff/applications/${mine.id}/approve`).set(water).send({}).expect(404);
  await request(api.app).post(`/api/staff/applications/${mine.id}/reject`).set(electricity).send({ note: "" }).expect(400);
  await request(api.app).post(`/api/staff/applications/${mine.id}/approve`).set(electricity).send({}).expect(200);
  await request(api.app).post(`/api/staff/applications/${mine.id}/approve`).set(electricity).send({}).expect(409);
  const me = (await request(api.app).get("/api/me").set(bearer(await signIn("basvuru@example.test").expect(200))).expect(200)).body;
  assert.equal(me.role, "crew");
  assert.equal(me.teamId, "elk-bakim");
});

test("forgot password mails a link that leads to setting a new password", async () => {
  await api.signUpCitizen("unutkan@example.test");
  api.mails.length = 0;
  await request(api.app).post("/api/password/forgot").send({ email: "kimse-yok@example.test" }).expect(200);
  assert.equal(api.mails.length, 0);
  await request(api.app).post("/api/password/forgot").send({ email: "Unutkan@Example.test" }).expect(200);
  assert.equal(api.mails.length, 1);
  const link = api.mails[0].text.match(/https?:\/\/\S+/)![0];
  assert.ok(link.includes("callbackURL=" + encodeURIComponent("http://localhost:5173/sifre")));
  const token = new URL(link).pathname.split("/").pop()!;
  await request(api.app).post("/api/auth/reset-password").set("Origin", ORIGIN).send({ token, newPassword: "Yeni-sifre-456" }).expect(200);
  await signIn("unutkan@example.test").expect(401);
  await signIn("unutkan@example.test", "Yeni-sifre-456").expect(200);
});

test("reports count requests and times; institutions see only their own; CSV downloads", async () => {
  const create = (category: string) =>
    request(api.app)
      .post("/api/requests")
      .set(citizen)
      .send({ clientRequestId: crypto.randomUUID(), category, description: "Rapor için örnek bildirim metni.", address: "Cumhuriyet Mah.", point: { lat: 40.546, lng: 41.994 }, photoIds: [] })
      .expect(201)
      .then((r) => r.body.request);
  await api.db.query("UPDATE team SET located_at=$1", [clock]);
  const outage = await create("electricity");
  await create("water");
  const team = (await api.db.query("SELECT team_id FROM request WHERE id=$1", [outage.id])).rows[0].team_id;
  const crew = await api.login(`demo-${team}@kentbag.app`);
  clock = new Date(clock.getTime() + 20 * 60_000);
  await request(api.app).post(`/api/crew/jobs/${outage.id}/arrive`).set(crew).send({ remainingMinutes: 30 }).expect(200);
  clock = new Date(clock.getTime() + 25 * 60_000);
  await request(api.app).post(`/api/crew/jobs/${outage.id}/resolve`).set(crew).send({ note: "Sigorta değiştirildi, elektrik geldi.", photoIds: [] }).expect(200);

  const all = (await request(api.app).get("/api/staff/reports?days=7").set(center).expect(200)).body;
  assert.equal(all.summary.total, 2);
  assert.equal(all.summary.resolved, 1);
  assert.equal(all.summary.avgArrivalMinutes, 20);
  assert.equal(all.summary.avgResolutionMinutes, 45);
  assert.equal(all.summary.reopenRate, 0);
  const own = (await request(api.app).get("/api/staff/reports?days=7").set(electricity).expect(200)).body;
  assert.equal(own.summary.total, 1);
  assert.deepEqual(own.byInstitution.map((i: { institution: string }) => i.institution), ["electricity"]);

  const csv = await request(api.app).get("/api/staff/reports.csv?days=7").set(electricity).expect(200);
  assert.match(csv.headers["content-type"], /text\/csv/);
  const lines = csv.text.replace(/^﻿/, "").split("\r\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^"Referans";"Tür"/);
  assert.match(lines[1], new RegExp(outage.reference));
  await request(api.app).get("/api/staff/reports").set(citizen).expect(403);
});
