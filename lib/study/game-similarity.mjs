import { shuffle, rng } from "./analysis.mjs";
export const SIMILARITY_VERSION = "tactical-similarity-v1";
export const similarityKey = (a, b) => [a, b].sort().join("|");
// Design priorities, not measured similarities. Overlapping mechanisms can make
// these comparisons informative even where conventional genre names differ.
const priorities = [
  ["pubg", "naraka"],
  ["apex", "naraka"],
  ["pubg", "apex"],
  ["apex", "overwatch"],
  ["valorant", "overwatch"],
  ["cs", "valorant"],
  ["wc3", "aoe2"],
  ["wc3", "sc2"],
  ["aoe2", "sc2"],
  ["dota", "lol"],
];
export const priorityKeys = new Set(
  priorities.map(([a, b]) => similarityKey(a, b)),
);
export function assignSimilarity(games, participantId, counts = {}) {
  const unique = [...new Set(games)].sort(),
    pool = [];
  for (let i = 0; i < unique.length; i++)
    for (let j = i + 1; j < unique.length; j++)
      pool.push({
        key: similarityKey(unique[i], unique[j]),
        games: [unique[i], unique[j]],
        priority: priorityKeys.has(similarityKey(unique[i], unique[j]))
          ? "mechanism-overlap"
          : "coverage",
      });
  const shuffled = shuffle(pool, participantId + SIMILARITY_VERSION);
  const sort = (a) =>
    a.sort((a, b) => (counts[a.key] || 0) - (counts[b.key] || 0));
  const chosen = sort(
    shuffled.filter((p) => p.priority === "mechanism-overlap"),
  ).slice(0, 2);
  const remaining = shuffled.filter(
    (p) => !chosen.some((c) => c.key === p.key),
  );
  // Keep one bridge/coverage slot when available, rather than assuming all
  // same-genre games are similar or presenting only predicted positive pairs.
  const bridge = sort(remaining.filter((p) => p.priority === "coverage"))[0];
  if (bridge && chosen.length < 3) chosen.push(bridge);
  for (const pair of sort(remaining))
    if (chosen.length < 3 && !chosen.some((p) => p.key === pair.key))
      chosen.push(pair);
  return shuffle(chosen, participantId + ":display").map((p) => ({
    ...p,
    games: shuffle(p.games, participantId + p.key),
  }));
}
export function validateSimilarity(pairs, answers) {
  if (!Array.isArray(answers) || answers.length !== pairs.length)
    throw Error("Invalid answers");
  if (new Set(answers.map((a) => a.key)).size !== pairs.length)
    throw Error("Duplicate answers");
  return pairs.map((p) => {
    const a = answers.find((a) => a.key === p.key);
    if (
      !a ||
      !["rated", "unable", "skipped"].includes(a.status) ||
      (a.status === "rated"
        ? !Number.isInteger(a.score) || a.score < 1 || a.score > 5
        : a.score !== null)
    )
      throw Error("Invalid rating");
    return { ...p, status: a.status, score: a.score };
  });
}
export function analyzeSimilarity(participants, replicates = 1000) {
  const people = participants.filter(
    (p) =>
      ["active", "completed"].includes(p.status) &&
      p.profile?.similarity?.phase === "live" &&
      p.profile.similarity.submitted_at,
  );
  const pairs = {};
  for (const p of people)
    for (const a of p.profile.similarity.responses || []) {
      const g = (pairs[a.key] ??= {
        games: [...a.games].sort(),
        n: 0,
        unable: 0,
        skipped: 0,
        distribution: [0, 0, 0, 0, 0],
        values: [],
      });
      if (a.status === "rated") {
        g.n++;
        g.values.push(a.score);
        g.distribution[a.score - 1]++;
      } else g[a.status]++;
    }
  const random = rng("game-similarity-ci-v1");
  const draws = Object.fromEntries(Object.keys(pairs).map((k) => [k, []]));
  for (let b = 0; b < replicates && people.length; b++) {
    const sums = {};
    for (let i = 0; i < people.length; i++) {
      const p = people[Math.floor(random() * people.length)];
      for (const a of p.profile.similarity.responses || [])
        if (a.status === "rated") {
          const s = (sums[a.key] ??= [0, 0]);
          s[0] += a.score;
          s[1]++;
        }
    }
    for (const [key, [sum, n]] of Object.entries(sums))
      draws[key].push(sum / n);
  }
  for (const [key, g] of Object.entries(pairs)) {
    g.mean = g.n ? g.values.reduce((a, b) => a + b, 0) / g.n : null;
    g.score_100 = g.mean === null ? null : 25 * (g.mean - 1);
    const d = draws[key].sort((a, b) => a - b);
    g.ci95 =
      g.n >= 2 && d.length >= replicates * 0.8
        ? [
            d[Math.floor(0.025 * (d.length - 1))],
            d[Math.ceil(0.975 * (d.length - 1))],
          ]
        : null;
    delete g.values;
  }
  return {
    version: SIMILARITY_VERSION,
    participants: people.length,
    scope:
      "Self-reported tactical-decision similarity; targeted mechanism-overlap sampling",
    bootstrap_unit: "participant",
    pairs,
  };
}
