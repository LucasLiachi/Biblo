import { describe, expect, it } from "vitest";

import { isNativeExcalidraw, legacyToSkeletons, parseScene } from "./excalidraw";

describe("diagramas legados", () => {
  it("detecta formato nativo pela versão dos elementos", () => {
    expect(isNativeExcalidraw({ elements: [{ id: "a", type: "rectangle", version: 3 }] })).toBe(true);
    expect(isNativeExcalidraw({ elements: [{ id: "a", type: "sticky", text: "x" }] })).toBe(false);
  });

  it("converte post-its, formas de fluxo e conectores sem perder texto", () => {
    const skeletons = legacyToSkeletons([
      { id: "s", type: "sticky", text: "Ideia", x: 10, y: 20 },
      { id: "d", type: "flowchart-decision", text: "Aprovar?", x: 300, y: 20 },
      { id: "c", type: "connector", fromId: "s", toId: "d", text: "envia" },
      { id: "t", type: "text", text: "nota solta" },
    ]);
    expect(skeletons[0]).toMatchObject({ type: "rectangle", id: "s", label: { text: "Ideia" }, fillStyle: "solid" });
    expect(skeletons[1]).toMatchObject({ type: "diamond", label: { text: "Aprovar?" } });
    expect(skeletons[2]).toMatchObject({ type: "arrow", start: { id: "s" }, end: { id: "d" }, label: { text: "envia" } });
    expect(skeletons[3]).toMatchObject({ type: "text", text: "nota solta" });
  });

  it("tolera arquivo vazio ou corrompido", () => {
    expect(parseScene("").data.elements).toEqual([]);
    expect(parseScene("{não é json").data.elements).toEqual([]);
  });
});
