import { describe, expect, it } from "vitest";

import { describeSync } from "./SyncIndicator";

describe("describeSync", () => {
  const ok = { status: "idle", db_connected: true, total_documents: 3, chunks_without_embedding: 0 } as const;

  it("só diz sincronizado quando disco e índice estão em dia", () => {
    expect(describeSync(ok, "saved").text).toBe("Sincronizado · 3 docs");
  });

  it("prioriza conflito e gravação pendente sobre o índice", () => {
    expect(describeSync(ok, "conflict").tone).toBe("error");
    expect(describeSync(ok, "dirty").text).toContain("Salvando");
  });

  it("deixa claro quando o índice está offline ou sem embeddings", () => {
    expect(describeSync({ status: "offline", db_connected: false }, null).text).toBe("Índice offline");
    expect(describeSync({ ...ok, chunks_without_embedding: 5 }, "saved").text).toContain("só texto");
  });
});
