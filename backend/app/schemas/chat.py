from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ModelId = Literal["gpt-4.1-nano", "gpt-6-luna"]
BackendId = Literal["autoscale", "always-on"]


class Message(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=16000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    model: ModelId
    backend: BackendId
    messages: list[Message] = Field(min_length=1, max_length=21)

    @model_validator(mode="after")
    def validate_conversation(self) -> "ChatRequest":
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be from the user.")
        if sum(len(message.content) for message in self.messages) > 32000:
            raise ValueError("Conversation is too long. Start a new chat.")
        for index, message in enumerate(self.messages):
            if message.role != ("user" if index % 2 == 0 else "assistant"):
                raise ValueError("Messages must alternate between user and assistant.")
        if len(self.messages[-1].content) > 8000:
            raise ValueError("The prompt must be at most 8000 characters.")
        return self


class ChatResponse(BaseModel):
    reply: str
    model: ModelId
    backend: BackendId
    input_tokens: int | None
    output_tokens: int | None
    cached_tokens: int | None
    duration_ms: float
    request_id: str
    truncated: bool = False
