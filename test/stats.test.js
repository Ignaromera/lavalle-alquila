import assert from "node:assert/strict";
import test from "node:test";
import { createDemoStore, IDS, statsForOwner, trackStat } from "../src/demo-store.js";
import { claimDailyView, recentDays, totalsFor, weekSeries } from "../src/stats.js";

test("una visita por persona y por día", () => {
  const storage = new Map();
  const memory = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  assert.equal(claimDailyView(memory, "listing", "abc", "2026-11-26"), true);
  assert.equal(claimDailyView(memory, "listing", "abc", "2026-11-26"), false);
  assert.equal(claimDailyView(memory, "listing", "abc", "2026-11-27"), true);
  assert.equal(claimDailyView(memory, "seek", "abc", "2026-11-26"), true);
});

test("el dueño ve sus números y no los de otro", () => {
  const store = createDemoStore();
  const marina = statsForOwner(store, IDS.marina);
  const carlos = statsForOwner(store, IDS.carlos);
  assert.ok(marina.some((row) => row.subject_id === IDS.casaTulumaya && row.kind === "view" && row.count > 0));
  assert.ok(marina.some((row) => row.subject_id === IDS.quincho && row.kind === "whatsapp"));
  assert.equal(marina.some((row) => row.subject_id === IDS.deptoPlumero), false);
  assert.ok(carlos.every((row) => row.subject_id === IDS.deptoPlumero));
  const week = weekSeries(marina, recentDays(7));
  assert.equal(week.length, 7);
  assert.ok(week.some((day) => day.view > 0));
  const totals = totalsFor(marina, "listing", IDS.casaTulumaya);
  assert.ok(totals.view > totals.share);
  assert.ok(totals.share >= totals.whatsapp);
});

test("sumar una visita de hoy en el ejemplo", () => {
  const store = createDemoStore();
  const before = totalsFor(statsForOwner(store, IDS.marina), "listing", IDS.casaTulumaya).view;
  trackStat(store, "listing", IDS.casaTulumaya, "view");
  const after = totalsFor(statsForOwner(store, IDS.marina), "listing", IDS.casaTulumaya).view;
  assert.equal(after, before + 1);
  const hiddenBefore = totalsFor(store.stats, "listing", IDS.deptoJocoli).view;
  trackStat(store, "listing", IDS.deptoJocoli, "view");
  assert.equal(totalsFor(store.stats, "listing", IDS.deptoJocoli).view, hiddenBefore);
});
