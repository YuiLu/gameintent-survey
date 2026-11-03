import { shuffle } from "./analysis.mjs";
import { labelsFor } from "./blind-catalog";
export const FOUR_CHOICE_PROTOCOL = "blind-four-v1";
const signature = (labels: any[]) =>
  labels
    .map((l) => (typeof l === "string" ? l : l.id))
    .sort()
    .join("|");

// One complete reference set and three different same-game distractor sets.
// Match set sizes so the reference cannot be identified by its label count.
export function fourChoices(
  question: any,
  participantSeed = "",
  generationSeed = "test-only",
) {
  const reference = [
    ...new Map(question.labels.map((l: any) => [l.id, l])).values(),
  ] as any[];
  const size = reference.length,
    ids = new Set(reference.map((l) => l.id));
  const negatives = labelsFor(question.game).filter((l) => !ids.has(l.id));
  if (!size || negatives.length < size)
    throw Error("Insufficient same-game distractors");
  const seed = "four-choice-v1:" + generationSeed + ":" + question.id;
  const groups = [reference],
    seen = new Set([signature(reference)]);
  for (let attempt = 0; groups.length < 4 && attempt < 200; attempt++) {
    const option = shuffle(negatives, seed + ":sample:" + attempt).slice(
      0,
      size,
    );
    const key = signature(option);
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(option);
  }
  if (groups.length !== 4)
    throw Error("Could not construct four distinct options");
  // Option IDs have no correct/incorrect marker and are stable across raters.
  const choices = shuffle(groups, seed + ":ids").map(
    (labels: any[], i: number) => ({
      id: "option-" + i,
      labels: shuffle(labels, seed + ":labels:" + i),
    }),
  );
  return shuffle(choices, seed + ":order:" + participantSeed);
}

export function fourChoiceAnswer(
  body: any,
  question: any,
  participantSeed = "",
  generationSeed = "test-only",
) {
  if (!["selected", "insufficient", "unfamiliar"].includes(body.blind_status))
    throw Error("Invalid status");
  const options = fourChoices(question, participantSeed, generationSeed);
  const selected = options.find((o: any) => o.id === body.blind_choice_id);
  if (body.blind_status === "selected" ? !selected : !!body.blind_choice_id)
    throw Error("Select one option");
  return {
    status: body.blind_status,
    labels:
      body.blind_status === "selected"
        ? selected.labels.map((l: any) => l.id).sort()
        : [],
    choice_mode: FOUR_CHOICE_PROTOCOL,
    choice_id: body.blind_status === "selected" ? selected.id : null,
    candidate_options: options.map((o: any) => ({
      id: o.id,
      labels: o.labels.map((l: any) => l.id),
    })),
  };
}

export function restoredChoices(
  question: any,
  lock: any,
  participantSeed = "",
  generationSeed = "test-only",
) {
  if (!lock?.candidate_options)
    return fourChoices(question, participantSeed, generationSeed);
  const lookup = new Map(
    [...labelsFor(question.game), ...question.labels].map((l) => [l.id, l]),
  );
  return lock.candidate_options.map((o: any) => ({
    id: o.id,
    labels: o.labels.map((id: string) => lookup.get(id)),
  }));
}
