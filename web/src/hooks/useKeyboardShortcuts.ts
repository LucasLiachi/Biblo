import { useEffect, useRef } from "react";

export interface Shortcuts {
  onCloseTab: () => void;
  onToggleVault: () => void;
  onToggleChat: () => void;
  onFocusMode: () => void;
  onCommandPalette: () => void;
  onSave: () => void;
}

/**
 * Atalhos globais. Evitamos os reservados do navegador, que a página não consegue interceptar:
 * Ctrl+W e Ctrl+Shift+W fecham aba/janela, Ctrl+Shift+J/I abrem o DevTools.
 * Ctrl+B fica com o editor (negrito). e.code mantém os atalhos no Mac, onde Option altera e.key.
 */
export function useKeyboardShortcuts(shortcuts: Shortcuts) {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (e.altKey && !mod && !e.shiftKey && e.code === "KeyW") run(ref.current.onCloseTab);
      else if (mod && e.shiftKey && !e.altKey && e.code === "KeyB") run(ref.current.onToggleVault);
      else if (mod && e.shiftKey && !e.altKey && e.code === "KeyL") run(ref.current.onToggleChat);
      else if (mod && e.shiftKey && !e.altKey && e.code === "KeyF") run(ref.current.onFocusMode);
      else if (mod && !e.shiftKey && !e.altKey && e.code === "KeyK") run(ref.current.onCommandPalette);
      else if (mod && !e.shiftKey && !e.altKey && e.code === "KeyS") run(ref.current.onSave);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
