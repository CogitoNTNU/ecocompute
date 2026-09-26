"""Composition root: construct adapters, inject services, serve the React build."""

from contextlib import AsyncExitStack, asynccontextmanager

import httpx
from azure.identity.aio import DefaultAzureCredential
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI

from app.api.routes import router
from app.core.config import Settings
from app.core.errors import ServiceError
from app.core.logging import configure_logging
from app.core.middleware import BodyLimitMiddleware
from app.services.chat import FoundryChatService
from app.services.costs import AzureCostService, UnconfiguredCostService


def create_app(settings: Settings | None = None) -> FastAPI:
    configure_logging()
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        async with AsyncExitStack() as stack:
            clients = {}
            for model in settings.models:
                if model.enabled:
                    clients[model.id] = await stack.enter_async_context(
                        AsyncOpenAI(
                            base_url=model.base_url,
                            api_key=model.api_key,
                            timeout=60.0,
                            max_retries=0,
                        )
                    )
            app.state.chat_service = FoundryChatService(settings, clients)
            app.state.cost_service = UnconfiguredCostService()
            if settings.cost_subscription_id and any(settings.cost_resources.values()):
                credential = await stack.enter_async_context(DefaultAzureCredential())
                client = await stack.enter_async_context(
                    httpx.AsyncClient(timeout=30.0, follow_redirects=False)
                )
                app.state.cost_service = AzureCostService(settings, credential, client)
            yield

    app = FastAPI(title="EcoCompute", lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(BodyLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        max_age=86400,
    )

    @app.exception_handler(ServiceError)
    async def service_error(_request: Request, error: ServiceError):
        return JSONResponse({"detail": error.message}, status_code=error.status_code)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_request: Request, _error: RequestValidationError):
        return JSONResponse(
            {"detail": "Invalid request. Check the model, backend and conversation limits."}, status_code=422
        )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        if request.url.path in {"/", "/costs"}:
            connections = " ".join(settings.backend_urls.values())
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                f"connect-src 'self' {connections}; img-src 'self' data:; "
                "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
            )
            response.headers["Cache-Control"] = "no-cache"
        return response

    app.include_router(router)

    @app.get("/health")
    async def health():
        return {"status": "ok", "backend": settings.backend_mode}

    if (settings.frontend_dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=settings.frontend_dist / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    @app.get("/costs", include_in_schema=False)
    async def frontend():
        index = settings.frontend_dist / "index.html"
        if not index.is_file():
            return JSONResponse(
                {
                    "detail": "Frontend is not built. Run npm ci and npm run build in frontend/, or use the Vite development server."
                },
                status_code=503,
            )
        return FileResponse(index)

    return app


app = create_app()
