import { FileText, PenTool, X } from "lucide-react";

import type { OpenDocument } from "../types";

interface DocumentTabsProps {
  documents: OpenDocument[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function DocumentTabs({ documents, activePath, onSelect, onClose }: DocumentTabsProps) {
  if (documents.length === 0) return null;
  return (
    <div className="document-tabs">
      <div className="tabs-group" role="tablist" aria-label="Documentos abertos">
        {documents.map((doc) => {
          const active = doc.path === activePath;
          const pending = doc.state === "dirty" || doc.state === "saving";
          return (
            <div
              key={doc.path}
              role="tab"
              tabIndex={active ? 0 : -1}
              aria-selected={active}
              className={`doc-tab ${active ? "active" : ""}`}
              title={doc.path}
              onClick={() => onSelect(doc.path)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(doc.path)}
              onAuxClick={(e) => e.button === 1 && onClose(doc.path)}
            >
              {doc.kind === "diagram" ? (
                <PenTool size={13} className="tree-icon tree-icon-canvas" aria-hidden="true" />
              ) : (
                <FileText size={13} className="tree-icon tree-icon-md" aria-hidden="true" />
              )}
              <span className="doc-tab-name">{doc.name}</span>
              {pending && <span className="doc-dirty-dot" title="Alterações ainda não gravadas" />}
              <button
                type="button"
                className="doc-close-btn"
                aria-label={`Fechar ${doc.name} (Alt+W)`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(doc.path);
                }}
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
