// Importado antes de tudo em main.tsx: o Excalidraw lê esta variável quando registra as fontes,
// e imports ES são avaliados antes do corpo do módulo que os importa.
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

// Fontes servidas pelo próprio Biblo (copiadas no build), nunca de CDN.
window.EXCALIDRAW_ASSET_PATH = `${window.location.origin}/excalidraw-assets/`;

export {};
