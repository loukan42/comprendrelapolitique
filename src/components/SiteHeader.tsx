import { ActionIcon, Burger, Button, Container, Drawer, Image, Menu, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { Link, useLocation } from "@tanstack/react-router";
import logo from "../assets/politiquiz.png";
import classes from "./SiteHeader.module.css";

const QUIZ = [
  { to: "/quiz", libelle: "Quiz des votes", detail: "Quelles formations votent comme vous ?" },
  {
    to: "/programmes/quiz",
    libelle: "Quiz des programmes",
    detail: "Quels candidats vous ressemblent ?",
  },
] as const;

const APRES_QUIZ = [
  { to: "/programmes/comparer", libelle: "Comparer" },
  { to: "/lois", libelle: "Lois" },
  { to: "/bilans", libelle: "Bilans" },
  { to: "/themes", libelle: "Thèmes" },
] as const;

/**
 * En-tête du site : Actualité, Quiz (deux entrées), Comparer, Lois & votes,
 * Bilans, Thèmes, la recherche en icône, et un seul bouton, le quiz. Les
 * programmes vivent dans les quiz et le comparateur.
 *
 * Sous 992 px, les liens passent dans un tiroir ouvert par un bouton de
 * menu, plutôt que de s'empiler sur trois lignes au-dessus de chaque page.
 */
export function SiteHeader() {
  const [ouvert, { toggle, close }] = useDisclosure(false);
  const chemin = useLocation({ select: (l) => l.pathname });
  const quizActif = chemin === "/quiz" || chemin.startsWith("/programmes/quiz");

  return (
    <header className={classes["entete"]}>
      <a href="#contenu" className={classes["evitement"]}>
        Aller au contenu
      </a>
      <Container size={1200} px={{ base: "md", sm: "xl" }} className={classes["barre"]}>
        <Link
          to="/"
          className={classes["marque"]}
          aria-label="Politiquizz, accueil"
          onClick={close}
        >
          <Image src={logo} alt="" h={40} w="auto" fit="contain" className={classes["logo"]} />
        </Link>

        <nav className={classes["nav"]} aria-label="Navigation principale">
          <Link
            to="/actualite"
            className={classes["lien"]}
            activeProps={{ className: `${classes["lien"]} ${classes["lienActif"]}` }}
          >
            Actualité
          </Link>
          <Menu trigger="click-hover" position="bottom-start" offset={10} width={260} radius="md">
            <Menu.Target>
              <button
                type="button"
                className={`${classes["lien"]} ${classes["declencheur"]} ${quizActif ? classes["lienActif"] : ""}`}
              >
                Quiz <IconChevronDown size={12} />
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              {QUIZ.map((q) => (
                <Menu.Item key={q.to} component={Link} to={q.to}>
                  <span className={classes["itemMenu"]}>{q.libelle}</span>
                  <span className={classes["detailMenu"]}>{q.detail}</span>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          {APRES_QUIZ.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={classes["lien"]}
              activeProps={{ className: `${classes["lien"]} ${classes["lienActif"]}` }}
            >
              {l.libelle}
            </Link>
          ))}
          <ActionIcon
            component={Link}
            to="/recherche"
            variant="subtle"
            color="gray"
            radius="xl"
            aria-label="Rechercher"
          >
            <IconSearch size={18} />
          </ActionIcon>
        </nav>

        {!quizActif && (
          <Button component={Link} to="/quiz" size="sm" className={classes["action"]}>
            Faire le quiz
          </Button>
        )}

        <Burger
          opened={ouvert}
          onClick={toggle}
          size="sm"
          className={classes["burger"]}
          aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={ouvert}
          aria-controls="tiroir-nav"
        />
      </Container>

      <Drawer
        id="tiroir-nav"
        opened={ouvert}
        onClose={close}
        position="right"
        size="100%"
        padding="xl"
        title="Menu"
        classNames={{ title: classes["titreTiroir"] }}
      >
        <Stack gap="lg" component="nav" aria-label="Navigation principale">
          {[
            { to: "/actualite", libelle: "Actualité" },
            ...QUIZ,
            ...APRES_QUIZ,
            { to: "/recherche", libelle: "Rechercher" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={close}
              className={classes["lienTiroir"]}
              activeProps={{ className: `${classes["lienTiroir"]} ${classes["lienTiroirActif"]}` }}
            >
              {l.libelle}
            </Link>
          ))}
          <Button component="a" href="/quiz" onClick={close} fullWidth mt="md">
            Faire le quiz
          </Button>
        </Stack>
      </Drawer>
    </header>
  );
}
