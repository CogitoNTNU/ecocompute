"""Server-only configuration. Public configuration is constructed explicitly."""

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKENDS = ("autoscale", "always-on")
COST_CATEGORIES = (*BACKENDS, "foundry", "shared")


def validate_origin(value: str) -> str:
    url = urlsplit(value)
    local = url.hostname in {"localhost", "127.0.0.1", "::1"}
    if (url.scheme != "https" and not (local and url.scheme == "http")) or not url.hostname:
        raise ValueError("Endpoints must use HTTPS (HTTP is allowed for localhost).")
    if url.username or url.password or url.query or url.fragment or url.path not in {"", "/"}:
        raise ValueError("Endpoints must be origins without credentials, paths or query strings.")
    return value.rstrip("/")


@dataclass(frozen=True)
class ModelDeployment:
    id: str
    label: str
    deployment: str
    base_url: str
    api_key: str = field(repr=False)

    @property
    def enabled(self) -> bool:
        return bool(self.deployment and self.base_url and self.api_key)


@dataclass(frozen=True)
class Settings:
    backend_mode: str
    backend_urls: dict[str, str]
    allowed_origins: tuple[str, ...]
    models: tuple[ModelDeployment, ...]
    cost_subscription_id: str = ""
    cost_resources: dict[str, list[str]] = field(default_factory=dict)
    frontend_dist: Path = PROJECT_ROOT / "frontend" / "dist"

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv(PROJECT_ROOT / ".env")
        mode = os.getenv("BACKEND_MODE", "always-on")
        if mode not in BACKENDS:
            raise ValueError("BACKEND_MODE must be autoscale or always-on.")
        urls = json.loads(os.getenv("BACKEND_URLS_JSON", "{}"))
        if not isinstance(urls, dict) or set(urls) - set(BACKENDS):
            raise ValueError("BACKEND_URLS_JSON must map known backends to origins.")
        urls = {key: validate_origin(value) for key, value in urls.items()}
        origins = tuple(
            dict.fromkeys(
                [
                    *urls.values(),
                    *(
                        validate_origin(x.strip())
                        for x in os.getenv(
                            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
                        ).split(",")
                        if x.strip()
                    ),
                ]
            )
        )
        endpoint = os.getenv("AZURE_OPENAI_BASE_URL", "").strip()
        key = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
        models = (
            ModelDeployment(
                "gpt-4.1-nano",
                "GPT-4.1 Nano",
                os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1-nano").strip(),
                endpoint,
                key,
            ),
            ModelDeployment(
                "gpt-6-luna",
                "GPT-6 Luna",
                os.getenv("AZURE_OPENAI_LUNA_DEPLOYMENT", "").strip(),
                os.getenv("AZURE_OPENAI_LUNA_BASE_URL", "").strip() or endpoint,
                os.getenv("AZURE_OPENAI_LUNA_API_KEY", "").strip() or key,
            ),
        )
        for model in models:
            if model.base_url:
                parsed = urlsplit(model.base_url)
                if (
                    parsed.scheme != "https"
                    or not parsed.hostname
                    or parsed.username
                    or parsed.password
                    or parsed.query
                    or parsed.fragment
                ):
                    raise ValueError("Foundry endpoints must be HTTPS URLs without embedded credentials.")
        subscription = os.getenv("AZURE_COST_SUBSCRIPTION_ID", "").strip()
        if subscription:
            subscription = str(UUID(subscription))
        resources = json.loads(os.getenv("AZURE_COST_RESOURCES_JSON", "{}"))
        if not isinstance(resources, dict) or set(resources) - set(COST_CATEGORIES):
            raise ValueError("Unknown billing resource category.")
        seen: set[str] = set()
        for ids in resources.values():
            if not isinstance(ids, list):
                raise ValueError("Billing categories must contain lists of resource IDs.")
            for resource_id in ids:
                if (
                    not isinstance(resource_id, str)
                    or not subscription
                    or not resource_id.lower().startswith(f"/subscriptions/{subscription}/resourcegroups/")
                ):
                    raise ValueError("Billing resources must belong to the configured subscription.")
                if resource_id.lower() in seen:
                    raise ValueError("A billing resource can belong to only one category.")
                seen.add(resource_id.lower())
        return cls(mode, urls, origins, models, subscription, resources)
