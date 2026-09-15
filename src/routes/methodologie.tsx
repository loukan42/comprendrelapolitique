import { Alert, Anchor, Box, Card, Container, List, Stack, Text, Title } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/methodologie")({
  head: () => ({
    meta: [{ title: "Méthodologie · Politiquizz" }],
  }),
  component: PageMethodologie,
});

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <Box maw="var(--mesure-texte)">
      <Title order={2}>{titre}</Title>
      <Stack gap="sm" mt="sm">
        {children}
      </Stack>
    </Box>
  );
}

function PageMethodologie() {
  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap={40}>
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Méthodologie</Title>
          <Text mt="sm" c="dimmed">
            D&apos;où viennent les chiffres du site, comment le quiz choisit ses questions, comment
            se calcule une proximité politique, et ce que tout cela ne mesure pas.
          </Text>
        </Box>

        <Section titre="D'où viennent les données">
          <Text>
            Toutes les données proviennent de l&apos;
            <Anchor href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
              Open Data de l&apos;Assemblée nationale
            </Anchor>{" "}
            (scrutins, dossiers législatifs, députés, groupes parlementaires), sous Licence Ouverte.
            Le site couvre les XVe, XVIe et XVIIe législatures, soit les scrutins publics depuis
            2017.
          </Text>
          <Text>
            Aucune donnée n&apos;est saisie à la main : un script d&apos;import télécharge les
            archives officielles, les vérifie, et les charge dans une base dont la structure est
            documentée publiquement. Le code d&apos;import est le même que celui qui a produit les
            chiffres affichés sur ce site.
          </Text>
        </Section>

        <Section titre="Comment le quiz choisit ses questions">
          <Text>
            Une question du quiz correspond toujours à un scrutin réel portant sur{" "}
            <strong>l&apos;ensemble d&apos;un texte</strong> (pas un amendement isolé), pour que la
            question posée corresponde à une décision complète plutôt qu&apos;à un détail technique.
          </Text>
          <Text>
            Les motions de censure sont exclues du quiz : la source n&apos;enregistre que les voix «
            pour », jamais les voix « contre ». Une question construite dessus n&apos;aurait pas de
            comparaison possible.
          </Text>
          <Text>
            Les questions sont réparties entre les grands thèmes (santé, sécurité, éducation,
            retraites…) pour qu&apos;un seul sujet ne domine pas le résultat. Cette répartition
            thématique est calculée automatiquement à partir des mots du titre officiel de chaque
            texte : c&apos;est un classement provisoire, pas une donnée officielle, et il peut se
            tromper sur un texte au vocabulaire ambigu.
          </Text>
          <Text>
            Le libellé de chaque question reprend la formulation officielle du scrutin («
            l&apos;ensemble du projet de loi… »). Le site ne reformule jamais un vote au point
            d&apos;en changer le sens.
          </Text>
          <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
            La spécification du projet prévoit à terme un score d&apos;importance publique fondé sur
            la couverture médiatique et institutionnelle d&apos;un texte. Ce score n&apos;existe pas
            encore : en attendant, le nombre de votants sur un scrutin sert de repère provisoire
            pour choisir les questions les plus suivies.
          </Alert>
        </Section>

        <Section titre="Comment se calcule une proximité">
          <Text>
            Pour chaque question, le site compare votre réponse à la répartition réelle des voix
            d&apos;un groupe parlementaire sur ce même scrutin (données{" "}
            <Anchor href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
              officielles
            </Anchor>
            ). La proximité avec un groupe est la part de ses membres qui ont voté comme vous, pas
            une comparaison à sa position officielle : un groupe qui a voté à 60&nbsp;% pour un
            texte produit une proximité forte mais pas une unanimité pour un utilisateur ayant
            répondu « pour ».
          </Text>
          <Text>
            Le calcul compare toujours votre réponse à des{" "}
            <strong>votes individuels réellement enregistrés</strong>, jamais à une position de
            groupe supposée uniforme. Un groupe absent d&apos;un scrutin, ou dont aucun vote
            n&apos;est exploitable, n&apos;entre pas dans le calcul pour cette question : ce
            n&apos;est jamais compté comme un désaccord.
          </Text>
          <Text>
            Toutes les questions comptent aujourd&apos;hui à poids égal. La spécification prévoit
            une pondération par importance du texte et un plafond par dossier législatif (pour
            qu&apos;un même texte voté en plusieurs lectures ne pèse pas plusieurs fois) : cette
            pondération n&apos;est pas encore implémentée, faute du score d&apos;importance
            mentionné plus haut.
          </Text>
          <Text>
            <strong>Le calcul se déroule entièrement dans votre navigateur.</strong> Une réponse à
            une question politique est une donnée sensible : le site ne l&apos;envoie jamais à un
            serveur, ni en clair ni sous une autre forme. Seules les données déjà publiques
            (question, répartition des voix par groupe) sont chargées avant que vous répondiez.
          </Text>
        </Section>

        <Section titre="Limites à connaître">
          <List spacing="sm">
            <List.Item>
              La répartition par thème est un classement automatique par mots-clés, pas une vérité
              éditoriale : un texte peut être mal classé si son titre officiel est ambigu.
            </List.Item>
            <List.Item>
              « Je ne sais pas / passer » retire la question du calcul entièrement. Répondre «
              abstention » compte en revanche comme une position à part entière, comparée telle
              quelle aux abstentions parlementaires : comme les groupes s&apos;abstiennent en
              général moins souvent qu&apos;ils ne votent pour ou contre, répondre souvent «
              abstention » réduit mécaniquement la proximité affichée avec la plupart des groupes.
            </List.Item>
            <List.Item>
              Le site distingue un groupe parlementaire (où le vote est enregistré) d&apos;un parti
              politique : un groupe peut réunir plusieurs partis, en changer, ou changer de nom
              d&apos;une législature à l&apos;autre. Aucune table de correspondance groupe-parti
              n&apos;existe pour l&apos;instant.
            </List.Item>
            <List.Item>
              Un texte adopté par l&apos;article 49 alinéa 3 de la Constitution ne donne lieu à
              aucun vote sur son ensemble : il ne peut donc jamais fournir de question de quiz, ce
              qui est cohérent avec l&apos;absence de vote individuel à comparer.
            </List.Item>
          </List>
        </Section>

        <Card
          withBorder
          padding="lg"
          radius="md"
          style={{ borderLeft: "3px solid var(--mantine-primary-color-filled)" }}
        >
          <Title order={2} fz="lg">
            Ce que ce résultat ne dit pas
          </Title>
          <Text mt="sm">
            Ce résultat compare uniquement vos réponses à des votes parlementaires passés. Il ne
            constitue pas une recommandation électorale et ne tient pas compte de l&apos;ensemble
            des programmes, candidats ou enjeux futurs. Une proximité élevée avec un groupe sur
            quelques scrutins ne dit rien de vous au-delà de cette ressemblance mesurée sur cet
            échantillon précis de votes.
          </Text>
        </Card>

        <Section titre="Le code est public">
          <Text>
            L&apos;ensemble du code, y compris les scripts d&apos;import et les formules de calcul,
            est consultable sur{" "}
            <Anchor
              href="https://github.com/loukan42/comprendrelapolitique"
              target="_blank"
              rel="noreferrer"
            >
              le dépôt du projet
            </Anchor>
            . Aucun calcul ne reste une boîte noire.
          </Text>
        </Section>
      </Stack>
    </Container>
  );
}
