// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    optimizeDeps: {
      // Mantine represente plusieurs centaines de modules. Sans cette
      // declaration, Vite ne les decouvre qu'a la premiere requete et
      // relance son pre-bundling pendant le rendu serveur, qui attend
      // puis abandonne au bout de 60 s. Le premier chargement echouait.
      //
      // Meme defaut pour le coeur du routeur : un cache reconstruit apres un
      // changement de lockfile ne contenait pas @tanstack/router-core ni
      // seroval, que Vite ne decouvrait qu'en chargeant les routes. Le
      // re-bundling lance au milieu du rendu serveur faisait expirer le
      // premier import au bout de 60 s, et toutes les pages repondaient 500.
      include: [
        "@mantine/core",
        "@mantine/hooks",
        "@tabler/icons-react",
        "@tanstack/router-core",
        "@tanstack/router-core/isServer",
        "@tanstack/router-core/ssr/client",
        "seroval",
      ],
    },
    server: {
      watch: {
        // data/ porte les jeux Open Data decompresses et la base PGlite :
        // pres de 200 000 fichiers une fois les amendements et les debats
        // charges. Le site n'en importe aucun, les surveiller ne sert pas le
        // rechargement a chaud, et leur parcours initial occupe le serveur au
        // premier rendu. .claude/ est deja exclu par la configuration Lovable.
        ignored: ["**/data/**"],
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
