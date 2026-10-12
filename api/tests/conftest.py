import os

# Configuração mínima antes de importar app.config (que valida no import).
os.environ.setdefault("DB_PASSWORD", "senha-de-teste-forte")
os.environ.setdefault("SESSION_TOKEN", "token-de-teste")
os.environ.setdefault("EMBEDDING_PROVIDER", "none")
os.environ.setdefault("BIBLO_ENV", "test")
