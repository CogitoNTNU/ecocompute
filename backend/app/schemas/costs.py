from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class CostPoint(BaseModel):
    date: date
    autoscale: float = 0
    always_on: float = 0
    foundry: float = 0
    shared: float = 0


class CostReport(BaseModel):
    status: Literal["ready", "empty", "not_configured"]
    source: str = "Azure Cost Management · actual pre-tax cost"
    start_date: date
    end_date: date
    fetched_at: datetime | None = None
    currency: str | None = None
    configured_categories: list[str]
    totals: dict[str, float]
    daily: list[CostPoint]
