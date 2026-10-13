FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/

# Arquivos das bibliotecas pertencem ao usuário do host: o processo roda com o UID/GID dele
# (definidos no compose), nunca como root.
USER 1000:1000
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]

# Imagem de verificação: docker compose run --rm biblo_api_test
FROM base AS test
ENV RUFF_CACHE_DIR=/tmp/.ruff_cache MYPY_CACHE_DIR=/tmp/.mypy_cache
USER root
COPY requirements-dev.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY tests/ ./tests/
USER 1000:1000
CMD ["sh", "-c", "ruff check app tests && pytest -q"]
