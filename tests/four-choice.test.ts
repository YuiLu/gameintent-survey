import { test } from "node:test";
import assert from "node:assert/strict";
import pool from "../data/pool.json";
import {
  fourChoices,
  fourChoiceAnswer,
  FOUR_CHOICE_PROTOCOL,
} from "../lib/study/four-choice";
import { blindView } from "../lib/study/blind";
import { labelsFor } from "../lib/study/blind-catalog";
const key = (labels: any[]) =>
  labels
    .map((l) => (typeof l === "string" ? l : l.id))
    .sort()
    .join("|");
test("all frozen clips have four distinct, equally sized same-game options and exactly one complete reference", () => {
  const positions = new Set();
  for (const q of pool) {
    const choices = fourChoices(q, "participant");
    assert.equal(choices.length, 4);
    assert.deepEqual(fourChoices(q, "participant"), choices);
    assert.equal(new Set(choices.map((c: any) => key(c.labels))).size, 4);
    assert.ok(choices.every((c: any) => c.labels.length === q.labels.length));
    const reference = key(q.labels);
    assert.equal(
      choices.filter((c: any) => key(c.labels) === reference).length,
      1,
    );
    positions.add(choices.findIndex((c: any) => key(c.labels) === reference));
    const catalog = new Set(labelsFor(q.game).map((l) => l.id));
    assert.ok(
      choices.every((c: any) => c.labels.every((l: any) => catalog.has(l.id))),
    );
    const view = blindView(q, null, "participant");
    assert.equal(view.labels, undefined);
    assert.equal(view.description_en, undefined);
    assert.equal(view.choice_options.length, 4);
    assert.ok(!JSON.stringify(view).includes("correct_option"));
  }
  assert.equal(positions.size, 4);
});
test("choice validation derives labels on the server and locked options survive refresh", () => {
  const q = pool.find((q) => q.labels.length === 5)!;
  const options = fourChoices(q, "p");
  const body = {
    choice_mode: FOUR_CHOICE_PROTOCOL,
    blind_choice_id: options[1].id,
    blind_status: "selected",
    blind_labels: ["forged"],
  };
  const answer = fourChoiceAnswer(body, q, "p");
  assert.equal(key(answer.labels), key(options[1].labels));
  assert.deepEqual(blindView(q, answer, "p").choice_options, options);
  assert.throws(() =>
    fourChoiceAnswer({ ...body, blind_choice_id: "forged" }, q, "p"),
  );
  assert.throws(() =>
    fourChoiceAnswer({ ...body, blind_status: "insufficient" }, q, "p"),
  );
  const abstain = fourChoiceAnswer(
    { ...body, blind_status: "insufficient", blind_choice_id: null },
    q,
    "p",
  );
  assert.deepEqual(abstain.labels, []);
});
