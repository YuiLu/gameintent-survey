import catalog from "../../data/label-catalog.json";
export const labelsFor = (game: string) =>
  (catalog as Record<string, any[]>)[game] || [];
export function blindView(question: any, lock: any = null) {
  const { labels, description_en, description_zh, ...safe } = question;
  return {
    ...safe,
    label_choices: labelsFor(question.game),
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
