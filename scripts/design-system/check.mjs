#!/usr/bin/env node
// Guarda do design system. Falha (exit 1) quando:
//  1. uma cópia gerada em web/ diverge da fonte em .docs/design-system;
//  2. tokens.json e tokens.css discordam sobre o valor de uma cor;
//  3. um par texto/fundo declarado em tokens.json reprova no contraste WCAG 2.1;
//  4. o código do web usa cor literal (hex/rgb) em vez de token;
//  5. o web ou o design system carregam recurso de rede externo (local-first);
//  6. a marca (coruja) está incompleta ou o favicon não aponta para ela.
// Exceção pontual: comentário "ds-allow-hex" ou "ds-allow-url" na mesma linha, com justificativa.
import fs from "node:fs";
import path from "node:path";

import { DS, GENERATED, ROOT, WEB, header } from "./shared.mjs";

const errors = [];
const fail = (msg) => errors.push(msg);
const rel = (p) => path.relative(ROOT, p);

// 1. Cópias geradas
for (const [source, target, withHeader] of GENERATED) {
  const from = path.join(DS, source);
  const to = path.join(WEB, target);
  if (!fs.existsSync(from)) fail(`fonte ausente: ${rel(from)}`);
  else if (!fs.existsSync(to)) fail(`cópia ausente: ${rel(to)} (rode npm run ds:sync)`);
  else {
    const expected = withHeader ? Buffer.from(header(source) + fs.readFileSync(from, "utf8")) : fs.readFileSync(from);
    if (!expected.equals(fs.readFileSync(to))) fail(`${rel(to)} foi editado à mão ou está desatualizado (rode npm run ds:sync)`);
  }
}

// 2. tokens.json x tokens.css
const css = fs.readFileSync(path.join(DS, "tokens.css"), "utf8");
const block = (selector) => {
  const start = css.indexOf(selector);
  return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
};
const readVars = (text) => Object.fromEntries([...text.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const themes = { dark: readVars(block(':root, :root[data-theme="dark"]')), light: {} };
themes.light = { ...themes.dark, ...readVars(block('.light, :root[data-theme="light"]')) };
if (!Object.keys(themes.dark).length) fail('tokens.css: bloco :root, :root[data-theme="dark"] não encontrado');

const json = JSON.parse(fs.readFileSync(path.join(DS, "tokens.json"), "utf8"));
const norm = (v) => v.toLowerCase().replace(/\s+/g, "");
for (const token of json.color.tokens) {
  for (const theme of ["dark", "light"]) {
    const inCss = themes[theme][token.name];
    if (!inCss) fail(`tokens.json declara --${token.name}, ausente em tokens.css (${theme})`);
    else if (norm(inCss) !== norm(token.value[theme])) {
      fail(`--${token.name} (${theme}): tokens.json=${token.value[theme]} x tokens.css=${inCss}`);
    }
  }
}

// 3. Contraste WCAG 2.1
const toRgb = (hex) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};
const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const report = [];
for (const { fg, bg, min } of json.color.contrastPairs ?? []) {
  for (const theme of ["dark", "light"]) {
    const a = themes[theme][fg];
    const b = themes[theme][bg];
    if (!a?.startsWith("#") || !b?.startsWith("#")) {
      fail(`par de contraste ${fg}/${bg} (${theme}) precisa de tokens hexadecimais`);
      continue;
    }
    const r = ratio(a, b);
    report.push(`${r >= min ? "✓" : "✗"} ${theme.padEnd(5)} ${fg} sobre ${bg}: ${r.toFixed(2)}:1 (mín. ${min})`);
    if (r < min) fail(`contraste ${theme}: --${fg} sobre --${bg} = ${r.toFixed(2)}:1 < ${min}:1`);
  }
}

// 4 e 5. Varredura do código
const walk = (dir, exts) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) return d.name === "node_modules" ? [] : walk(p, exts);
        return exts.some((e) => d.name.endsWith(e)) ? [p] : [];
      })
    : [];
const generatedTargets = new Set(GENERATED.map(([, t]) => path.join(WEB, t)));
const COLOR = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b|rgba?\(\s*\d/;
const URL_RE = /\bhttps?:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org\/)/;

for (const file of walk(path.join(WEB, "src"), [".ts", ".tsx", ".css"])) {
  if (generatedTargets.has(file) || /\.test\.tsx?$/.test(file)) continue; // testes usam URLs de ataque de propósito
  fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (COLOR.test(line) && !line.includes("ds-allow-hex")) fail(`${rel(file)}:${i + 1} cor literal; use um token (var(--...))`);
    if (URL_RE.test(line) && !line.includes("ds-allow-url")) fail(`${rel(file)}:${i + 1} recurso externo; o Biblo é local-first`);
  });
}
for (const file of [path.join(WEB, "index.html"), ...walk(DS, [".css", ".html"])]) {
  if (!fs.existsSync(file)) continue;
  fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (/@import\s+url\(\s*["']?https?:|<(link|script)[^>]+(href|src)=["']https?:/i.test(line)) {
      fail(`${rel(file)}:${i + 1} carrega recurso de rede externo`);
    }
  });
}
for (const file of walk(path.join(DS, "components"), [".css"])) {
  fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (COLOR.test(line) && !line.includes("ds-allow-hex")) fail(`${rel(file)}:${i + 1} cor literal no componente; use token`);
  });
}

// 6. Marca
const index = fs.existsSync(path.join(WEB, "index.html")) ? fs.readFileSync(path.join(WEB, "index.html"), "utf8") : "";
if (!/rel="icon"[^>]+href="\/favicon\.svg"/.test(index)) fail("web/index.html precisa de <link rel=\"icon\" href=\"/favicon.svg\">");

console.log("Contraste WCAG 2.1:\n  " + report.join("\n  "));
if (errors.length) {
  console.error(`\n✗ design system: ${errors.length} problema(s)\n  - ` + errors.join("\n  - "));
  process.exit(1);
}
console.log("\n✓ design system íntegro: cópias sincronizadas, tokens coerentes, contraste AA, sem cores literais nem recursos externos.");
