import assert from "node:assert/strict";
import test from "node:test";
import { createRenderQueue } from "../src/render-queue.js";
import { authEventShouldRender } from "../src/api.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("la cola no deja el main vacío: la pintura vieja no pisa a la nueva", async () => {
  let dom = "inicial";
  const events = [];
  const gate = deferred();
  const schedule = createRenderQueue(async (job) => {
    events.push(`clear ${job.id}`);
    dom = "";
    await job.gate;
    dom = job.id;
    events.push(`fill ${job.id}`);
  });
  const done = schedule({ id: "A", gate: gate.promise });
  schedule({ id: "B", gate: Promise.resolve() });
  assert.deepEqual(events, ["clear A"]);
  assert.equal(dom, "");
  gate.resolve();
  await done;
  assert.equal(dom, "B");
  assert.deepEqual(events, ["clear A", "fill A", "clear B", "fill B"]);
});

test("si llegan dos pedidos mientras hay uno en curso, queda solo el último", async () => {
  const seen = [];
  const gate = deferred();
  const schedule = createRenderQueue(async (job) => {
    seen.push(job.id);
    if (job.id === "A") await gate.promise;
  });
  const done = schedule({ id: "A" });
  schedule({ id: "B" });
  schedule({ id: "C" });
  gate.resolve();
  await done;
  assert.deepEqual(seen, ["A", "C"]);
});

test("un error de pintura no traba el pedido siguiente", async () => {
  const seen = [];
  const gate = deferred();
  const previous = console.error;
  console.error = () => {};
  const schedule = createRenderQueue(async (job) => {
    seen.push(job.id);
    if (job.id === "A") {
      await gate.promise;
      throw new Error("falló la primera");
    }
  });
  try {
    const done = schedule({ id: "A" });
    schedule({ id: "B" });
    gate.resolve();
    await done;
    assert.deepEqual(seen, ["A", "B"]);
  } finally {
    console.error = previous;
  }
});

test("el primer render espera la sesión inicial y se vuelve a pintar al entrar o salir", () => {
  assert.equal(authEventShouldRender("INITIAL_SESSION"), true);
  assert.equal(authEventShouldRender("SIGNED_IN"), true);
  assert.equal(authEventShouldRender("SIGNED_OUT"), true);
  assert.equal(authEventShouldRender("USER_UPDATED"), true);
  assert.equal(authEventShouldRender("PASSWORD_RECOVERY"), true);
  assert.equal(authEventShouldRender("TOKEN_REFRESHED"), false);
});
