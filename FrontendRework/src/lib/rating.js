/**
 * Creative ratings.
 *
 * Stored 1-10, shown out of 5 in half steps — which is what the five stars in
 * the UI have always drawn, since each star is worth two stored points. The
 * numbers next to them used to say "9/10" while the stars said four and a half,
 * so everything that puts a rating in front of someone goes through here now.
 *
 * The stored scale is deliberately left alone: it is what the API, the
 * fingerprint's Agent 1 and every existing row already speak.
 */
export const RATING_MAX = 5;      // displayed scale
export const RATING_STEP = 0.5;
export const RATING_STORED_MAX = 10;

export const toDisplay = (stored) =>
  stored === null || stored === undefined || stored === '' ? null : Number(stored) / 2;

export const toStored = (display) =>
  display === null || display === undefined || display === '' ? null : Math.round(Number(display) * 2);

/** "4.5/5", or "-/5" when unrated. */
export function formatRating(stored) {
  const v = toDisplay(stored);
  if (v === null || Number.isNaN(v)) return `-/${RATING_MAX}`;
  return `${Number(v.toFixed(1))}/${RATING_MAX}`;
}

/** Bare "4.5" — for inputs and chips that supply their own scale. */
export function displayValue(stored) {
  const v = toDisplay(stored);
  return v === null || Number.isNaN(v) ? '' : String(Number(v.toFixed(1)));
}
