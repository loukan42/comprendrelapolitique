import {
  Anchor,
  Button,
  ColorSchemeScript,
  Container,
  Group,
  MantineProvider,
  Stack,
  Text,
  Title,
  mantineHtmlProps,
} from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

// Le CSS de Mantine vient en premier : il porte sa remise a zero.
import "@mantine/core/styles.css";

import appCss from "../styles.css?url";
import { theme } from "../theme";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";

/** Gabarit commun aux pages d'erreur : un titre, une explication, une issue. */
function PageMessage({
  titre,
  children,
  actions,
}: {
  titre: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <Container size="sm" py={96}>
      <Stack gap="md">
        <Title order={1}>{titre}</Title>
        <Text c="dimmed">{children}</Text>
        <Group gap="sm" mt="xs">
          {actions}
        </Group>
      </Stack>
    </Container>
  );
}

function NotFoundComponent() {
  return (
    <PageMessage
      titre="Cette page n'existe pas"
      actions={
        <Anchor component={Link} to="/">
          Retour à l'accueil
        </Anchor>
      }
    >
      L'adresse demandée ne correspond à aucune page du site. Elle a pu être déplacée, ou n'avoir
      jamais existé.
    </PageMessage>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <PageMessage
      titre="Cette page n'a pas pu s'afficher"
      actions={
        <>
          <Button
            variant="default"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Réessayer
          </Button>
          <Anchor href="/">Retour à l'accueil</Anchor>
        </>
      }
    >
      Une erreur s'est produite de notre côté. Aucune donnée n'a été perdue.
    </PageMessage>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Comprendre la Politique" },
      {
        name: "description",
        content:
          "Ce que font réellement les responsables politiques français, à partir des données publiques officielles.",
      },
      { property: "og:title", content: "Comprendre la Politique" },
      {
        property: "og:description",
        content:
          "Ce que font réellement les responsables politiques français, à partir des données publiques officielles.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "fr_FR" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" {...mantineHtmlProps}>
      <head>
        <HeadContent />
        {/* Sans ce script, le thème clignote au chargement : le navigateur peint
            d'abord le thème clair avant que React ne rétablisse le bon. */}
        <ColorSchemeScript />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <QueryClientProvider client={queryClient}>
        <SiteHeader />
        {/* Requis : les routes enfants s'affichent ici. Retirer l'Outlet les
            rend toutes inertes. */}
        <Outlet />
        <SiteFooter />
      </QueryClientProvider>
    </MantineProvider>
  );
}
