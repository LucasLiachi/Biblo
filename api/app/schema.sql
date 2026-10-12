-- Schema do índice do Biblo (versão 3). Aplicado pela API em app/db.py.
-- Tudo aqui é derivado de ./vault e pode ser apagado: o indexador reconstrói.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'portuguese_unaccent') THEN
        CREATE TEXT SEARCH CONFIGURATION portuguese_unaccent (COPY = portuguese);
        ALTER TEXT SEARCH CONFIGURATION portuguese_unaccent
            ALTER MAPPING FOR word, asciiword, hword, asciihword, hword_part, hword_asciipart
            WITH unaccent, portuguese_stem;
    END IF;
END $$;

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path TEXT UNIQUE NOT NULL,
    link_key TEXT NOT NULL,          -- caminho sem extensão, minúsculo (resolução de [[wikilinks]])
    kind TEXT NOT NULL CHECK (kind IN ('markdown', 'diagram')),
    title TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_link_key ON documents (link_key);

-- embedding fica NULL quando o provedor de embeddings está indisponível:
-- a busca textual continua funcionando e o indexador completa os vetores depois.
CREATE TABLE chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ordinal INT NOT NULL,
    start_line INT NOT NULL,
    end_line INT NOT NULL,
    heading TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL,
    embedding_model TEXT,
    embedding vector(768),
    tsv tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('portuguese_unaccent', coalesce(heading, '')), 'A') ||
        setweight(to_tsvector('portuguese_unaccent', text), 'B')
    ) STORED,
    UNIQUE (document_id, ordinal)
);
CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_chunks_tsv ON chunks USING gin (tsv);
CREATE INDEX idx_chunks_missing_embedding ON chunks (document_id) WHERE embedding IS NULL;

CREATE TABLE links (
    source_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target_key TEXT NOT NULL,        -- alvo normalizado do [[wikilink]]
    PRIMARY KEY (source_id, target_key)
);
CREATE INDEX idx_links_target_key ON links (target_key);

CREATE TABLE index_meta (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    schema_version INT NOT NULL,
    embedding_provider TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_dim INT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO index_meta (id, schema_version, embedding_provider, embedding_model, embedding_dim)
VALUES (1, 3, 'none', 'none', 768);
