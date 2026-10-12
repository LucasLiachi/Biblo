import "@excalidraw/excalidraw/index.css";

import {
  Excalidraw,
  MainMenu,
  WelcomeScreen,
  convertToExcalidrawElements,
  getSceneVersion,
  restoreElements,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { AppState, BinaryFiles, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { useEffect, useMemo, useRef } from "react";

import { legacyToSkeletons, parseScene, type LegacyElement } from "../lib/excalidraw";
import type { OpenDocument } from "../types";
import { Breadcrumb } from "./Breadcrumb";

type SceneElements = Parameters<typeof getSceneVersion>[0];

interface DiagramCanvasProps {
  doc: OpenDocument;
  theme: "dark" | "light";
  onChange: (path: string, content: string) => void;
}

const SERIALIZE_DELAY_MS = 250;

/** Diagrama .excalidraw nativo. Arquivos do formato provisório antigo são convertidos ao abrir. */
export default function DiagramCanvas({ doc, theme, onChange }: DiagramCanvasProps) {
  const { initialData, converted } = useMemo(() => {
    const { native, data } = parseScene(doc.content);
    const elements = native
      ? restoreElements(data.elements as SceneElements, null)
      : convertToExcalidrawElements(legacyToSkeletons(data.elements as LegacyElement[]) as ExcalidrawElementSkeleton[], {
          regenerateIds: false,
        });
    // appState do formato antigo não segue o schema do Excalidraw (ex.: zoom: 100): descartado na conversão.
    const savedState = native ? ((data.appState as Partial<AppState>) ?? {}) : {};
    const appState = { ...savedState, collaborators: new Map() } as Partial<AppState>;
    const initial: ExcalidrawInitialDataState = {
      elements,
      appState,
      files: (data.files as BinaryFiles) ?? {},
      scrollToContent: true,
    };
    return { initialData: initial, converted: !native && (data.elements as unknown[]).length > 0 };
    // Só recalcula ao trocar de arquivo ou quando o conteúdo é substituído por fora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.path, doc.revision]);

  const baseline = useRef(getSceneVersion(initialData.elements as SceneElements));
  const fileCount = useRef(Object.keys(initialData.files ?? {}).length);
  const pending = useRef<number | undefined>(undefined);
  const latest = useRef({ path: doc.path, onChange });
  latest.current = { path: doc.path, onChange };

  useEffect(() => {
    baseline.current = getSceneVersion(initialData.elements as SceneElements);
    fileCount.current = Object.keys(initialData.files ?? {}).length;
  }, [initialData]);

  useEffect(() => () => window.clearTimeout(pending.current), []);

  const handleChange = (elements: SceneElements, appState: AppState, files: BinaryFiles) => {
    // onChange dispara a cada quadro (cursor, seleção, zoom). Só grava quando a cena muda.
    const version = getSceneVersion(elements);
    const filesNow = Object.keys(files).length;
    if (version === baseline.current && filesNow === fileCount.current) return;
    window.clearTimeout(pending.current);
    const { path } = latest.current;
    pending.current = window.setTimeout(() => {
      baseline.current = version;
      fileCount.current = filesNow;
      latest.current.onChange(path, serializeAsJSON(elements, appState, files, "local"));
    }, SERIALIZE_DELAY_MS);
  };

  return (
    <>
      <div className="doc-bar">
        <Breadcrumb path={doc.path} />
        <span className="canvas-autosave-badge" aria-live="polite">
          {doc.state === "saved" ? "Gravado no vault" : doc.state === "conflict" ? "Conflito com o disco" : doc.state === "error" ? "Falha ao gravar" : "Gravando…"}
        </span>
      </div>
      {converted && (
        <div className="canvas-notice" role="note">
          Diagrama no formato antigo do Biblo: foi convertido para Excalidraw e será gravado no formato nativo na primeira edição.
        </div>
      )}
      <div className="canvas-host">
        <Excalidraw
          key={`${doc.path}#${doc.revision}`}
          initialData={initialData}
          onChange={handleChange}
          theme={theme}
          langCode="pt-BR"
          name={doc.name}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: { saveFileToDisk: true } } }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
            <MainMenu.DefaultItems.Help />
          </MainMenu>
          <WelcomeScreen>
            <WelcomeScreen.Hints.ToolbarHint>Escolha uma forma e desenhe. Setas ligadas viram fluxo no copiloto.</WelcomeScreen.Hints.ToolbarHint>
            <WelcomeScreen.Hints.HelpHint />
          </WelcomeScreen>
        </Excalidraw>
      </div>
      <div className="doc-status">
        <span>Excalidraw</span>
        <span>Gravado em {doc.path}</span>
        <span>Mermaid → diagrama: menu de ferramentas extras</span>
      </div>
    </>
  );
}
