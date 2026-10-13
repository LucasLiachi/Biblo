import { Command, Moon, PanelLeft, PanelRight, RefreshCw, Sun } from "lucide-react";

import type { IndexStatus, SaveState } from "../types";
import { BrandMark } from "./BrandMark";
import { SyncIndicator } from "./SyncIndicator";

interface AppHeaderProps {
  index: IndexStatus | null;
  saveState: SaveState | null;
  isLibraryPanelOpen: boolean;
  isChatOpen: boolean;
  theme: "dark" | "light";
  onToggleLibraries: () => void;
  onToggleChat: () => void;
  onToggleTheme: () => void;
  onOpenCommandPalette: () => void;
  onRebuildIndex: () => void;
}

export function AppHeader(props: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-actions">
        <span className="app-brand">
          <BrandMark />
          Biblo
        </span>
      </div>

      <div className="header-center">
        <button type="button" className="btn btn-secondary" onClick={props.onOpenCommandPalette}>
          <Command size={14} aria-hidden="true" />
          Buscar nas bibliotecas
          <span className="kbd">Ctrl K</span>
        </button>
      </div>

      <div className="header-actions">
        <SyncIndicator index={props.index} saveState={props.saveState} />
        <button type="button" className="btn btn-ghost btn-icon" onClick={props.onRebuildIndex} title="Reconstruir índice a partir do disco" aria-label="Reconstruir índice">
          <RefreshCw size={16} />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-icon ${props.isLibraryPanelOpen ? "active" : ""}`}
          onClick={props.onToggleLibraries}
          aria-pressed={props.isLibraryPanelOpen}
          title="Painel de bibliotecas (Ctrl+Shift+B)"
          aria-label="Alternar painel de bibliotecas"
        >
          <PanelLeft size={16} />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-icon ${props.isChatOpen ? "active" : ""}`}
          onClick={props.onToggleChat}
          aria-pressed={props.isChatOpen}
          title="Pergunte para o Biblo (Ctrl+Shift+L)"
          aria-label="Alternar Pergunte para o Biblo"
        >
          <PanelRight size={16} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={props.onToggleTheme}
          title={props.theme === "dark" ? "Tema claro" : "Tema escuro"}
          aria-label="Alternar tema"
        >
          {props.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
