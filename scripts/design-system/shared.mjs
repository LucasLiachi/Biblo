// Mapa único do que é "fonte" (.docs/design-system) e do que é "cópia gerada" (web/).
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DS = path.join(ROOT, ".docs/design-system");
export const WEB = path.join(ROOT, "web");

export const header = (source) =>
  `/* GERADO por scripts/design-system/sync.mjs a partir de .docs/design-system/${source}. NÃO EDITE: altere a fonte e rode "npm run ds:sync". */\n`;

/** [fonte relativa a DS, destino relativo a WEB, recebe cabeçalho?] */
export const GENERATED = [
  ["tokens.css", "src/styles/tokens.css", true],
  ["components/bundle.css", "src/styles/bundle.css", true],
  ["brand/favicon.svg", "public/favicon.svg", false],
  ["brand/owl-solid.svg", "public/brand/owl-solid.svg", false],
  ["brand/owl-line.svg", "public/brand/owl-line.svg", false],
  ["brand/owl-duotone.svg", "public/brand/owl-duotone.svg", false],
  ["brand/app-icon-ink.svg", "public/brand/app-icon-ink.svg", false],
  ["brand/app-icon-amber.svg", "public/brand/app-icon-amber.svg", false],
  ["brand/app-icon-paper.svg", "public/brand/app-icon-paper.svg", false],
  ["brand/app-icon-outline.svg", "public/brand/app-icon-outline.svg", false],
  ["brand/png/favicon-16.png", "public/brand/favicon-16.png", false],
  ["brand/png/favicon-32.png", "public/brand/favicon-32.png", false],
  ["brand/png/favicon-48.png", "public/brand/favicon-48.png", false],
  ["brand/png/apple-touch-icon.png", "public/brand/apple-touch-icon.png", false],
  ["brand/png/icon-192.png", "public/brand/icon-192.png", false],
  ["brand/png/icon-512.png", "public/brand/icon-512.png", false],
];
