from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request

from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.costs import CostReport
from app.services.chat import ChatService
from app.services.costs import CostService

router = APIRouter(prefix="/api")


def chat_service(request: Request) -> ChatService:
    return request.app.state.chat_service


def cost_service(request: Request) -> CostService:
    return request.app.state.cost_service


@router.get("/config")
async def public_config(request: Request) -> dict:
    settings = request.app.state.settings
    return {
        "backend_mode": settings.backend_mode,
        "backends": [
            {
                "id": mode,
                "label": label,
                "url": settings.backend_urls.get(mode, ""),
                "enabled": mode in settings.backend_urls or mode == settings.backend_mode,
                "min_replicas": minimum,
                "max_replicas": maximum,
            }
            for mode, label, minimum, maximum in [
                ("autoscale", "Autoscale", 0, 3),
                ("always-on", "Always-on", 1, 1),
            ]
        ],
        "models": [
            {"id": model.id, "label": model.label, "enabled": model.enabled} for model in settings.models
        ],
        "billing_configured": bool(settings.cost_subscription_id and any(settings.cost_resources.values())),
    }


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, service: Annotated[ChatService, Depends(chat_service)]) -> ChatResponse:
    return await service.reply(body)


@router.get("/costs", response_model=CostReport)
async def costs(
    service: Annotated[CostService, Depends(cost_service)], days: Literal["7", "30", "90"] = "30"
) -> CostReport:
    return await service.report(int(days))
