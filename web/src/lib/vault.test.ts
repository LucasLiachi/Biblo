import { describe, expect, it } from "vitest";

import { buildTree, kindOf, remapPath, validateName, withExtension } from "./vault";

describe("buildTree", () => {
  it("aninha e ordena pastas antes de arquivos", () => {
    const tree = buildTree([
      { path: "notas/b.md", name: "b.md", type: "file", kind: "markdown" },
      { path: "z.md", name: "z.md", type: "file", kind: "markdown" },
      { path: "notas", name: "notas", type: "directory" },
      { path: "notas/a.md", name: "a.md", type: "file", kind: "markdown" },
      { path: "notas/sub", name: "sub", type: "directory" },
    ]);
    expect(tree.map((n) => n.name)).toEqual(["notas", "z.md"]);
    expect(tree[0].children.map((n) => n.name)).toEqual(["sub", "a.md", "b.md"]);
  });
});

describe("remapPath", () => {
  it("acompanha arquivos e pastas movidos", () => {
    expect(remapPath("notas/a.md", "notas/a.md", "arquivo/a.md")).toBe("arquivo/a.md");
    expect(remapPath("notas/sub/x.md", "notas", "docs")).toBe("docs/sub/x.md");
    expect(remapPath("notas-velhas/x.md", "notas", "docs")).toBe("notas-velhas/x.md");
  });
});

describe("nomes", () => {
  it("valida nomes de arquivo e pasta", () => {
    expect(validateName("ok nota")).toBeNull();
    expect(validateName("a/b")).not.toBeNull();
    expect(validateName(".oculto")).not.toBeNull();
    expect(validateName("  ")).not.toBeNull();
  });

  it("aplica a extensão do tipo de documento", () => {
    expect(withExtension("ideia", "markdown")).toBe("ideia.md");
    expect(withExtension("fluxo.excalidraw", "diagram")).toBe("fluxo.excalidraw");
    expect(withExtension("fluxo.md", "diagram")).toBe("fluxo.excalidraw");
    expect(kindOf("a/b.EXCALIDRAW")).toBe("diagram");
    expect(kindOf("a/b.png")).toBeNull();
  });
});
