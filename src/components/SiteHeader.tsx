import { Button, Container, Image } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import logo from "../assets/politiquiz.png";
import classes from "./SiteHeader.module.css";

const LIENS = [
  { to: "/actualite", libelle: "En ce moment" },
  { to: "/themes", libelle: "Thèmes" },
  { to: "/recherche", libelle: "Rechercher" },
  { to: "/bilans", libelle: "Bilans" },
  { to: "/programmes", libelle: "Programmes" },
] as const;

/**
 * En-tête du site, sur la largeur de l'accueil : la marque à gauche, les
 * liens en petites capitales, et à droite un seul bouton, le quiz, comme la
 * pastille d'action de la référence (voir src/theme.ts). Le bouton disparaît
 * sur mobile, où les liens passent déjà à la ligne.
 */
export function SiteHeader() {
  return (
    <header className={classes["entete"]}>
      <Container size={1200} px={{ base: "md", sm: "xl" }} className={classes["barre"]}>
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
          {LIENS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={classes["lien"]}
              activeProps={{ className: `${classes["lien"]} ${classes["lienActif"]}` }}
            >
              {l.libelle}
            </Link>
          ))}
        </nav>
        <Button component="a" href="/quiz" size="sm" className={classes["action"]}>
          Faire le quiz
        </Button>
      </Container>
    </header>
  );
}
