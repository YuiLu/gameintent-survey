import { labelsFor } from "./blind-catalog";
import { FOUR_CHOICE_PROTOCOL, restoredChoices } from "./four-choice";
export { labelsFor } from "./blind-catalog";
export function blindView(
  question: any,
  lock: any = null,
  participantSeed = "",
  generationSeed = "test-only",
) {
  const { labels, description_en, description_zh, ...safe } = question;
  return {
    ...safe,
    // Keep the public vocabulary for already-open older clients during rollout.
    label_choices: labelsFor(question.game),
    ...(!(lock && lock.choice_mode !== FOUR_CHOICE_PROTOCOL)
      ? {
          choice_mode: FOUR_CHOICE_PROTOCOL,
          choice_options: restoredChoices(
            question,
            lock,
            participantSeed,
            generationSeed,
          ),
        }
      : {}),
    blind_mode: true,
    blind_locked: !!lock,
    blind_response: lock,
    ...(lock ? { labels, description_en, description_zh } : {}),
  };
}
export function blindAnswer(body: any, game: string) {
  const ids = labelsFor(game).map((l) => l.id),
    selected = [...new Set(body.blind_labels || [])].sort();
  if (
    !["selected", "insufficient", "unfamiliar"].includes(body.blind_status) ||
    !Array.isArray(body.blind_labels) ||
    selected.length > ids.length ||
    selected.some((l) => !ids.includes(l)) ||
    (body.blind_status === "selected" ? !selected.length : !!selected.length)
  )
    throw Error("请选择标签或无法判断的原因");
  return { status: body.blind_status, labels: selected };
}
