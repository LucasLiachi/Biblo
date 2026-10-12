# Arquitetura do Biblo

## Serviços (`docker-compose.yml`)

| Serviço | Imagem / build | Porta no host | Redes |
| :--- | :--- | :--- | :--- |
| `biblo_web` | `web/Dockerfile` (nginx sem root) | `127.0.0.1:2010` → 8080 | `biblo_net` |
| `biblo_api` | `api/Dockerfile` (FastAPI, UID do usuário) | `127.0.0.1:2011` → 8000 | `biblo_net`, `ailab_net` |
| `biblo_postgres` | `pgvector/pgvector:pg17` | nenhuma | `biblo_net` |
| `biblo_api_test` | `api/Dockerfile` alvo `test` (perfil `test`) | nenhuma | `biblo_net` |

`docker-compose.debug.yml` publica o Postgres em `127.0.0.1:2012`. O nginx serve a SPA e repassa `/api/` para a API
(SSE sem buffer).

## Vault

- `./vault` é montado em `/vault` na API. Notas `.md`/`.markdown`, diagramas `.excalidraw` e imagens
  (`png`, `jpg`, `jpeg`, `gif`, `svg`, `webp`).
- Itens que começam com `.` não aparecem na árvore nem no índice.
- Excluir move para `vault/.lixeira/<AAAAMMDD-HHMMSS>/<caminho original>`.
- Todo caminho passa por `resolve_safe_path` (`api/app/services/vault_fs.py`): sem `..`, `.`, `%2e`, caminho absoluto,
  letra de drive, byte nulo, symlink ou extensão fora da lista.
- Gravação atômica (arquivo temporário + `os.replace`). O ETag é o SHA-256 do conteúdo.

## API

Rotas sob `/api`. Todas, exceto `/api/health` e `/api/session`, exigem o cookie `biblo_session` ou o header
`X-Biblo-Token`.

| Método | Rota | Resposta |
| :--- | :--- | :--- |
| GET | `/health` | `status`, `db_connected`, `vault_mounted` |
| GET | `/session` | 204 + cookie `HttpOnly`, `SameSite=Strict`, `Path=/api` |
| GET | `/files/tree` | Lista plana `{path, name, type, kind, size}` |
| GET | `/files?path=` | Conteúdo + `ETag` |
| POST | `/files` `{path, content}` | 201 `{path, etag}`; 409 se existe |
| PUT | `/files?path=` `{content}` + `If-Match` | `{path, etag}`; 428 sem `If-Match`; 409 com `current_content`/`current_etag` |
| DELETE | `/files?path=` | 204 (vai para a lixeira) |
| POST | `/files/move` `{source, destination}` | `{path}`; 409 se o destino existe; 400 se troca extensão ou move pasta para dentro de si |
| POST | `/folders` `{path}` | 201; 409 se existe |
| DELETE | `/folders?path=&recursive=` | 204 (vai para a lixeira); 409 se não vazia e `recursive=false` |
| POST | `/assets?folder=assets` (multipart `file`) | 201 `{path, size}`; nome sanitizado e único; 413 acima de `MAX_UPLOAD_MB` |
| GET | `/assets?path=` | Imagem com `nosniff` e CSP `sandbox`; SVG como anexo |
| GET | `/search?q=&limit=` | `{mode: "hybrid"\|"text", results: [citação]}` |
| GET | `/links?path=` | `{backlinks: [{path, title, kind}], outgoing: [{target, path\|null}]}` |
| GET | `/links/resolve?target=` | `{target, path\|null}` |
| GET | `/models` | `{models}` do gateway; 503 se indisponível |
| POST | `/chat/stream` `{model, messages}` | SSE: `citations`, `token`*, `error`?, `done`; 429 acima de 10/min |
| GET | `/index/status` | Estado do indexador |
| POST | `/index/rebuild` | 202; reindexação completa |

Citação: `{chunk_id, path, title, kind, heading, start_line, end_line, snippet, score}`.

Barreiras (`api/app/middlewares/security.py`, `main.py`):

- `TrustedHostMiddleware` (`localhost`, `127.0.0.1`, `biblo_api`).
- CORS só para `http://localhost:2010` e `http://127.0.0.1:2010`.
- Escritas exigem `application/json` (multipart em `/assets`).
- `Origin` fora da lista ou `Sec-Fetch-Site: cross-site` → 403.
- CSP, `nosniff`, `X-Frame-Options: DENY` e `Referrer-Policy: no-referrer` em toda resposta.

## Índice (`api/app/schema.sql`, `db.py`)

| Tabela | Conteúdo |
| :--- | :--- |
| `documents` | `path`, `link_key` (caminho sem extensão, minúsculo), `kind`, `title`, `content_hash` |
| `chunks` | `ordinal`, `start_line`, `end_line`, `heading`, `text`, `embedding vector(768)` (nulo sem provedor), `embedding_model`, `tsv` (`portuguese_unaccent`, título com peso A) |
| `links` | `source_id`, `target_key` (alvo normalizado do `[[wikilink]]`) |
| `index_meta` | `schema_version`, provedor, modelo e dimensão de embeddings |

O índice é derivado do disco. Na subida, se `schema_version` difere de `SCHEMA_VERSION`, as tabelas são recriadas e o
vault é reindexado.

## Indexador (`api/app/services/indexer.py`)

- **Na subida**: compara o disco com `documents.content_hash`, indexa novos e alterados e remove órfãos.
- **Em execução**: watchdog (inotify, ou polling quando o vault está em `9p`/`drvfs`/`virtiofs`/`fuse.grpcfuse` ou em
  `/mnt/*` no WSL2). Só eventos de escrita entram na fila, com debounce de 0,8 s. A API também avisa o indexador a cada
  gravação.
- **Parser** (`parser.py`):
  - Markdown: um chunk por seção, quebrado em ~1.500 caracteres. O frontmatter fica fora, e o `title:` do frontmatter
    ou o primeiro H1 vira o título.
  - Excalidraw: `diagram_to_text` gera seções, fluxos (`A --[rótulo]--> B`), elementos e anotações, ignorando `files`
    (base64) e elementos excluídos.
  - Wikilinks dentro de código são ignorados.
- **Embeddings** (`embeddings.py`): `EMBEDDING_PROVIDER=ollama` (`/api/embed`), `openai` (`/embeddings`) ou `none`.
  - Falha ou indisponibilidade: o chunk fica sem vetor e um laço de 60 s completa os vetores quando o provedor responde.
  - Trocar o modelo anula os vetores antigos.
- **Limites**: documentos acima de `MAX_DOCUMENT_MB` não são indexados nem gravados; no máximo `MAX_CHUNKS_PER_DOC`
  por documento.

## Busca e copiloto (`api/app/services/rag.py`, `routers/chat.py`)

- **Texto**: `plainto_tsquery` com OR entre os termos, ordenado por `ts_rank_cd`.
- **Vetor**: cosseno (HNSW) só entre chunks do modelo atual.
- **Fusão**: Reciprocal Rank Fusion (k = 60). Sem embeddings, o modo é `text`.
- **Chat**: system prompt fixo; os trechos vão numa mensagem de usuário separada, em
  `<retrieved_documents><document path heading lines>`, com atributos e texto escapados e limitados a
  `RAG_MAX_CONTEXT_TOKENS × 4` caracteres. O histórico segue depois.
- O stream usa o cliente `openai` em `LLM_BASE_URL` com `metadata: {tags: ["biblo", "rag"], trace_user_id}` e é
  encerrado quando o cliente desconecta.

## Frontend (`web/src`)

| Arquivo | Papel |
| :--- | :--- |
| `App.tsx` | Estado dos documentos abertos, autosave por caminho (1,5 s), conflito, gestão de pastas, polling de 4 s (árvore, índice, documento ativo) |
| `api/client.ts` | Sessão por cookie, chamadas e leitura do SSE |
| `components/MarkdownEditor.tsx`, `MarkdownPreview.tsx` | CodeMirror 6 e preview |
| `components/DiagramCanvas.tsx` | Excalidraw (carregado sob demanda) |
| `components/VaultTree.tsx`, `DocumentTabs.tsx`, `Breadcrumb.tsx` | Navegação |
| `components/ChatPanel.tsx`, `CitationBadge.tsx`, `CommandPalette.tsx` | Copiloto e busca |
| `components/AppHeader.tsx`, `SyncIndicator.tsx`, `BrandMark.tsx`, `Dialog.tsx`, `ConflictModal.tsx` | Moldura do app |
| `lib/markdown.ts` | markdown-it (sem HTML bruto) + DOMPurify, wikilinks, checklists, Mermaid, imagens só do vault |
| `lib/excalidraw.ts` | Leitura de cenas e conversão de arquivos fora do formato nativo |
| `excalidraw-assets.ts` | `EXCALIDRAW_ASSET_PATH` local (fontes copiadas por `scripts/copy-excalidraw-assets.mjs`) |

## Configuração (`.env`)

| Variável | Padrão |
| :--- | :--- |
| `DB_PASSWORD` | obrigatória; placeholders públicos são recusados |
| `LLM_BASE_URL` / `LLM_API_KEY` | `http://ailab_litellm:4000/v1` / vazio |
| `EMBEDDING_PROVIDER` / `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` / `EMBEDDING_DIM` | `ollama` / `http://host.docker.internal:11434` / `nomic-embed-text` / `768` |
| `MAX_UPLOAD_MB` / `MAX_DOCUMENT_MB` / `MAX_CHUNKS_PER_DOC` | 15 / 5 / 100 |
| `RAG_MAX_CONTEXT_TOKENS` / `WATCHER_MODE` | 4000 / `auto` |
| `BIBLO_ENV` | `dev` (habilita `/api/docs`) |
| `BIBLO_UID` / `BIBLO_GID` | 1000 / 1000 |
