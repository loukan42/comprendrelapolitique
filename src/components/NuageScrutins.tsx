import { useEffect, useRef } from "react";
import { decoder, disposer, TEINTES } from "../lib/nuageScrutins";
import type { DonneesNuage } from "../queries/nuage";
import classes from "./NuageScrutins.module.css";

const nombre = new Intl.NumberFormat("fr-FR");
/** Couleur CSS en hexadécimal vers ses trois composantes entre 0 et 1. */
function composantes(couleur: string): [number, number, number] {
  let h = couleur.trim().replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const v = Number.parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(v)) return [1, 1, 1];
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** Distance de la caméra au centre de l'hémicycle. */
const DISTANCE = 3.4;
/** Inclinaison de repos : l'hémicycle est vu d'un peu au-dessus, depuis la tribune. */
const INCLINAISON = 0.72;

/*
 * Un scrutin est un point, que le processeur graphique dessine en triangle.
 * Le sommet projette le point en perspective et fixe sa taille et son
 * opacité selon la profondeur ; le fragment trace le contour d'un triangle
 * équilatéral dans le carré du point (distance signée d'Inigo Quilez).
 */
const SHADER_SOMMET = `
attribute vec3 aPosition;
attribute float aTaille;
attribute float aPhase;
attribute vec3 aCouleur;
uniform mat3 uRotation;
uniform vec2 uCentre;
uniform vec2 uResolution;
uniform float uEchelle;
uniform float uTemps;
uniform float uFacteurTaille;
uniform float uTailleMax;
uniform float uOpacite;
uniform vec2 uSouris;
uniform float uForce;
uniform float uRayon;
varying vec3 vCouleur;
varying float vAlpha;
varying float vAngle;
varying float vTaille;
void main() {
  float souffle = sin(uTemps * 0.9 + aPhase * 6.2831853);
  vec3 p = aPosition + vec3(0.0, 0.012 * souffle, 0.0);
  vec3 q = uRotation * p;
  float f = ${DISTANCE.toFixed(1)} / (${DISTANCE.toFixed(1)} - q.z);
  vec2 ecran = uCentre + vec2(q.x, -q.y) * f * uEchelle;
  // Loupe sous le curseur : les triangles proches grossissent, blanchissent
  // et s'écartent du pointeur, puis reprennent leur place quand il s'éloigne.
  vec2 delta = ecran - uSouris;
  float dist = length(delta);
  float effet = uForce * (1.0 - smoothstep(0.0, uRayon, dist));
  effet = effet * effet * (3.0 - 2.0 * effet);
  ecran += delta / max(dist, 0.001) * effet * uRayon * 0.22;
  vec2 clip = ecran / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  float prof = clamp((q.z + 1.4) / 2.8, 0.0, 1.0);
  vTaille = min(aTaille * (2.4 + 8.0 * prof) * uFacteurTaille * (1.0 + 2.4 * effet), uTailleMax);
  gl_PointSize = vTaille;
  vAlpha = max((0.06 + 0.54 * prof * prof) * uOpacite, 0.85 * effet);
  vCouleur = mix(aCouleur, vec3(1.0), 0.55 * effet);
  vAngle = aPhase * 6.2831853 + uTemps * 0.15 * (aPhase - 0.5);
}`;

const SHADER_FRAGMENT = `
precision mediump float;
varying vec3 vCouleur;
varying float vAlpha;
varying float vAngle;
varying float vTaille;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  float c = cos(vAngle);
  float s = sin(vAngle);
  p = mat2(c, -s, s, c) * p;
  const float k = 1.7320508;
  const float r = 0.6;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  float d = -length(p) * sign(p.y);
  float pixel = 2.0 / vTaille;
  float trait = max(pixel * 1.1, 0.07);
  float a = 1.0 - smoothstep(trait * 0.5, trait * 0.5 + pixel, abs(d));
  if (a <= 0.0) discard;
  float alpha = vAlpha * a;
  gl_FragColor = vec4(vCouleur * alpha, alpha);
}`;

function compiler(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

/**
 * Le nuage des scrutins, en fond de l'accroche : un triangle par scrutin
 * public depuis 2017, rangé dans un hémicycle aux gradins bombés comme un
 * cerveau. Dessiné en WebGL, en un seul appel pour les 17 000 triangles ;
 * les couleurs s'additionnent là où les triangles se superposent, ce qui
 * fait briller les rangs les plus denses.
 *
 * L'hémicycle oscille lentement, respire, et suit la souris sur toute la
 * page. Il reste immobile quand le lecteur a demandé à réduire les
 * animations, et rien n'est calculé hors de l'écran ou onglet caché. Sans
 * WebGL, rien n'est dessiné : la légende dit déjà ce que montre le nuage.
 *
 * C'est un fond : il ne capte pas le pointeur, et remplit son parent, qui
 * doit être positionné.
 */
export function NuageScrutins({
  donnees,
  className,
}: {
  donnees: DonneesNuage | null;
  className?: string | undefined;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = toile.current;
    const conteneur = boite.current;
    if (!donnees || !el || !conteneur) return;
    const gl = el.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;

    const sommet = compiler(gl, gl.VERTEX_SHADER, SHADER_SOMMET);
    const fragment = compiler(gl, gl.FRAGMENT_SHADER, SHADER_FRAGMENT);
    const programme = gl.createProgram();
    if (!sommet || !fragment || !programme) return;
    gl.attachShader(programme, sommet);
    gl.attachShader(programme, fragment);
    gl.linkProgram(programme);
    if (!gl.getProgramParameter(programme, gl.LINK_STATUS)) return;
    gl.useProgram(programme);

    const { position, taille, phase, teinte } = disposer(decoder(donnees.codes));
    const n = taille.length;
    const style = getComputedStyle(conteneur);
    const couleurs = TEINTES.map((c) => composantes(style.getPropertyValue(`--nuage-${c}`)));
    const tampon = new Float32Array(n * 8);
    for (let i = 0; i < n; i++) {
      const [r, v, b] = couleurs[teinte[i] ?? 0] ?? [1, 1, 1];
      tampon.set(
        [
          position[3 * i] ?? 0,
          position[3 * i + 1] ?? 0,
          position[3 * i + 2] ?? 0,
          taille[i] ?? 1,
          phase[i] ?? 0,
          r,
          v,
          b,
        ],
        i * 8,
      );
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, tampon, gl.STATIC_DRAW);
    const attribut = (nom: string, composants: number, decalage: number) => {
      const loc = gl.getAttribLocation(programme, nom);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, composants, gl.FLOAT, false, 32, decalage * 4);
    };
    attribut("aPosition", 3, 0);
    attribut("aTaille", 1, 3);
    attribut("aPhase", 1, 4);
    attribut("aCouleur", 3, 5);

    const u = (nom: string) => gl.getUniformLocation(programme, nom);
    const uRotation = u("uRotation");
    const uCentre = u("uCentre");
    const uResolution = u("uResolution");
    const uEchelle = u("uEchelle");
    const uTemps = u("uTemps");
    const uFacteurTaille = u("uFacteurTaille");
    const uOpacite = u("uOpacite");
    const uSouris = u("uSouris");
    const uForce = u("uForce");
    const uRayon = u("uRayon");
    const plage = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
    gl.uniform1f(u("uTailleMax"), plage?.[1] ?? 64);
    gl.enable(gl.BLEND);
    // Addition des couleurs : là où les triangles s'accumulent, le dessin brille.
    gl.blendFunc(gl.ONE, gl.ONE);

    const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rotation = new Float32Array(9);
    let largeur = 0;
    let hauteur = 0;
    let dpr = 1;
    let echelle = 1;
    let centre: [number, number] = [0, 0];
    let opacite = 1;
    let temps = 0;
    let parX = 0;
    let parY = 0;
    let cibleX = 0;
    let cibleY = 0;
    // Position du pointeur sur le canvas et intensité de la loupe, lissées.
    let sourisX = -9999;
    let sourisY = -9999;
    let cibleSourisX = -9999;
    let cibleSourisY = -9999;
    let force = 0;
    let cibleForce = 0;
    let visible = true;
    let image = 0;
    let precedent = 0;

    function dessiner() {
      if (!largeur || !gl) return;
      // Oscillation lente autour de l'axe vertical, plus la parallaxe.
      const azimut = 0.32 * Math.sin(temps * 0.12) + parX * 0.3;
      const inclinaison = INCLINAISON + parY * 0.12;
      const ca = Math.cos(azimut);
      const sa = Math.sin(azimut);
      const ci = Math.cos(inclinaison);
      const si = Math.sin(inclinaison);
      // Rotation autour de la verticale, puis inclinaison vers le lecteur,
      // rangée en colonnes comme l'attend WebGL.
      rotation.set([ca, sa * si, -sa * ci, 0, ci, si, sa, -ca * si, ca * ci]);
      gl.viewport(0, 0, el!.width, el!.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix3fv(uRotation, false, rotation);
      gl.uniform2f(uCentre, centre[0], centre[1]);
      gl.uniform2f(uResolution, largeur, hauteur);
      gl.uniform1f(uEchelle, echelle);
      gl.uniform1f(uTemps, temps);
      gl.uniform1f(uFacteurTaille, (echelle / 380) * dpr);
      gl.uniform1f(uOpacite, opacite);
      gl.uniform2f(uSouris, sourisX, sourisY);
      gl.uniform1f(uForce, force);
      gl.uniform1f(uRayon, Math.max(90, echelle * 0.42));
      gl.drawArrays(gl.POINTS, 0, n);
    }

    function redimensionner() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      largeur = conteneur!.clientWidth;
      hauteur = conteneur!.clientHeight;
      el!.width = Math.round(largeur * dpr);
      el!.height = Math.round(hauteur * dpr);
      const large = largeur >= 992;
      // Sur grand écran l'hémicycle occupe la droite et le texte la gauche ;
      // sur mobile il passe derrière le texte, plus bas et plus discret.
      centre = large ? [largeur * 0.68, hauteur * 0.5] : [largeur * 0.5, hauteur * 0.74];
      echelle = large
        ? Math.min(largeur * 0.25, hauteur * 0.5)
        : Math.min(largeur * 0.42, hauteur * 0.3);
      opacite = large ? 1 : 0.55;
      dessiner();
    }

    function boucle(t: number) {
      const dt = precedent ? Math.min(0.05, (t - precedent) / 1000) : 0;
      precedent = t;
      temps += dt;
      const lissage = 1 - Math.exp(-dt * 2.5);
      parX += (cibleX - parX) * lissage;
      parY += (cibleY - parY) * lissage;
      const suivi = 1 - Math.exp(-dt * 14);
      if (sourisX < -9000) {
        sourisX = cibleSourisX;
        sourisY = cibleSourisY;
      }
      sourisX += (cibleSourisX - sourisX) * suivi;
      sourisY += (cibleSourisY - sourisY) * suivi;
      force += (cibleForce - force) * (1 - Math.exp(-dt * 5));
      dessiner();
      image = requestAnimationFrame(boucle);
    }

    function demarrer() {
      if (mouvementReduit || image || !visible || document.hidden) return;
      precedent = 0;
      image = requestAnimationFrame(boucle);
    }

    function arreter() {
      if (image) cancelAnimationFrame(image);
      image = 0;
    }

    // La parallaxe suit la souris sur toute la fenêtre, texte compris.
    function surPointeur(e: PointerEvent) {
      if (e.pointerType !== "mouse") return;
      cibleX = (e.clientX / window.innerWidth) * 2 - 1;
      cibleY = (e.clientY / window.innerHeight) * 2 - 1;
      const cadre = el!.getBoundingClientRect();
      const x = e.clientX - cadre.left;
      const y = e.clientY - cadre.top;
      const dedans = x >= 0 && y >= 0 && x <= cadre.width && y <= cadre.height;
      cibleSourisX = x;
      cibleSourisY = y;
      cibleForce = dedans ? 1 : 0;
    }

    const ro = new ResizeObserver(redimensionner);
    ro.observe(conteneur);
    const io = new IntersectionObserver(([entree]) => {
      visible = entree?.isIntersecting ?? true;
      if (visible) demarrer();
      else arreter();
    });
    io.observe(conteneur);
    const surVisibilite = () => (document.hidden ? arreter() : demarrer());
    document.addEventListener("visibilitychange", surVisibilite);
    if (!mouvementReduit) window.addEventListener("pointermove", surPointeur);

    redimensionner();
    demarrer();

    return () => {
      arreter();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("pointermove", surPointeur);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(programme);
    };
  }, [donnees]);

  return (
    <div ref={boite} className={`${classes["conteneur"]} ${className ?? ""}`}>
      <canvas
        ref={toile}
        className={classes["toile"]}
        role="img"
        aria-label={
          donnees
            ? `Hémicycle de ${nombre.format(donnees.total)} scrutins publics de l'Assemblée nationale depuis 2017, colorés selon l'objet du vote. La légende en donne le détail.`
            : "Hémicycle des scrutins publics de l'Assemblée nationale, en cours de chargement."
        }
      />
    </div>
  );
}
