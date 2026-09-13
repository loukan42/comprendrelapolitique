/**
 * Réduction d'une explication de vote à l'essentiel.
 *
 * Le procédé est **extractif** : l'extrait est composé de phrases du compte
 * rendu, reprises mot pour mot et dans leur ordre d'origine. Rien n'est
 * reformulé. Reformuler le propos d'un orateur puis l'afficher comme la
 * position de son groupe demanderait une relecture humaine et une citation
 * vers la source (AGENTS.md section 5, règle 6) ; raccourcir en citant ne
 * pose pas ce problème, à deux conditions qui sont respectées ici : le texte
 * complet reste accessible d'un clic, et une coupe entre deux phrases
 * retenues est signalée.
 *
 * La sélection suit une règle explicite plutôt qu'un jugement : on cherche
 * les phrases où l'orateur annonce le vote de son groupe et celles où il en
 * donne la raison. C'est ce que le lecteur vient chercher, et c'est
 * vérifiable en rouvrant le texte complet.
 */

/** Didascalies du compte rendu : réactions de l'hémicycle, pas du propos. */
const DIDASCALIE =
  /\s*\((?:[^()]*(?:Applaudissements|Exclamations|Rires|Sourires|Protestations|Murmures|Mouvements)[^()]*)\)\s*/gi;

/** Annonce du sens du vote : « nous voterons pour », « le groupe s'abstiendra ». */
const ANNONCE_VOTE =
  /\b(?:nous|notre groupe|le groupe|les députés)\b[^.!?]{0,120}?\b(?:voterons?|votera|voteront|voterez|s['’]abstiendra|s['’]abstiendront|abstiendrons|abstenons|soutiendrons|soutenons|rejetterons|rejetons|opposerons|opposons|adopterons|approuverons)\b/i;

/** Formulations qui introduisent une justification. */
const RAISON =
  /\b(?:c['’]est pourquoi|pour (?:ces|toutes ces|cette) raisons?|parce que|car\b|en raison de|c['’]est la raison pour laquelle|voilà pourquoi)\b/i;

/** Marque temporaire d'un point d'abréviation, retirée avant affichage. */
const SENTINELLE = "";

/**
 * Découpe en phrases. Les abréviations courantes du compte rendu
 * (« M. Neuder », « Mme Leboucher », « n° 12 ») portent un point qui ne
 * termine pas une phrase : les couper produirait des fragments illisibles.
 * Le point est masqué le temps du découpage puis remis, pour que le texte
 * rendu reste celui du compte rendu.
 */
function decouperPhrases(texte: string): string[] {
  const protege = texte
    .replace(/\b(M|MM|Mme|Mmes|Dr|Pr|art|n[°o]|al|cf|etc)\.(\s)/gi, `$1${SENTINELLE}$2`)
    .replace(/\b([A-ZÀ-Ý])\.(\s)/g, `$1${SENTINELLE}$2`);
  return protege
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.split(SENTINELLE).join(".").trim())
    .filter((p) => p.length > 0);
}

function score(phrase: string): number {
  let s = 0;
  if (ANNONCE_VOTE.test(phrase)) s += 10;
  if (RAISON.test(phrase)) s += 4;
  // Une phrase très courte n'explique rien, une très longue n'abrège rien.
  const n = phrase.length;
  if (n >= 60 && n <= 320) s += 2;
  if (n < 40) s -= 3;
  if (n > 420) s -= 2;
  return s;
}

export interface ExtraitInterventionResultat {
  /** Phrases retenues, dans l'ordre du discours. Toujours du texte cité. */
  extrait: string;
  /** Vrai quand l'extrait saute un passage entre deux phrases retenues. */
  discontinu: boolean;
  /** Vrai quand l'extrait est le propos entier, rien n'ayant été coupé. */
  complet: boolean;
}

/**
 * Retient jusqu'à `maxPhrases` phrases : celles qui annoncent le vote et le
 * justifient, à défaut les premières du propos, où un orateur pose son
 * sujet. Le résultat suit l'ordre du discours, jamais réordonné.
 */
export function extraireEssentiel(texte: string, maxPhrases = 3): ExtraitInterventionResultat {
  const propre = texte.replace(DIDASCALIE, " ").replace(/\s+/g, " ").trim();
  const phrases = decouperPhrases(propre);
  if (phrases.length <= maxPhrases) {
    return { extrait: phrases.join(" "), discontinu: false, complet: true };
  }

  const notees = phrases.map((phrase, index) => ({ phrase, index, valeur: score(phrase) }));
  const pertinentes = notees.filter((p) => p.valeur >= 4);

  const retenues =
    pertinentes.length > 0
      ? [...pertinentes]
          .sort((a, b) => b.valeur - a.valeur || a.index - b.index)
          .slice(0, maxPhrases)
      : notees.slice(0, maxPhrases);

  const ordonnees = [...retenues].sort((a, b) => a.index - b.index);
  const discontinu = ordonnees.some((p, i) => i > 0 && p.index !== ordonnees[i - 1]!.index + 1);

  return {
    extrait: ordonnees.map((p) => p.phrase).join(" "),
    discontinu,
    complet: false,
  };
}
