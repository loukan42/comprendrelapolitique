import { Container } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import classes from "./SiteHeader.module.css";

/**
 * Chrome de site minimal : une marque, deux liens. Pas de menu déroulant ni
 * de recherche intégrée tant que le site ne compte que trois pages
 * naviguables (accueil, recherche, quiz) : un habillage plus lourd
 * précéderait le contenu qu'il est censé donner accès.
 */
export function SiteHeader() {
  return (
    <header className={classes["entete"]}>
      <Container size="md" className={classes["barre"]}>
        <Link to="/" className={classes["marque"]}>
          Comprendre la Politique
        </Link>
        <nav className={classes["nav"]}>
          <Link
            to="/recherche"
            className={classes["lien"]}
            activeProps={{ className: `${classes["lien"]} ${classes["lienActif"]}` }}
          >
            Rechercher
          </Link>
          <Link
            to="/quiz"
            className={classes["lien"]}
            activeProps={{ className: `${classes["lien"]} ${classes["lienActif"]}` }}
          >
            Quiz
          </Link>
        </nav>
      </Container>
    </header>
  );
}
