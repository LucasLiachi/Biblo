import hmac

from fastapi import HTTPException, Request, Security, status
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

SESSION_COOKIE = "biblo_session"
X_BIBLO_TOKEN_HEADER = APIKeyHeader(name="X-Biblo-Token", auto_error=False)

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
MULTIPART_PATHS = {"/api/assets"}

CSP_POLICY = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; "
    "worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
)


def _token_matches(candidate: str | None) -> bool:
    return bool(candidate) and hmac.compare_digest(candidate, settings.SESSION_TOKEN)  # type: ignore[arg-type]


async def verify_session_token(
    request: Request, token_from_header: str | None = Security(X_BIBLO_TOKEN_HEADER)
) -> None:
    if _token_matches(token_from_header) or _token_matches(request.cookies.get(SESSION_COOKIE)):
        return
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão local ausente ou inválida. Recarregue o Biblo.",
    )


def _reject(code: int, detail: str) -> JSONResponse:
    return JSONResponse(status_code=code, content={"detail": detail})


class SecurityMiddleware(BaseHTTPMiddleware):
    """Barreiras de origem para requisições que alteram as bibliotecas.

    Erros são devolvidos como JSONResponse: HTTPException levantada dentro de
    BaseHTTPMiddleware não passa pelos exception handlers e viraria 500.
    """

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        if request.method in UNSAFE_METHODS:
            origin = request.headers.get("origin")
            if origin and origin not in settings.ALLOWED_ORIGINS:
                return _reject(status.HTTP_403_FORBIDDEN, "Origem não autorizada.")
            if request.headers.get("sec-fetch-site") == "cross-site":
                return _reject(status.HTTP_403_FORBIDDEN, "Requisição cross-site bloqueada.")

            content_type = request.headers.get("content-type", "")
            if request.url.path in MULTIPART_PATHS:
                if not content_type.startswith("multipart/form-data"):
                    return _reject(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload requer multipart/form-data.")
            elif request.method != "DELETE" and not content_type.startswith("application/json"):
                return _reject(
                    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    "Escritas requerem Content-Type: application/json.",
                )

        response = await call_next(request)
        response.headers.setdefault("Content-Security-Policy", CSP_POLICY)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response
