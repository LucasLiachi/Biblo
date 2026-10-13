import { describe, expect, it } from "vitest";

import { buildTree, insideLibrary, kindOf, libraryOf, remapPath, validateName, withExtension } from "./paths";

describe("buildTree", () => {
  it("aninha bibliotecas, pastas e arquivos, com pastas antes de arquivos", () => {
    const tree = buildTree([
      { path: "acervo/b.md", name: "b.md", type: "file", kind: "markdown" },
      { path: "pesquisa", name: "pesquisa", type: "library" },
      { path: "acervo", name: "acervo", type: "library" },
      { path: "acervo/a.md", name: "a.md", type: "file", kind: "markdown" },
      { path: "acervo/sub", name: "sub", type: "directory" },
    ]);
    expect(tree.map((n) => n.name)).toEqual(["acervo", "pesquisa"]);
    expect(tree[0].children.map((n) => n.name)).toEqual(["sub", "a.md", "b.md"]);
  });

  it("identifica a biblioteca e o caminho dentro dela", () => {
    expect(libraryOf("acervo/notas/x.md")).toBe("acervo");
    expect(insideLibrary("acervo/notas/x.md")).toBe("notas/x.md");
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
