import { FileText, PenTool } from "lucide-react";

import type { Citation } from "../types";

interface CitationBadgeProps {
  citation: Pick<Citation, "path" | "kind" | "start_line" | "snippet" | "heading">;
  onOpen: (path: string, line?: number) => void;
}

export function CitationBadge({ citation, onOpen }: CitationBadgeProps) {
  const isDiagram = citation.kind === "diagram";
  const label = isDiagram ? citation.path : `${citation.path}:${citation.start_line}`;
  return (
    <button
      type="button"
      className={`citation-badge ${isDiagram ? "citation-badge-canvas" : ""}`}
      title={[citation.heading, citation.snippet].filter(Boolean).join("\n")}
      onClick={() => onOpen(citation.path, isDiagram ? undefined : citation.start_line)}
    >
      {isDiagram ? <PenTool size={12} aria-hidden="true" /> : <FileText size={12} aria-hidden="true" />}
      {label}
    </button>
  );
}
