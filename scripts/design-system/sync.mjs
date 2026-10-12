#!/usr/bin/env node
// Copia tokens, estilos de componentes e marca do design system para o web.
// A fonte é sempre .docs/design-system; os destinos são cópias geradas.
import fs from "node:fs";
import path from "node:path";

import { DS, GENERATED, WEB, header } from "./shared.mjs";

for (const [source, target, withHeader] of GENERATED) {
  const from = path.join(DS, source);
  const to = path.join(WEB, target);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (withHeader) {
    fs.writeFileSync(to, header(source) + fs.readFileSync(from, "utf8"));
  } else {
    fs.copyFileSync(from, to);
  }
  console.log(`✓ ${source} → web/${target}`);
}
