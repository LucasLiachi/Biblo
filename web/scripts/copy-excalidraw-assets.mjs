// Copia as fontes do Excalidraw para public/ para que o canvas funcione offline (sem esm.sh).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(web, "node_modules/@excalidraw/excalidraw/dist/prod/fonts");
const to = path.join(web, "public/excalidraw-assets/fonts");

if (!fs.existsSync(from)) {
  console.error(`Fontes do Excalidraw não encontradas em ${from}. Rode npm install.`);
  process.exit(1);
}
fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log(`✓ fontes do Excalidraw → ${path.relative(web, to)}`);
