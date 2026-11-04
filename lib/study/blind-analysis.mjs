// Dataset labels are predictions; independent human votes form the reference.
export function analyzeBlind(rows, questions) {
  const all = rows.filter(
      (r) =>
        r.eligible &&
        r.trial_type === "main" &&
        r.protocol === "blind-v1" &&
        !r.is_technical_invalid,
    ),
    clean = all.filter((r) => r.blind_clean === true),
    qmap = new Map(questions.map((q) => [q.id, q])),
    groups = new Map();
  for (const r of clean) {
    if (!groups.has(r.question_id)) groups.set(r.question_id, new Map());
    groups.get(r.question_id).set(r.participant_id, r);
  }
  const games = {};
  let abstentions = 0;
  for (const r of clean)
    if (r.blind_response?.status !== "selected") abstentions++;
  for (const [id, people] of groups) {
    const votes = [...people.values()],
      q = qmap.get(id);
    if (votes.length !== 5 || !q) continue;
    const counts = new Map();
    for (const r of votes)
      for (const l of new Set(r.blind_response?.labels || []))
        counts.set(l, (counts.get(l) || 0) + 1);
    const reference = new Set(
      [...counts].filter(([l, n]) => n >= 3).map(([l]) => l),
    );
    const g = (games[q.game] ??= {
      complete_clips: 0,
      scored_clips: 0,
      no_consensus_clips: 0,
      tp: 0,
      fp: 0,
      fn: 0,
      exact: 0,
      classes: {},
    });
    g.complete_clips++;
    if (!reference.size) {
      g.no_consensus_clips++;
      continue;
    }
    g.scored_clips++;
    const predicted = new Set(q.labels.map((l) => l.id));
    if (
      predicted.size === reference.size &&
      [...predicted].every((l) => reference.has(l))
    )
      g.exact++;
    for (const l of new Set([...predicted, ...reference])) {
      const c = (g.classes[l] ??= { tp: 0, fp: 0, fn: 0 });
      const k =
        predicted.has(l) && reference.has(l)
          ? "tp"
          : predicted.has(l)
            ? "fp"
            : "fn";
      g[k]++;
      c[k]++;
    }
  }
  const scores = (g) => ({
    precision: g.tp + g.fp ? g.tp / (g.tp + g.fp) : null,
    recall: g.tp + g.fn ? g.tp / (g.tp + g.fn) : null,
    micro_f1:
      2 * g.tp + g.fp + g.fn ? (2 * g.tp) / (2 * g.tp + g.fp + g.fn) : null,
  });
  for (const g of Object.values(games)) {
    Object.assign(g, scores(g));
    const classes = Object.values(g.classes);
    g.macro_f1 = classes.length
      ? classes.reduce((s, c) => s + (2 * c.tp) / (2 * c.tp + c.fp + c.fn), 0) /
        classes.length
      : null;
    g.exact_match = g.scored_clips ? g.exact / g.scored_clips : null;
  }
  return {
    protocol: "blind-v1",
    reference:
      "At least 3 of 5 independent raters; no-consensus clips reported separately",
    label_space: "Fixed per-game survey label catalog",
    ratings: clean.length,
    excluded_preexposed_ratings: all.length - clean.length,
    abstention_rate: clean.length ? abstentions / clean.length : null,
    description_grounding: all.length
      ? all.filter((r) => r.description_support === "fully_supported").length /
        all.length
      : null,
    games,
  };
}

// Candidate-conditioned choice agreement is reported separately from open-label F1.
export function analyzeFourChoice(rows, questions) {
  const all = rows.filter(
    (r) =>
      r.eligible &&
      r.trial_type === "main" &&
      r.protocol === "blind-four-v1" &&
      !r.is_technical_invalid,
  );
  const clean = [
    ...new Map(
      all
        .filter((r) => r.blind_clean === true)
        .map((r) => [r.question_id + "\0" + r.participant_id, r]),
    ).values(),
  ];
  const qmap = new Map(
    questions.filter((q) => q.kind === "main").map((q) => [q.id, q]),
  );
  const groups = new Map();
  for (const r of clean) {
    if (!groups.has(r.question_id)) groups.set(r.question_id, []);
    groups.get(r.question_id).push(r);
  }
  const games = {};
  const same = (a, b) =>
    a.length === b.length &&
    [...a].sort().every((v, i) => v === [...b].sort()[i]);
  for (const [id, votes] of groups) {
    const q = qmap.get(id);
    if (!q || votes.length !== 5) continue;
    const g = (games[q.game] ??= {
      complete_clips: 0,
      ratings: 0,
      selected_ratings: 0,
      matching_ratings: 0,
      majority_matching_clips: 0,
      abstentions: 0,
      grounded_descriptions: 0,
      label_judgments:0,label_supported:0,
    });
    g.complete_clips++;
    g.ratings += 5;
    let matches = 0;
    for (const r of votes) {
      const a = r.blind_response;
      if (a?.status === "selected") {
        g.selected_ratings++;
        if (
          same(
            a.labels || [],
            q.labels.map((l) => l.id),
          )
        ) {
          g.matching_ratings++;
          matches++;
        }
      } else g.abstentions++;
      if(r.label_support){g.label_judgments++;if(r.label_support==='supported')g.label_supported++;}
      if (r.description_support === "fully_supported")
        g.grounded_descriptions++;
    }
    if (matches >= 3) g.majority_matching_clips++;
  }
  for (const g of Object.values(games)) {
    g.reference_agreement = g.ratings ? g.matching_ratings / g.ratings : null;
    g.agreement_given_selection = g.selected_ratings
      ? g.matching_ratings / g.selected_ratings
      : null;
    g.majority_reference_agreement = g.complete_clips
      ? g.majority_matching_clips / g.complete_clips
      : null;
    g.abstention_rate = g.ratings ? g.abstentions / g.ratings : null;
    g.label_support_rate=g.label_judgments?g.label_supported/g.label_judgments:null;
    g.description_grounding = g.ratings
      ? g.grounded_descriptions / g.ratings
      : null;
  }
  return {
    protocol: "blind-four-v1",
    choice_count: 4,
    chance_given_selection: 0.25,
    metric_scope:
      "Agreement with the annotation among four supplied label sets; not open-label precision, recall, or F1",
    ratings: clean.length,
    excluded_preexposed_ratings: all.length - clean.length,
    complete_clips: Object.values(games).reduce(
      (s, g) => s + g.complete_clips,
      0,
    ),
    games,
  };
}
