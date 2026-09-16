export const LIBELLES_CONSTAT = {
  ecart: "Écart documenté",
  convergence: "Même orientation",
  nuance: "À nuancer",
  non_comparable: "Comparaison impossible",
} as const;

export type Constat = keyof typeof LIBELLES_CONSTAT;

export interface VerificationComparaison {
  typeVote: string;
  ensemble: boolean;
  conflit: boolean;
  nombreVotes: number;
  constate: Exclude<Constat, "non_comparable">;
}

/** Le rapprochement sémantique reste éditorial. Ces exclusions sont mécaniques. */
export function constatPubliable(v: VerificationComparaison): Constat {
  if (v.typeVote === "MOC" || !v.ensemble || v.conflit || v.nombreVotes === 0)
    return "non_comparable";
  return v.constate;
}
