import { Container, Image } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import logo from "../assets/politiquiz.png";
import classes from "./SiteHeader.module.css";

/**
 * Chrome de site minimal : une marque, trois liens. Pas de menu déroulant
 * tant que le site ne compte que quatre pages naviguables (accueil, thèmes,
 * recherche, quiz) : un habillage plus lourd précéderait le contenu qu'il
 * est censé donner accès.
 */
export function SiteHeader() {
  return (
    <header className={classes["entete"]}>
      <Container size="md" className={classes["barre"]}>
        <Link to="/" className={classes["marque"]} aria-label="Comprendre la Politique">
          <Image
            src={logo}
            alt="Comprendre la Politique"
            h={44}
            w="auto"
            fit="contain"
            className={classes["logo"]}
          />
        </Link>
        <nav className={classes["nav"]}>
          <Link
            to="/themes"
            className={classes["lien"]}
            activeProps={{ className: `${classes["lien"]} ${classes["lienActif"]}` }}
          >
            Thèmes
          </Link>
          <Link
            to="/recherche"
            className={classes["lien"]}
            activeProps={{ className: `${classes["lien"]} ${classes["lienActif"]}` }}
          >
            Rechercher
          </Link>
          <Link
            to="/bilans"
            className={classes["lien"]}
            activeProps={{ className: `${classes["lien"]} ${classes["lienActif"]}` }}
          >
            Bilans
          </Link>
          <Link
            to="/programmes"
            className={classes["lien"]}
            activeProps={{ className: `${classes["lien"]} ${classes["lienActif"]}` }}
          >
            Programmes
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
