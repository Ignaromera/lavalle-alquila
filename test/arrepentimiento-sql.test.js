import assert from "node:assert/strict";
import test from "node:test";
import { makeDb } from "./sql-helpers.js";

async function regretDb() {
  const t = await makeDb();
  await t.db.exec(t.read("migration-arrepentimiento.sql"));
  t.ask = async (args, uid = null) => {
    try {
      const [row] = await t.as(uid, "select public.pedir_arrepentimiento($1, $2, $3, $4) as code", args);
      return row.code;
    } catch (error) {
      return { error: error.message };
    }
  };
  return t;
}

test("el pedido se guarda sin cuenta y devuelve un código de trámite al instante", async () => {
  const t = await regretDb();
  const code = await t.ask(["Ana Pérez", " Ana@Test.ar ", "", "Me equivoqué de plan"]);
  assert.match(code, /^ARR-\d{8}-\d{4}$/);
  const row = await t.one("select code, full_name, contact_email, account_email, reason, user_id, resolved_at from public.regret_requests");
  assert.deepEqual(row, { code, full_name: "Ana Pérez", contact_email: "ana@test.ar", account_email: "ana@test.ar", reason: "Me equivoqué de plan", user_id: null, resolved_at: null });
  const mail = await t.one("select payload from private.mails");
  assert.equal(mail.payload.type, "regret_requested");
  assert.equal(mail.payload.code, code);
  assert.equal(mail.payload.contact_email, "ana@test.ar");
  const second = await t.ask(["Beto", "beto@test.ar", "cuenta@test.ar", ""]);
  assert.notEqual(second, code);
});

test("con sesión guarda la cuenta; valida mail y nombre; tope de 5 por mail por día", async () => {
  const t = await regretDb();
  const ana = await t.user("ana@test.ar");
  await t.ask(["Ana", "ana@test.ar", "ana@test.ar", ""], ana);
  assert.equal((await t.one("select user_id from public.regret_requests")).user_id, ana);
  assert.ok((await t.ask(["Ana", "no-es-un-mail", "", ""])).error);
  assert.ok((await t.ask(["A", "a@test.ar", "", ""])).error);
  for (let i = 0; i < 4; i++) assert.equal(typeof await t.ask(["Ana", "ana@test.ar", "", ""]), "string");
  assert.match((await t.ask(["Ana", "ana@test.ar", "", ""])).error, /varios pedidos/);
});

test("RLS: solo un admin lee y resuelve; el insert anónimo no puede venir resuelto", async () => {
  const t = await regretDb();
  const sql = t.read("migration-arrepentimiento.sql");
  assert.match(sql, /create policy regret_insert on public\.regret_requests\s+for insert to anon, authenticated/);
  assert.match(sql, /create policy regret_admin_read on public\.regret_requests\s+for select to authenticated using \(public\.is_admin\(\)\)/);
  assert.match(sql, /create policy regret_admin_update on public\.regret_requests\s+for update to authenticated using \(public\.is_admin\(\)\)/);
  assert.doesNotMatch(sql, /grant select[^;]*regret_requests to anon/);
  await t.db.exec("insert into public.regret_requests (full_name, contact_email, account_email, resolved_at, code) values ('Ana', 'a@test.ar', 'a@test.ar', now(), 'TRUCHO')");
  const row = await t.one("select code, resolved_at from public.regret_requests");
  assert.equal(row.resolved_at, null);
  assert.match(row.code, /^ARR-/);
});
