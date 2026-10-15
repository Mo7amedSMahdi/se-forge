"""RFC 9457 problem details for every error (team API style)."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM = "application/problem+json"


class ProblemError(Exception):
    def __init__(self, status: int, title: str, detail: str | None = None, type_: str = "about:blank") -> None:
        self.status, self.title, self.detail, self.type = status, title, detail, type_


def problem(
    status: int, title: str, request: Request, detail: str | None = None, type_: str = "about:blank", **extra: Any
) -> JSONResponse:
    body: dict[str, Any] = {"type": type_, "title": title, "status": status, "instance": request.url.path}
    if detail:
        body["detail"] = detail
    body.update(extra)
    return JSONResponse(body, status_code=status, media_type=PROBLEM)


def install(app: FastAPI) -> None:
    @app.exception_handler(ProblemError)
    async def _problem(request: Request, exc: ProblemError) -> JSONResponse:
        return problem(exc.status, exc.title, request, exc.detail, exc.type)

    # Validation is 400 with errors: [{field, message}] (FastAPI's default is 422 with its own shape).
    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": ".".join(str(p) for p in e["loc"][1:]) or str(e["loc"][0]), "message": e["msg"]}
            for e in exc.errors()
        ]
        return problem(400, "Invalid input", request, errors=errors)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return problem(exc.status_code, str(exc.detail), request)
