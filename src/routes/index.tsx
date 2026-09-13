import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Comprendre la Politique
      </h1>
    </div>
  );
}
