import { Card, type CardProps } from "@mantine/core";
import classes from "./CarteLien.module.css";

/**
 * Une carte cliquable : bord net, pas d'ombre, surlignage de bord au survol.
 * Remplace le lien nu quand plusieurs entrées se comparent en grille
 * (AGENTS.md section « Direction : éditorial, pas SaaS » : pas d'icône dans
 * un carré arrondi, juste un contenu et un bord).
 */
export function CarteLien({
  href,
  className,
  ...props
}: CardProps & { href: string; className?: string }) {
  return (
    <Card
      component="a"
      href={href}
      withBorder
      padding="md"
      radius="md"
      className={className ? `${classes["carte"]} ${className}` : classes["carte"]}
      {...props}
    />
  );
}
