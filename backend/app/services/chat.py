import logging
from time import perf_counter
from typing import Protocol
from uuid import uuid4

from openai import APIError, APITimeoutError, AsyncOpenAI, RateLimitError

from app.core.config import Settings
from app.core.errors import ServiceError
from app.schemas.chat import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)


class ChatService(Protocol):
    async def reply(self, request: ChatRequest) -> ChatResponse: ...


class FoundryChatService:
    def __init__(self, settings: Settings, clients: dict[str, AsyncOpenAI]):
        self.settings = settings
        self.clients = clients

    async def reply(self, request: ChatRequest) -> ChatResponse:
        if request.backend != self.settings.backend_mode:
            raise ServiceError(
                409, "This URL serves a different backend. Check the backend URL configuration."
            )
        deployment = next(model for model in self.settings.models if model.id == request.model)
        if not deployment.enabled or request.model not in self.clients:
            raise ServiceError(503, "This model has not been configured in Microsoft Foundry.")
        request_id = str(uuid4())
        started = perf_counter()
        try:
            response = await self.clients[request.model].responses.create(
                model=deployment.deployment,
                input=[message.model_dump() for message in request.messages],
                max_output_tokens=2048,
                store=False,
            )
        except APITimeoutError:
            raise ServiceError(504, "Foundry timed out. The request may still have incurred usage.") from None
        except RateLimitError:
            raise ServiceError(429, "Foundry is rate limited. Wait before sending another message.") from None
        except APIError:
            logger.warning("Foundry request failed: request_id=%s model=%s", request_id, request.model)
            raise ServiceError(
                502, "Foundry could not complete the request. Check the model deployment or try again later."
            ) from None
        if not response.output_text:
            raise ServiceError(502, "Foundry returned no text. The request may still have incurred usage.")
        usage = response.usage
        details = getattr(usage, "input_tokens_details", None)
        result = ChatResponse(
            reply=response.output_text,
            model=request.model,
            backend=self.settings.backend_mode,
            input_tokens=usage.input_tokens if usage else None,
            output_tokens=usage.output_tokens if usage else None,
            cached_tokens=getattr(details, "cached_tokens", None),
            duration_ms=round((perf_counter() - started) * 1000, 2),
            request_id=request_id,
            truncated=getattr(response, "status", None) == "incomplete",
        )
        # Metadata only: never log prompts, responses, keys or provider exceptions.
        logger.info("chat_usage %s", result.model_dump_json(exclude={"reply"}))
        return result
