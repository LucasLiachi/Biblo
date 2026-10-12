import type { Conflict } from "../types";
import { DialogFrame } from "./Dialog";

interface ConflictModalProps {
  conflict: Conflict;
  onKeepMine: () => void;
  onUseDisk: () => void;
  onSaveCopy: () => void;
  onClose: () => void;
}

/** 409 do If-Match: o arquivo mudou fora do Biblo. Nada é sobrescrito sem escolha explícita. */
export function ConflictModal({ conflict, onKeepMine, onUseDisk, onSaveCopy, onClose }: ConflictModalProps) {
  return (
    <DialogFrame title="Conflito de versões" onClose={onClose} wide>
      <p>
        <code>{conflict.path}</code> foi alterado fora do Biblo (VS Code, Git ou outro processo) enquanto você editava. O autosave
        está pausado até você escolher.
      </p>
      <div className="conflict-grid">
        <div>
          <h3>Sua versão (no editor)</h3>
          <pre>{conflict.mine}</pre>
        </div>
        <div>
          <h3>Versão atual do disco</h3>
          <pre>{conflict.theirs}</pre>
        </div>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onSaveCopy}>Salvar a minha como cópia</button>
        <button type="button" className="btn btn-secondary" onClick={onUseDisk}>Usar a do disco</button>
        <button type="button" className="btn btn-primary" onClick={onKeepMine}>Manter a minha</button>
      </div>
    </DialogFrame>
  );
}
