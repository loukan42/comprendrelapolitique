/**
 * Nuage des scrutins de la page d'accueil : catégories, codage compact et
 * disposition en dôme.
 *
 * Chaque triangle du nuage est un scrutin public réel, et rien d'autre : ni
 * point décoratif, ni densité inventée. La couleur dit ce qui a été soumis au
 * vote, la position dit quand. Le module est pur, sans accès au DOM ni à la
 * base, pour pouvoir être testé.
 */

export const CATEGORIES = [
  "amendement",
  "article",
  "ensemble",
  "motion",
  "censure",
  "autre",
] as const;
export type CategorieScrutin = (typeof CATEGORIES)[number];

/** Libellé au pluriel, pour la légende qui compte les scrutins. */
export const LIBELLE_CATEGORIE: Record<CategorieScrutin, string> = {
  amendement: "amendements",
  article: "articles",
  ensemble: "votes sur l'ensemble d'un texte",
  motion: "motions de procédure",
  censure: "motions de censure",
  autre: "autres votes (résolutions, parties de budget)",
};

/** Libellé au singulier, pour la bulle d'un scrutin. */
export const LIBELLE_CATEGORIE_UN: Record<CategorieScrutin, string> = {
  amendement: "Vote sur un amendement",
  article: "Vote sur un article",
  ensemble: "Vote sur l'ensemble d'un texte",
  motion: "Vote sur une motion de procédure",
  censure: "Motion de censure",
  autre: "Autre vote",
};

/**
 * Teintes du nuage : la catégorie, et pour les amendements leur sort. Les
 * amendements font huit scrutins sur dix ; les séparer entre adoptés et
 * rejetés dit quelque chose de réel (la plupart sont rejetés) et donne au
 * dessin sa variété de couleurs.
 */
export const TEINTES = [
  "amendement-rejete",
  "amendement-adopte",
  "article",
  "ensemble",
  "motion",
  "censure",
  "autre",
] as const;
export type Teinte = (typeof TEINTES)[number];

export const LIBELLE_TEINTE: Record<Teinte, string> = {
  "amendement-rejete": "amendements rejetés",
  "amendement-adopte": "amendements adoptés",
  article: "articles",
  ensemble: "votes sur l'ensemble d'un texte",
  motion: "motions de procédure",
  censure: "motions de censure",
  autre: "autres votes (résolutions, parties de budget)",
};

export function teinteDe(s: { categorie: CategorieScrutin; adopte: boolean }): Teinte {
  if (s.categorie === "amendement") return s.adopte ? "amendement-adopte" : "amendement-rejete";
  return s.categorie;
}

export const LEGISLATURES = [15, 16, 17] as const;
export type LegislatureNuage = (typeof LEGISLATURES)[number];

export interface ScrutinNuage {
  legislature: LegislatureNuage;
  numero: number;
  /** Jours écoulés depuis la date d'origine du nuage. */
  jour: number;
  categorie: CategorieScrutin;
  adopte: boolean;
}

/**
 * Catégorie d'un scrutin, lue dans son intitulé officiel.
 *
 * La source ne publie pas cette catégorie : elle se déduit de l'objet, qui
 * commence par « l'amendement n° », « l'article », « la motion de rejet
 * préalable ». L'ordre des tests compte. L'objet d'un vote d'amendement cite
 * souvent un article (« après l'article 6 ») ; un vote sur l'ensemble est
 * repéré par l'importeur avant toute lecture de l'intitulé ; une motion de
 * censure a son propre type de vote dans la source.
 */
export function categorieDeScrutin(s: {
  typeVoteCode: string;
  estVoteSurEnsemble: boolean;
  objet: string;
}): CategorieScrutin {
  if (s.typeVoteCode === "MOC") return "censure";
  if (s.estVoteSurEnsemble) return "ensemble";
  const objet = s.objet.toLowerCase();
  if (objet.includes("amendement")) return "amendement";
  if (/\barticles?\b/.test(objet)) return "article";
  if (objet.includes("motion")) return "motion";
  return "autre";
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const VALEUR = new Map([...ALPHABET].map((c, i) => [c, i]));

/**
 * Six caractères par scrutin : un pour la législature, la catégorie et le
 * résultat, deux pour le jour (4 096 jours, plus de onze ans), trois pour le
 * numéro. Les 17 000 scrutins tiennent en une centaine de kilo-octets, contre
 * plusieurs mégaoctets en JSON.
 */
export const TAILLE_CODE = 6;

export function coder(s: ScrutinNuage): string {
  const l = LEGISLATURES.indexOf(s.legislature);
  const c = CATEGORIES.indexOf(s.categorie);
  if (l < 0 || c < 0) throw new Error("scrutin hors du nuage");
  if (s.jour < 0 || s.jour >= 4096 || s.numero < 0 || s.numero >= 262144) {
    throw new Error("valeur hors limites");
  }
  const tete = (l * CATEGORIES.length + c) * 2 + (s.adopte ? 1 : 0);
  return (
    ALPHABET.charAt(tete) +
    ALPHABET.charAt(s.jour >> 6) +
    ALPHABET.charAt(s.jour & 63) +
    ALPHABET.charAt(s.numero >> 12) +
    ALPHABET.charAt((s.numero >> 6) & 63) +
    ALPHABET.charAt(s.numero & 63)
  );
}

export function decoder(codes: string): ScrutinNuage[] {
  if (codes.length % TAILLE_CODE !== 0) throw new Error("codage tronqué");
  const valeur = (i: number): number => {
    const v = VALEUR.get(codes.charAt(i));
    if (v === undefined) throw new Error("caractère inconnu dans le codage");
    return v;
  };
  const scrutins: ScrutinNuage[] = [];
  for (let i = 0; i < codes.length; i += TAILLE_CODE) {
    const tete = valeur(i);
    const lc = tete >> 1;
    const categorie = CATEGORIES[lc % CATEGORIES.length];
    const legislature = LEGISLATURES[Math.floor(lc / CATEGORIES.length)];
    if (categorie === undefined || legislature === undefined) {
      throw new Error("en-tête inconnu dans le codage");
    }
    scrutins.push({
      legislature,
      categorie,
      adopte: (tete & 1) === 1,
      jour: (valeur(i + 1) << 6) | valeur(i + 2),
      numero: (valeur(i + 3) << 12) | (valeur(i + 4) << 6) | valeur(i + 5),
    });
  }
  return scrutins;
}

/**
 * Rangées de l'hémicycle, en distance à la tribune : la XVe législature au
 * premier rang, la XVIIe au dernier, où l'arc est le plus long. C'est aussi
 * la plus dense : 8 434 scrutins en deux ans.
 */
export const RANGEES: Record<LegislatureNuage, readonly [number, number]> = {
  15: [0.45, 0.68],
  16: [0.72, 0.92],
  17: [0.96, 1.28],
};

/** L'arc de l'hémicycle, d'un bord à l'autre, en radians. */
const ARC: readonly [number, number] = [0.06 * Math.PI, 0.94 * Math.PI];

/** Décalage qui ramène le centre de l'hémicycle à l'origine, pivot de la rotation. */
export const DECALAGE = { y: -0.3, z: 0.6 } as const;

export interface Disposition {
  /** x, y, z de chaque scrutin, centrés sur l'origine ; y vers le haut. */
  position: Float32Array;
  /** Taille relative du triangle. */
  taille: Float32Array;
  /**
   * Valeur propre à chaque scrutin, entre 0 et 1 : elle fixe l'orientation
   * du triangle et décale sa respiration, pour que le nuage ne bouge pas
   * d'un bloc.
   */
  phase: Float32Array;
  /** Indice de la teinte, dans l'ordre de TEINTES. */
  teinte: Uint8Array;
}

/**
 * Générateur pseudo-aléatoire à graine (mulberry32). La graine vient du
 * scrutin lui-même : un scrutin occupe toujours la même place, d'une visite
 * à l'autre.
 */
function alea(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hauteur de l'hémicycle en un point. Les gradins montent avec le rang, un
 * bombé les arrondit en lobe, comme un hémisphère de cerveau, et des plis
 * ondulent en surface. Bombé et plis sont graphiques : ils ne changent ni le
 * rang ni la date d'un scrutin, seulement son altitude.
 */
function hauteur(r: number, theta: number): number {
  const gradins = 0.32 * (r - RANGEES[15][0]);
  const lobe = 0.46 * Math.sqrt(Math.max(0, 1 - ((r - 0.87) / 0.5) ** 2));
  const plis = 0.045 * Math.sin(theta * 15 + r * 8) * Math.sin(r * 12 + theta * 3);
  return gradins + lobe + plis;
}

/**
 * Place chaque scrutin dans l'hémicycle. Le rang dit la législature ; de
 * gauche à droite, l'arc suit le calendrier de cette législature ; la place
 * dans la profondeur du rang est tirée au hasard, pour que les scrutins d'un
 * même jour ne s'empilent pas. Les motions de censure flottent au-dessus des
 * gradins : rares, elles engagent le gouvernement, le dessin les détache. Les
 * autres votes (résolutions, parties de budget), qui ne portent ni sur un
 * texte ni sur ses articles, gravitent autour, en triangles épars.
 */
export function disposer(scrutins: ScrutinNuage[]): Disposition {
  const n = scrutins.length;
  const bornes = new Map<LegislatureNuage, { min: number; max: number }>();
  for (const s of scrutins) {
    const b = bornes.get(s.legislature);
    if (!b) bornes.set(s.legislature, { min: s.jour, max: s.jour });
    else {
      b.min = Math.min(b.min, s.jour);
      b.max = Math.max(b.max, s.jour);
    }
  }

  const position = new Float32Array(n * 3);
  const taille = new Float32Array(n);
  const phase = new Float32Array(n);
  const teinte = new Uint8Array(n);

  scrutins.forEach((s, i) => {
    const hasard = alea(s.legislature * 1_000_003 + s.numero);
    const censure = s.categorie === "censure";
    const autre = s.categorie === "autre";
    let x: number;
    let y: number;
    let z: number;
    if (autre) {
      const angle = hasard() * Math.PI * 2;
      const elevation = (hasard() - 0.5) * 1.6;
      const distance = 1.5 + hasard() * 1.3;
      x = distance * Math.cos(angle) * Math.cos(elevation);
      y = distance * Math.sin(elevation) * 0.6 + 0.2;
      z = distance * Math.sin(angle) * Math.cos(elevation);
    } else {
      const b = bornes.get(s.legislature) ?? { min: s.jour, max: s.jour };
      const t = b.max > b.min ? (s.jour - b.min) / (b.max - b.min) : 0.5;
      // Léger flou le long de l’arc : les séances très chargées forment sinon
      // des rayons trop nets. Il reste inférieur à trois pour cent de l’arc.
      const theta = ARC[1] - t * (ARC[1] - ARC[0]) + (hasard() - 0.5) * 0.08;
      const [rMin, rMax] = RANGEES[s.legislature];
      const r = rMin + hasard() * (rMax - rMin);
      x = r * Math.cos(theta);
      z = -r * Math.sin(theta) + DECALAGE.z;
      // L'épaisseur donne du volume au lobe, sans changer rang ni date.
      y = hauteur(r, theta) + (hasard() - 0.5) * 0.14 + DECALAGE.y;
      if (censure) y += 0.45 + hasard() * 0.35;
    }
    position[3 * i] = x;
    position[3 * i + 1] = y;
    position[3 * i + 2] = z;
    taille[i] = censure ? 2.6 : autre ? 1.8 : s.categorie === "ensemble" ? 1.6 : 1;
    phase[i] = hasard();
    teinte[i] = TEINTES.indexOf(teinteDe(s));
  });

  return { position, taille, phase, teinte };
}
