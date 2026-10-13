# Regras do backend (`api/`)

## Stack
Python 3.11, FastAPI, pydantic-settings, asyncpg (sem ORM), watchdog 6 e cliente `openai`. As versões estão fixadas
em `api/requirements.txt` e `api/requirements-dev.txt`.

## Convenções
- Configuração só em `app/config.py`. `settings` é importado, nunca lido do ambiente direto.
- Rotas em `app/routers/`, todas sob `/api` e protegidas por `Depends(verify_session_token)`.
- Caminhos de arquivo chegam por query (`?path=`), começam pela biblioteca e passam por `require_inside_library` e
  `resolve_safe_path` (`app/services/library_fs.py`). Nunca use `settings.LIBRARIES_ROOT / entrada`.
- Na raiz só existem bibliotecas: criadas por `POST /api/libraries`, nunca movidas ou excluídas por rota.
- Gravação: `atomic_write_file`/`atomic_write_bytes`. Exclusão: `move_to_trash` (vai para `<biblioteca>/.lixeira`). Nunca `unlink`/`rmtree`.
- Escrita condicional por `If-Match` com o SHA-256 do arquivo.
- Depois de gravar ou mover, avise o indexador (`get_indexer().notify(caminho absoluto)`).
- Corpos de requisição são modelos Pydantic. Erros saem como `HTTPException` com `detail` em português.
- Dentro de `BaseHTTPMiddleware`, devolva `JSONResponse`; não levante `HTTPException`, que vira 500.
- Schema em `app/schema.sql`. Ao mudar o schema ou o que o parser extrai, suba `SCHEMA_VERSION` em `app/db.py`.
- Chat e embeddings só por endpoints OpenAI-compatíveis ou Ollama, via `llm_client.py` e `embeddings.py`. Nenhum SDK
  de provedor.
- Falha de LLM ou embeddings é reportada (`LLMUnavailable`, `EmbeddingsUnavailable`), nunca simulada.

## Testes
- `tests/` com pytest + pytest-asyncio (`asyncio_mode=auto`); API testada com `httpx.ASGITransport`.
- Nenhum teste chama um provedor real: `llm_gateway` e `hybrid_search` são substituídos por `monkeypatch`.
- `tests/test_indexer_integration.py` usa Postgres real num database `biblo_test` (só com `BIBLO_TEST_DB=1`).
- Lint: ruff (`E,F,I,B,UP`, linha 130), configurado em `api/pyproject.toml`.

## Comando
```bash
docker compose --profile test run --rm biblo_api_test   # ruff + pytest com Postgres
```
