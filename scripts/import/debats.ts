/**
 * Analyse du format XML « syceron » des comptes rendus intégraux de séance.
 *
 * Contrairement aux autres jeux (JSON), ce format n'a jamais été inspecté
 * avant cette session. Les constats qui suivent sont documentés en détail
 * dans docs/DATA_SOURCES.md ; ce module se contente de les traduire en code.
 *
 * Un compte rendu (`compteRendu`) porte une séance (`seanceRef`, le même
 * identifiant que `officiel.scrutin.seance_ref`) et un arbre de `point`
 * (récursif, profondeur variable) contenant des `paragraphe` : la plus petite
 * unité de parole ou de mention procédurale, jamais imbriquée. Un `paragraphe`
 * porte, dans ses attributs, `id_acteur` (qui parle, quand la source
 * l'identifie) et un unique `<texte>` mêlant texte brut et balises de mise en
 * forme (`italique`, `exposant`, `indice`, `br`).
 *
 * Aucun élément du fichier ne référence un dossier ou un document législatif :
 * le seul point d'ancrage vers le reste du modèle est `seanceRef`.
 */

export interface Attrs {
  [nom: string]: string;
}

export interface LigneSeance {
  uid: string;
  compteRenduUid: string;
  legislature: number | null;
  sessionRef: string | null;
  sessionLibelle: string | null;
  dateSeance: string | null;
  dateSeanceJour: string | null;
  numSeance: number | null;
  numSeanceJour: string | null;
  etat: string | null;
  diffusion: string | null;
}

export interface LignePoint {
  idSyceron: string;
  parentIdSyceron: string | null;
  typeConteneur: "point" | "ouvertureSeance" | "finSeance" | "changementPresidence";
  nivpoint: number | null;
  ordreAbsolu: number | null;
  intitule: string | null;
}

export interface LigneOrateur {
  orateurIdBrut: string | null;
  nom: string | null;
  qualite: string | null;
}

export interface LigneIntervention {
  idSyceron: string;
  pointIdSyceron: string | null;
  ordreAbsolu: number | null;
  codeGrammaire: string | null;
  codeStyle: string | null;
  roleDebat: string | null;
  acteurUid: string | null;
  mandatUid: string | null;
  texte: string | null;
  orateurs: LigneOrateur[];
}

export interface CompteRendu {
  seance: LigneSeance;
  points: LignePoint[];
  interventions: LigneIntervention[];
}

// ---------------------------------------------------------------------------
// Utilitaires bas niveau
// ---------------------------------------------------------------------------

function vide(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function decoderEntites(s: string): string {
  // La seule entité rencontrée dans le corpus XVIe est `&amp;` (vérifié par
  // balayage d'un échantillon). Pas de `&lt;`/`&gt;`/`&#…` observés : le texte
  // brut n'a jamais besoin d'échapper un chevron.
  return s.replace(/&amp;/g, "&");
}

/**
 * Aplatit le contenu mixte d'un `<texte>` : ne garde que le texte, en
 * retirant les balises de mise en forme `italique`, `exposant`, `indice`
 * (jamais imbriquées entre elles au-delà d'un niveau dans le corpus) et en
 * transformant `<br/>` en retour à la ligne, seule information de structure
 * que ces balises portent.
 */
export function aplatirTexte(brut: string): string | null {
  const s = decoderEntites(
    brut
      .replace(/<br\s*\/>/g, "\n")
      .replace(/<\/?(italique|exposant|indice)>/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n"),
  ).trim();
  return s.length > 0 ? s : null;
}

/** Analyse `nom="valeur"` répétés. Les valeurs ne contiennent jamais `"` ni `>`. */
function parserAttrs(brut: string): Attrs {
  const attrs: Attrs = {};
  const re = /([\w:.-]+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(brut))) attrs[m[1]!] = m[2]!;
  return attrs;
}

/**
 * `id_acteur` vaut parfois `PA0` (« Un député du groupe LR », un orateur non
 * identifié — 3 680 occurrences sur le corpus XVIe) ou un entier négatif
 * (`PA-121449`, 684 occurrences), ni l'un ni l'autre n'étant un acteur réel.
 * Même logique que `PO0` pour les organes (DATA_SOURCES 5.6) : on ne recopie
 * jamais un identifiant de remplissage.
 */
export function acteurValide(id: string | undefined | null): string | null {
  if (!id) return null;
  return /^PA[1-9]\d*$/.test(id) ? id : null;
}

/** `id_mandat` vaut `-1` quand la source ne le renseigne pas. */
export function mandatValide(id: string | undefined | null): string | null {
  if (!id || id === "-1") return null;
  return id;
}

// ---------------------------------------------------------------------------
// Métadonnées de séance
// ---------------------------------------------------------------------------

function champ(bloc: string, tag: string): string | null {
  const m = bloc.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? vide(decoderEntites(m[1]!)) : null;
}

function entierOuNul(s: string | null): number | null {
  if (s === null) return null;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * `dateSeance` est un horodatage compact sans séparateurs,
 * `YYYYMMDDHHMMSSmmm` (17 chiffres : date, heure, milliseconde). Vérifié sur
 * l'intégralité du corpus XVIe : toujours 17 chiffres.
 */
export function horodatageSeance(brut: string | null): string | null {
  if (!brut || !/^\d{17}$/.test(brut)) return null;
  const iso = `${brut.slice(0, 4)}-${brut.slice(4, 6)}-${brut.slice(6, 8)}T${brut.slice(8, 10)}:${brut.slice(10, 12)}:${brut.slice(12, 14)}.${brut.slice(14, 17)}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function extraireSeance(xml: string): LigneSeance {
  const iContenu = xml.indexOf("<contenu>");
  const entete = iContenu >= 0 ? xml.slice(0, iContenu) : xml;

  return {
    uid: champ(entete, "seanceRef") ?? "",
    compteRenduUid: champ(entete, "uid") ?? "",
    legislature: entierOuNul(champ(entete, "legislature")),
    sessionRef: champ(entete, "sessionRef"),
    sessionLibelle: champ(entete, "session"),
    dateSeance: horodatageSeance(champ(entete, "dateSeance")),
    dateSeanceJour: champ(entete, "dateSeanceJour"),
    numSeance: entierOuNul(champ(entete, "numSeance")),
    numSeanceJour: champ(entete, "numSeanceJour"),
    etat: champ(entete, "etat"),
    diffusion: champ(entete, "diffusion"),
  };
}

// ---------------------------------------------------------------------------
// Arbre de points et interventions
// ---------------------------------------------------------------------------

interface Cadre {
  tag: "point" | "ouvertureSeance" | "finSeance" | "changementPresidence";
  idSyceron: string | null;
  nivpoint: number | null;
  ordreAbsolu: number | null;
  /** Devient vrai dès qu'un premier enfant (point ou paragraphe) apparaît :
   *  au-delà, un `<texte>` rencontré n'est plus le titre de la section. */
  aUnEnfant: boolean;
  intitule: string | null;
}

const BALISE =
  /<(point|\/point|ouvertureSeance|\/ouvertureSeance|finSeance|\/finSeance|changementPresidence|\/changementPresidence|paragraphe|texte)\b([^>]*)>/g;

function analyserOrateurs(inner: string): LigneOrateur[] {
  const bloc = inner.match(/<orateurs>([\s\S]*?)<\/orateurs>/);
  if (!bloc) return [];
  const sortie: LigneOrateur[] = [];
  const re = /<orateur>([\s\S]*?)<\/orateur>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bloc[1]!))) {
    const o = m[1]!;
    const nom = o.match(/<nom>([^<]*)<\/nom>/)?.[1] ?? null;
    const id = o.match(/<id>([^<]*)<\/id>/)?.[1] ?? null;
    const qualite = o.match(/<qualite>([^<]*)<\/qualite>/)?.[1] ?? null;
    sortie.push({
      orateurIdBrut: vide(id),
      nom: nom ? vide(decoderEntites(nom)) : null,
      qualite: qualite ? vide(decoderEntites(qualite)) : null,
    });
  }
  return sortie;
}

/**
 * Parcourt le corps de `<contenu>` en maintenant une pile des conteneurs
 * ouverts (`point`, `ouvertureSeance`, `finSeance`, `changementPresidence`).
 * `paragraphe` ne s'imbrique jamais (vérifié sur l'intégralité du corpus
 * XVIe, profondeur maximale 1) : chaque occurrence est traitée comme une
 * feuille, son contenu extrait par une recherche de la fermeture
 * correspondante plutôt que par un parcours récursif. `point`, lui, EST
 * récursif et de profondeur variable (1 à 5, plus les codes de procédure 99
 * et 100) : la pile absorbe n'importe quelle profondeur sans code dédié par
 * niveau, même précaution que pour `acteLegislatif` (DATA_SOURCES section 4).
 *
 * `changementPresidence` (149 occurrences sur 605 fichiers de la XVIe) suit
 * la même grammaire que `point` : `id_syceron`, `nivpoint` (souvent `100` ou
 * `101`, code de procédure), un `<texte>` de titre (« Présidence de Mme… »)
 * et des `paragraphe` enfants. Elle est traitée comme un conteneur de
 * structure à part entière plutôt que fondue dans le `point` englobant :
 * DATA_SOURCES section 7 ter.2.
 */
export function analyserContenu(xml: string): {
  points: LignePoint[];
  interventions: LigneIntervention[];
} {
  const iContenu = xml.indexOf("<contenu>");
  const iFinContenu = xml.indexOf("</contenu>");
  if (iContenu < 0 || iFinContenu < 0) return { points: [], interventions: [] };
  const corps = xml.slice(iContenu, iFinContenu);

  const points: LignePoint[] = [];
  const interventions: LigneIntervention[] = [];
  const pile: Cadre[] = [];

  BALISE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BALISE.exec(corps))) {
    const tag = m[1]!;
    const attrsBrut = m[2]!;

    if (
      tag === "point" ||
      tag === "ouvertureSeance" ||
      tag === "finSeance" ||
      tag === "changementPresidence"
    ) {
      const parent = pile[pile.length - 1];
      if (parent) parent.aUnEnfant = true;
      const attrs = parserAttrs(attrsBrut);
      pile.push({
        tag,
        idSyceron: vide(attrs.id_syceron ?? null),
        nivpoint: entierOuNul(attrs.nivpoint ?? null),
        ordreAbsolu: entierOuNul(attrs.ordre_absolu_seance ?? null),
        aUnEnfant: false,
        intitule: null,
      });
      continue;
    }

    if (
      tag === "/point" ||
      tag === "/ouvertureSeance" ||
      tag === "/finSeance" ||
      tag === "/changementPresidence"
    ) {
      const cadre = pile.pop();
      if (cadre?.idSyceron) {
        const parent = pile[pile.length - 1];
        points.push({
          idSyceron: cadre.idSyceron,
          parentIdSyceron: parent?.idSyceron ?? null,
          typeConteneur: cadre.tag,
          nivpoint: cadre.nivpoint,
          ordreAbsolu: cadre.ordreAbsolu,
          intitule: cadre.intitule,
        });
      }
      continue;
    }

    if (tag === "paragraphe") {
      const parent = pile[pile.length - 1];
      if (parent) parent.aUnEnfant = true;
      const attrs = parserAttrs(attrsBrut);
      const fin = corps.indexOf("</paragraphe>", BALISE.lastIndex);
      const inner = fin >= 0 ? corps.slice(BALISE.lastIndex, fin) : "";
      BALISE.lastIndex = fin >= 0 ? fin + "</paragraphe>".length : corps.length;

      const idSyceron = vide(attrs.id_syceron ?? null);
      if (!idSyceron) continue; // jamais rencontré sur le corpus mesuré, mais on n'invente pas de clé

      const texteMatch = inner.match(/<texte\b[^>]*>([\s\S]*?)<\/texte>/);
      interventions.push({
        idSyceron,
        pointIdSyceron: parent?.idSyceron ?? null,
        ordreAbsolu: entierOuNul(attrs.ordre_absolu_seance ?? null),
        codeGrammaire: vide(attrs.code_grammaire ?? null),
        codeStyle: vide(attrs.code_style ?? null),
        roleDebat: vide(attrs.roledebat ?? null),
        acteurUid: acteurValide(attrs.id_acteur),
        mandatUid: mandatValide(attrs.id_mandat),
        texte: texteMatch ? aplatirTexte(texteMatch[1]!) : null,
        orateurs: analyserOrateurs(inner),
      });
      continue;
    }

    if (tag === "texte") {
      const top = pile[pile.length - 1];
      const fin = corps.indexOf("</texte>", BALISE.lastIndex);
      const inner = fin >= 0 ? corps.slice(BALISE.lastIndex, fin) : "";
      BALISE.lastIndex = fin >= 0 ? fin + "</texte>".length : corps.length;
      // Un <texte> directement enfant d'un conteneur (avant tout autre
      // enfant) en est le titre de section : c'est la forme constatée sur
      // l'intégralité du corpus. Un <texte> rencontré après coup n'a pas de
      // rôle connu ; on l'ignore plutôt que d'écraser un titre déjà capturé.
      if (top && !top.aUnEnfant) {
        top.intitule = aplatirTexte(inner);
        top.aUnEnfant = true;
      }
      continue;
    }
  }

  return { points, interventions };
}

export function analyserCompteRendu(xml: string): CompteRendu {
  const seance = extraireSeance(xml);
  const { points, interventions } = analyserContenu(xml);
  return { seance, points, interventions };
}
