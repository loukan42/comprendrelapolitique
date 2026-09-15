import { Box, Text } from "@mantine/core";
import { Fragment, type CSSProperties } from "react";
import {
  ACCORDS,
  LIBELLE_ACCORD,
  type Accord,
  type Matrice,
  type PositionBenchmark,
  type QuestionBenchmark,
} from "../lib/benchmarkProgrammes";
import { libelleFormation, nomCourt } from "../lib/benchmarkProgrammes";
import classes from "./Benchmark.module.css";

/*
 * Graphiques du comparateur de programmes, dessinés en SVG et en CSS : une
 * jauge de proximité, un anneau des écarts, une matrice de proximité et un
 * axe par question. Chaque graphique a son équivalent en texte à côté ; les
 * couleurs viennent de src/styles.css (--accord-*, --bench-*) et aucune
 * n'est une couleur de parti.
 */

const pourcent = (v: number) => `${Math.round(v * 100)} %`;

/** Jauge circulaire de proximité, de 0 à 100 %. */
export function JaugeProximite({ valeur, communes }: { valeur: number | null; communes: number }) {
  const rayon = 70;
  const tour = 2 * Math.PI * rayon;
  return (
    <Box className={classes["jauge"]}>
      <svg
        viewBox="0 0 180 180"
        role="img"
        aria-label={
          valeur === null
            ? "Pas assez de questions communes pour un score de proximité."
            : `Proximité de ${pourcent(valeur)} sur ${communes} questions communes.`
        }
      >
        <circle cx="90" cy="90" r={rayon} className={classes["fondAnneau"]} strokeWidth="14" />
        {valeur !== null && (
          <circle
            cx="90"
            cy="90"
            r={rayon}
            fill="none"
            stroke="var(--accord-identique)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${tour * valeur} ${tour}`}
            transform="rotate(-90 90 90)"
          />
        )}
        <text x="90" y="96" textAnchor="middle" className={classes["valeurJauge"]}>
          {valeur === null ? "·" : pourcent(valeur)}
        </text>
        <text x="90" y="120" textAnchor="middle" className={classes["sousValeur"]}>
          PROXIMITÉ
        </text>
      </svg>
      <Text size="xs" c="dimmed" ta="center" mt={4}>
        {valeur === null
          ? `${communes} question${communes > 1 ? "s" : ""} commune${communes > 1 ? "s" : ""} : trop peu pour un score`
          : `sur ${communes} questions où les deux se prononcent`}
      </Text>
    </Box>
  );
}

/** Anneau des écarts : combien de questions à chaque degré d'accord. */
export function AnneauAccords({ repartition }: { repartition: Record<Accord, number> }) {
  const rayon = 60;
  const tour = 2 * Math.PI * rayon;
  const total = ACCORDS.reduce((s, a) => s + repartition[a], 0);
  let cumul = 0;
  return (
    <Box className={classes["anneau"]}>
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label={ACCORDS.map((a) => `${repartition[a]} ${LIBELLE_ACCORD[a]}`).join(", ")}
      >
        <circle cx="80" cy="80" r={rayon} className={classes["fondAnneau"]} strokeWidth="18" />
        {total > 0 &&
          ACCORDS.map((a) => {
            const n = repartition[a];
            if (!n) return null;
            const longueur = (tour * n) / total;
            const segment = (
              <circle
                key={a}
                cx="80"
                cy="80"
                r={rayon}
                fill="none"
                stroke={`var(--accord-${a})`}
                strokeWidth="18"
                strokeDasharray={`${longueur} ${tour - longueur}`}
                strokeDashoffset={-cumul}
                transform="rotate(-90 80 80)"
              />
            );
            cumul += longueur;
            return segment;
          })}
        <text x="80" y="86" textAnchor="middle" className={classes["valeurAnneau"]}>
          {total}
        </text>
        <text x="80" y="104" textAnchor="middle" className={classes["sousValeur"]}>
          QUESTIONS
        </text>
      </svg>
      <ul className={classes["legende"]}>
        {ACCORDS.map((a) => (
          <li key={a}>
            <span className={classes["pastille"]} data-accord={a} />
            <span>
              <strong>{repartition[a]}</strong> {LIBELLE_ACCORD[a]}
            </span>
          </li>
        ))}
      </ul>
    </Box>
  );
}

/**
 * Matrice de proximité entre toutes les formations. Plus la case est
 * lumineuse, plus les positions citées sont proches ; une case cliquée
 * compare la paire.
 */
export function MatriceProximite({
  matrice,
  a,
  b,
  onChoisir,
}: {
  matrice: Matrice;
  a: string | null;
  b: string | null;
  onChoisir: (a: string, b: string) => void;
}) {
  const n = matrice.formations.length;
  return (
    <div className={classes["defilement"]}>
      <div
        className={classes["matrice"]}
        style={{ gridTemplateColumns: `minmax(6.5rem, auto) repeat(${n}, minmax(2.75rem, 1fr))` }}
      >
        <div />
        {matrice.formations.map((f) => (
          <div key={f.formation} className={classes["enTeteColonne"]} title={libelleFormation(f)}>
            {nomCourt(f)}
          </div>
        ))}
        {matrice.formations.map((f, i) => (
          <Fragment key={f.formation}>
            <div className={classes["enTeteLigne"]} title={libelleFormation(f)}>
              {nomCourt(f)}
            </div>
            {matrice.formations.map((g, j) => {
              if (i === j) return <div key={g.formation} className={classes["diagonale"]} />;
              const v = matrice.proximite[i]?.[j] ?? null;
              const c = matrice.communes[i]?.[j] ?? 0;
              const choisie =
                (f.formation === a && g.formation === b) ||
                (f.formation === b && g.formation === a);
              const description =
                v === null
                  ? `${libelleFormation(f)} et ${libelleFormation(g)} : ${c} question${c > 1 ? "s" : ""} commune${c > 1 ? "s" : ""}, pas de score`
                  : `${libelleFormation(f)} et ${libelleFormation(g)} : ${pourcent(v)} de proximité sur ${c} questions`;
              return (
                <button
                  key={g.formation}
                  type="button"
                  className={`${classes["cellule"]} ${choisie ? classes["celluleChoisie"] : ""}`}
                  style={
                    v === null
                      ? undefined
                      : ({ "--intensite": `${Math.round(v * 80)}%` } as CSSProperties)
                  }
                  title={description}
                  aria-label={description}
                  onClick={() => onChoisir(f.formation, g.formation)}
                >
                  {v === null ? "·" : Math.round(v * 100)}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Une question sur son axe : les deux formations comparées en grand, les
 * autres en petits points gris sous l'axe, pour situer le duel dans
 * l'ensemble.
 */
export function AxeQuestion({
  question,
  a,
  b,
}: {
  question: QuestionBenchmark;
  a: PositionBenchmark | null;
  b: PositionBenchmark | null;
}) {
  const LARGEUR = 600;
  const MARGE = 24;
  const Y = 22;
  const x = (e: number) => MARGE + ((e + 2) / 4) * (LARGEUR - 2 * MARGE);
  const autres = question.positions.filter(
    (p) => p.echelle !== null && p.formation !== a?.formation && p.formation !== b?.formation,
  );
  const pile = new Map<number, number>();
  const ensemble = a?.echelle != null && a.echelle === b?.echelle;
  return (
    <Box>
      <svg
        viewBox={`0 0 ${LARGEUR} 72`}
        className={classes["axe"]}
        role="img"
        aria-label={descriptionAxe(question, a, b)}
      >
        <line x1={MARGE} x2={LARGEUR - MARGE} y1={Y} y2={Y} className={classes["ligneAxe"]} />
        {[-2, -1, 0, 1, 2].map((e) => (
          <line
            key={e}
            x1={x(e)}
            x2={x(e)}
            y1={Y - 6}
            y2={Y + 6}
            className={classes["graduation"]}
          />
        ))}
        {autres.map((p) => {
          const e = p.echelle ?? 0;
          const k = pile.get(e) ?? 0;
          pile.set(e, k + 1);
          return (
            <circle
              key={p.formation}
              cx={x(e)}
              cy={Y + 18 + k * 8}
              r="3.5"
              className={classes["pointAutre"]}
            >
              <title>{p.candidat ? `${p.candidat} (${p.formation})` : p.formation}</title>
            </circle>
          );
        })}
        {b?.echelle != null && (
          <circle cx={x(b.echelle) + (ensemble ? 7 : 0)} cy={Y} r="9" className={classes["pointB"]}>
            <title>{b.candidat ?? b.formation}</title>
          </circle>
        )}
        {a?.echelle != null && (
          <circle cx={x(a.echelle) - (ensemble ? 7 : 0)} cy={Y} r="9" className={classes["pointA"]}>
            <title>{a.candidat ?? a.formation}</title>
          </circle>
        )}
      </svg>
      <div className={classes["poles"]}>
        <span>{question.axeMoins}</span>
        <span>{question.axePlus}</span>
      </div>
    </Box>
  );
}

/** Place sur l'axe, en mots, pour les lecteurs d'écran. */
function placeEnMots(q: QuestionBenchmark, e: number): string {
  if (e <= -2) return `« ${q.axeMoins ?? ""} »`;
  if (e === -1) return `plutôt « ${q.axeMoins ?? ""} »`;
  if (e === 0) return "au milieu";
  if (e === 1) return `plutôt « ${q.axePlus ?? ""} »`;
  return `« ${q.axePlus ?? ""} »`;
}

function descriptionAxe(
  q: QuestionBenchmark,
  a: PositionBenchmark | null,
  b: PositionBenchmark | null,
): string {
  const parts = [`Axe de « ${q.axeMoins ?? ""} » à « ${q.axePlus ?? ""} ».`];
  for (const p of [a, b]) {
    if (p?.echelle != null)
      parts.push(`${p.candidat ?? p.formation} : ${placeEnMots(q, p.echelle)}.`);
  }
  return parts.join(" ");
}

/** Pastille de couleur d'une formation comparée : A ou B. */
export function Marqueur({ cote }: { cote: "a" | "b" }) {
  return <span className={classes["marqueur"]} data-cote={cote} aria-hidden="true" />;
}

/** Pastille de couleur d’un degré d’accord. */
export function PastilleAccord({ accord }: { accord: Accord }) {
  return <span className={classes["pastille"]} data-accord={accord} aria-hidden="true" />;
}
