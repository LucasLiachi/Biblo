import { Command, Moon, PanelLeft, PanelRight, RefreshCw, Sun } from "lucide-react";

import type { IndexStatus, SaveState } from "../types";
import { BrandMark } from "./BrandMark";
import { SyncIndicator } from "./SyncIndicator";

interface AppHeaderProps {
  index: IndexStatus | null;
  saveState: SaveState | null;
  isVaultOpen: boolean;
  isChatOpen: boolean;
  theme: "dark" | "light";
  onToggleVault: () => void;
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
        <span className="vault-indicator" title="Pasta do vault no disco">./vault</span>
      </div>

      <div className="header-center">
        <button type="button" className="btn btn-secondary" onClick={props.onOpenCommandPalette}>
          <Command size={14} aria-hidden="true" />
          Buscar no vault
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
          className={`btn btn-ghost btn-icon ${props.isVaultOpen ? "active" : ""}`}
          onClick={props.onToggleVault}
          aria-pressed={props.isVaultOpen}
          title="Painel do vault (Ctrl+Shift+B)"
          aria-label="Alternar painel do vault"
        >
          <PanelLeft size={16} />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-icon ${props.isChatOpen ? "active" : ""}`}
          onClick={props.onToggleChat}
          aria-pressed={props.isChatOpen}
          title="Copiloto (Ctrl+Shift+L)"
          aria-label="Alternar copiloto"
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
