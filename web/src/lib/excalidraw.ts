/**
 * Leitura de arquivos .excalidraw do vault.
 *
 * Arquivos gravados pelo canvas provisório (antes do Excalidraw real) usam um formato
 * próprio: { type: "sticky" | "flowchart-process" | ..., text, x, y, fromId, toId }.
 * Eles são convertidos em "esqueletos" do Excalidraw na abertura e passam a ser
 * gravados no formato nativo no primeiro salvamento. Nada é descartado.
 */

export interface LegacyElement {
  id?: string;
  type?: string;
  text?: string;
  frameTitle?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fromId?: string;
  toId?: string;
}

/** Esqueleto aceito por convertToExcalidrawElements (subset que usamos). */
export interface Skeleton {
  type: "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "frame";
  id?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  name?: string;
  children?: string[];
  backgroundColor?: string;
  fillStyle?: "solid";
  roundness?: { type: 3 } | null;
  label?: { text: string };
  start?: { id: string };
  end?: { id: string };
}

const SHAPE_MAP: Record<string, Skeleton["type"]> = {
  rectangle: "rectangle",
  "rounded-rect": "rectangle",
  "flowchart-process": "rectangle",
  "flowchart-document": "rectangle",
  "cloud-node": "rectangle",
  cylinder: "rectangle",
  sticky: "rectangle",
  "mindmap-node": "rectangle",
  circle: "ellipse",
  cloud: "ellipse",
  star: "ellipse",
  "flowchart-terminator": "ellipse",
  diamond: "diamond",
  triangle: "diamond",
  "flowchart-decision": "diamond",
};

// Paleta "post-it" do próprio Excalidraw (cores do seletor nativo), para manter o significado visual.
const STICKY_FILL = "#ffec99"; // ds-allow-hex: cor de conteúdo do diagrama (paleta nativa do Excalidraw), não de UI

export function isNativeExcalidraw(data: unknown): boolean {
  const elements = (data as { elements?: unknown[] })?.elements;
  return Array.isArray(elements) && elements.every((el) => typeof (el as { version?: unknown }).version === "number");
}

export function legacyToSkeletons(elements: LegacyElement[]): Skeleton[] {
  const skeletons: Skeleton[] = [];
  let auto = 0;
  const nextPos = () => ({ x: 120 + (auto % 4) * 220, y: 120 + Math.floor(auto++ / 4) * 140 });
  const ids = new Set(elements.map((e) => e.id).filter(Boolean));

  for (const el of elements) {
    const pos = el.x !== undefined && el.y !== undefined ? { x: el.x, y: el.y } : nextPos();
    const text = (el.text ?? "").trim();
    if ((el.type === "arrow" || el.type === "connector") && el.fromId && el.toId && ids.has(el.fromId) && ids.has(el.toId)) {
      skeletons.push({ type: "arrow", ...pos, start: { id: el.fromId }, end: { id: el.toId }, ...(text ? { label: { text } } : {}) });
      continue;
    }
    if (el.type === "text" || el.type === "arrow" || el.type === "connector") {
      if (text) skeletons.push({ type: "text", ...pos, text });
      continue;
    }
    if (el.type === "frame") {
      skeletons.push({ type: "text", ...pos, text: el.frameTitle || text || "Seção" });
      continue;
    }
    const shape = SHAPE_MAP[el.type ?? ""] ?? "rectangle";
    skeletons.push({
      type: shape,
      id: el.id,
      ...pos,
      width: el.width ?? 180,
      height: el.height ?? 80,
      ...(el.type === "sticky" ? { backgroundColor: STICKY_FILL, fillStyle: "solid" as const } : {}),
      ...(el.type === "rounded-rect" || el.type === "sticky" ? { roundness: { type: 3 as const } } : {}),
      ...(text ? { label: { text } } : {}),
    });
  }
  return skeletons;
}

export function parseScene(content: string): { native: boolean; data: Record<string, unknown> } {
  let data: Record<string, unknown> = {};
  try {
    data = content.trim() ? JSON.parse(content) : {};
  } catch {
    data = {};
  }
  if (!Array.isArray(data.elements)) data.elements = [];
  return { native: isNativeExcalidraw(data), data };
}
