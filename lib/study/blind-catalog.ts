import catalog from "../../data/label-catalog.json";
export const labelsFor = (game: string) =>
  (catalog as Record<string, any[]>)[game] || [];
