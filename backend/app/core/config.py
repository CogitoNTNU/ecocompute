"""Server-only configuration. Public configuration is constructed explicitly."""

import json
import os
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKENDS = ("autoscale", "always-on")
COST_CATEGORIES = (*BACKENDS, "foundry", "shared")
MODEL_ID = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")


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
    input_usd_per_million: Decimal | None = None
    output_usd_per_million: Decimal | None = None

    @property
    def enabled(self) -> bool:
        return bool(self.deployment and self.base_url and self.api_key)


def model_price(value: object) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError("Model prices must be nonnegative USD amounts per million tokens.")
    try:
        price = Decimal(str(value))
    except InvalidOperation as error:
        raise ValueError("Model prices must be nonnegative USD amounts per million tokens.") from error
    if not price.is_finite() or not 0 <= price <= 1_000_000:
        raise ValueError("Model prices must be nonnegative USD amounts per million tokens.")
    return price


def configured_models(raw: str, endpoint: str, key: str) -> tuple[ModelDeployment, ...]:
    try:
        entries = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError("AZURE_OPENAI_MODELS_JSON must be a JSON array.") from error
    if not isinstance(entries, list) or len(entries) > 100:
        raise ValueError("AZURE_OPENAI_MODELS_JSON must be a JSON array of at most 100 models.")
    models = []
    seen: set[str] = set()
    allowed = {"id", "label", "deployment", "input_usd_per_million", "output_usd_per_million"}
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) - allowed:
            raise ValueError("Each model must contain only supported configuration fields.")
        model_id, label, deployment = (entry.get(name) for name in ("id", "label", "deployment"))
        if not isinstance(model_id, str) or not MODEL_ID.fullmatch(model_id) or model_id in seen:
            raise ValueError("Model IDs must be unique lowercase identifiers of at most 64 characters.")
        if not isinstance(label, str) or not 1 <= len(label.strip()) <= 80:
            raise ValueError("Model labels must contain 1 to 80 characters.")
        if not isinstance(deployment, str) or not 1 <= len(deployment.strip()) <= 128:
            raise ValueError("Each model needs a Foundry deployment name.")
        input_price = model_price(entry.get("input_usd_per_million"))
        output_price = model_price(entry.get("output_usd_per_million"))
        if (input_price is None) != (output_price is None):
            raise ValueError("Configure both input and output prices, or neither.")
        seen.add(model_id)
        models.append(
            ModelDeployment(
                model_id,
                label.strip(),
                deployment.strip(),
                endpoint,
                key,
                input_price,
                output_price,
            )
        )
    return tuple(models)


@dataclass(frozen=True)
class Settings:
    backend_mode: str
    backend_urls: dict[str, str]
    allowed_origins: tuple[str, ...]
    models: tuple[ModelDeployment, ...]
    cost_subscription_id: str = ""
    cost_resources: dict[str, list[str]] = field(default_factory=dict)
    frontend_dist: Path = PROJECT_ROOT / "frontend" / "dist"
    entra_tenant_id: str = ""
    entra_client_id: str = ""
    entra_allowed_group_id: str = ""

    @property
    def auth_enabled(self) -> bool:
        return bool(self.entra_tenant_id)

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
        models = configured_models(os.getenv("AZURE_OPENAI_MODELS_JSON", "[]"), endpoint, key)
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
        tenant_id = os.getenv("ENTRA_TENANT_ID", "").strip()
        client_id = os.getenv("ENTRA_CLIENT_ID", "").strip()
        group_id = os.getenv("ENTRA_ALLOWED_GROUP_ID", "").strip()
        if any((tenant_id, client_id, group_id)):
            if not tenant_id or not client_id:
                raise ValueError("ENTRA_TENANT_ID and ENTRA_CLIENT_ID must both be set.")
            tenant_id = str(UUID(tenant_id))
            client_id = str(UUID(client_id))
            if group_id:
                group_id = str(UUID(group_id))
        return cls(
            mode,
            urls,
            origins,
            models,
            subscription,
            resources,
            entra_tenant_id=tenant_id,
            entra_client_id=client_id,
            entra_allowed_group_id=group_id,
        )
