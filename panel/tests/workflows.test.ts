import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  exportCsv,
  finished,
  needsReview,
  ongoing,
} from "../src/domain";
import { seedState } from "../src/fixtures";
test("assignment validates category, unit and availability while preserving prior state", () => {
  const state = seedState();
  const next = applyAction(state, {
    type: "assign",
    id: "r1",
    unitId: "public-works",
    teamId: "t2",
  });
  assert.equal(next.reports[0].status, "assigned");
  assert.equal(next.reports[0].teamId, "t2");
  assert.equal(state.reports[0].status, "submitted");
  assert.throws(() =>
    applyAction(state, {
      type: "assign",
      id: "r1",
      unitId: "water",
      teamId: "t1",
    }),
  );
  assert.throws(() =>
    applyAction(state, {
      type: "assign",
      id: "r1",
      unitId: "public-works",
      teamId: "t1",
    }),
  );
  assert.throws(() =>
    applyAction(state, {
      type: "assign",
      id: "r6",
      unitId: "parks",
      teamId: "t4",
    }),
  );
  assert.throws(() => applyAction(state, { type: "progress", id: "r1" }));
  assert.equal(
    applyAction(next, { type: "progress", id: "r1" }).reports[0].status,
    "in_progress",
  );
});
test("external routing records intent without implying delivery or a municipal crew assignment", () => {
  const next = applyAction(seedState(), {
    type: "assign",
    id: "r5",
    unitId: "electricity-external",
  });
  const report = next.reports.find((report) => report.id === "r5")!;
  assert.equal(report.status, "in_review");
  assert.equal(report.teamId, undefined);
  assert.match(report.externalRouting!, /Teslim teyidi yok/);
  assert.equal(report.events.at(-1)?.audience, "citizen");
  assert.match(report.events.at(-1)?.body ?? "", /teslim teyidi yok/);
});
test("withdrawals and unresolved feedback never inflate solved counts; resolution does not imply citizen consent", () => {
  const state = seedState();
  assert.equal(
    finished(state.reports.find((report) => report.id === "r12")!),
    false,
  );
  assert.equal(
    finished(state.reports.find((report) => report.id === "r9")!),
    false,
  );
  assert.equal(
    ongoing(state.reports.find((report) => report.id === "r9")!),
    true,
  );
  assert.equal(
    needsReview(state.reports.find((report) => report.id === "r9")!),
    true,
  );
  const reviewed = applyAction(state, {
    type: "reopen",
    id: "r9",
    body: "Vatandaş geri dönüşü üzerine yerinde kontrol yapılacak.",
  });
  assert.equal(
    needsReview(reviewed.reports.find((report) => report.id === "r9")!),
    false,
  );
  assert.throws(() =>
    applyAction(state, {
      type: "resolve",
      id: "r12",
      body: "Bu talep için işlem yapılmamalıdır.",
    }),
  );
  const next = applyAction(state, {
    type: "resolve",
    id: "r1",
    body: "Yol yüzeyindeki çukur dolduruldu ve güvenli geçiş sağlandı.",
  });
  assert.equal(next.reports[0].status, "resolved");
  assert.equal(next.reports[0].feedback, undefined);
  const reopened = applyAction(next, {
    type: "reopen",
    id: "r1",
    body: "Yerinde kontrol için yeniden incelemeye alındı.",
  });
  assert.equal(reopened.reports[0].status, "in_review");
  assert.equal(reopened.reports[0].resolution, next.reports[0].resolution);
});
test("public notes and internal notes retain separate audiences", () => {
  const next = applyAction(seedState(), {
    type: "note",
    id: "r1",
    body: "İç koordinasyon notu",
    audience: "internal",
  });
  const publicState = applyAction(next, {
    type: "note",
    id: "r1",
    body: "Bölgedeki inceleme devam ediyor.",
    audience: "citizen",
  });
  const publicMessages = publicState.reports[0].events.filter(
    (event) => event.audience === "citizen",
  );
  assert.ok(
    !publicMessages.some((event) => event.body.includes("İç koordinasyon")),
  );
  assert.ok(
    publicMessages.some((event) => event.body.includes("inceleme devam")),
  );
});
test("announcement associations remain consistent without completing reports", () => {
  const state = seedState(),
    previous = state.announcements[0];
  const next = applyAction(state, {
    type: "announcement",
    value: {
      ...previous,
      reportIds: ["r3", "r3"],
      body: "Boru değişimi devam ediyor. Son durum birazdan paylaşılacak.",
    },
  });
  assert.deepEqual(next.announcements[0].reportIds, ["r3"]);
  assert.equal(
    next.reports.find((report) => report.id === "r8")!.incidentId,
    undefined,
  );
  assert.equal(
    next.reports.find((report) => report.id === "r3")!.status,
    "in_progress",
  );
  assert.throws(() =>
    applyAction(state, {
      type: "announcement",
      value: { ...previous, reportIds: ["r1"] },
    }),
  );
  assert.throws(() =>
    applyAction(state, {
      type: "announcement",
      value: { ...previous, id: "other", reportIds: ["r3"] },
    }),
  );
});
test("completed work links requests without closing them or treating support counts as people", () => {
  const state = seedState();
  const next = applyAction(state, {
    type: "work",
    value: {
      id: "new",
      title: "Erişilebilir geçiş düzenlemesi",
      neighborhood: "Cumhuriyet",
      body: "Sağlık merkezi önündeki geçiş düzenlendi.",
      benefit: "Sağlık hizmetine erişilebilir ulaşım",
      reportIds: ["r2", "r2"],
      state: "completed",
    },
  });
  assert.deepEqual(next.works[0].reportIds, ["r2"]);
  assert.ok(next.works[0].completedAt);
  assert.equal(
    next.reports.find((report) => report.id === "r2")!.status,
    "in_review",
  );
});
test("CSV is marked as sample and safely escapes spreadsheet formulas and quotes", () => {
  const state = seedState();
  state.reports[0].title = '=HYPERLINK("bad")';
  const csv = exportCsv(state.reports.slice(0, 1));
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /ÖRNEK VERİ/);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
});
