"""Azure billing adapter. No estimated prices or invented model attribution."""

import asyncio
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from time import monotonic
from typing import Protocol
from urllib.parse import urlsplit

import httpx
from azure.core.exceptions import AzureError
from azure.identity.aio import DefaultAzureCredential

from app.core.config import Settings
from app.core.errors import ServiceError
from app.schemas.costs import CostPoint, CostReport


class CostService(Protocol):
    async def report(self, days: int) -> CostReport: ...


def date_range(days: int) -> tuple[date, date]:
    end = datetime.now(UTC).date() - timedelta(days=1)
    return end - timedelta(days=days - 1), end


class UnconfiguredCostService:
    async def report(self, days: int) -> CostReport:
        start, end = date_range(days)
        return CostReport(
            status="not_configured",
            start_date=start,
            end_date=end,
            configured_categories=[],
            totals={},
            daily=[],
        )


def parse_cost_rows(pages: list[dict], resources: dict[str, list[str]], start: date, end: date) -> CostReport:
    """Use column names, not positions: Azure can change the column order."""
    lookup = {rid.lower(): category for category, ids in resources.items() for rid in ids}
    totals = {category: Decimal(0) for category, ids in resources.items() if ids}
    daily: dict[date, dict[str, Decimal]] = {}
    currencies: set[str] = set()
    for page in pages:
        properties = page["properties"]
        columns = {column["name"].lower(): index for index, column in enumerate(properties["columns"])}
        rows = properties["rows"]
        if not rows:
            continue
        amount_key = next((key for key in ("pretaxcost", "cost", "totalcost") if key in columns), None)
        if amount_key is None:
            raise ValueError("Missing cost column")
        for row in rows:
            category = lookup.get(str(row[columns["resourceid"]]).lower())
            if category is None:
                raise ValueError("Unexpected resource in filtered cost report")
            day = datetime.strptime(str(row[columns["usagedate"]]), "%Y%m%d").date()
            if not start <= day <= end:
                raise ValueError("Cost date outside requested range")
            currency = str(row[columns["currency"]])
            if len(currency) != 3 or not currency.isalpha():
                raise ValueError("Invalid currency")
            currencies.add(currency.upper())
            amount = Decimal(str(row[columns[amount_key]]))
            if not amount.is_finite():
                raise ValueError("Invalid cost value")
            totals[category] += amount
            daily.setdefault(day, {}).setdefault(category, Decimal(0))
            daily[day][category] += amount
    if len(currencies) > 1:
        raise ValueError("Costs in different currencies cannot be added")
    points = []
    if currencies:
        for offset in range((end - start).days + 1):
            day = start + timedelta(days=offset)
            values = daily.get(day, {})
            points.append(
                CostPoint(date=day, **{key.replace("-", "_"): float(value) for key, value in values.items()})
            )
    return CostReport(
        status="ready" if currencies else "empty",
        start_date=start,
        end_date=end,
        fetched_at=datetime.now(UTC),
        currency=next(iter(currencies), None),
        configured_categories=list(totals),
        totals={key: float(value) for key, value in totals.items()},
        daily=points,
    )


class AzureCostService:
    def __init__(self, settings: Settings, credential: DefaultAzureCredential, client: httpx.AsyncClient):
        self.settings = settings
        self.credential = credential
        self.client = client
        self._cache: dict[int, tuple[float, CostReport]] = {}
        self._lock = asyncio.Lock()

    async def report(self, days: int) -> CostReport:
        async with self._lock:
            cached = self._cache.get(days)
            if cached and monotonic() - cached[0] < 900:
                return cached[1]
            try:
                async with asyncio.timeout(60):
                    result = await self._query(days)
            except ServiceError:
                raise
            except (AzureError, httpx.HTTPError, TimeoutError):
                raise ServiceError(
                    503, "Azure billing is unavailable. Check managed identity access and try again later."
                ) from None
            except (ValueError, KeyError, TypeError, IndexError, ArithmeticError):
                raise ServiceError(
                    502, "Azure returned billing data that could not be safely combined."
                ) from None
            self._cache[days] = (monotonic(), result)
            return result

    async def _query(self, days: int) -> CostReport:
        start, end = date_range(days)
        resource_ids = [rid for ids in self.settings.cost_resources.values() for rid in ids]
        path = f"/subscriptions/{self.settings.cost_subscription_id}/providers/Microsoft.CostManagement/query"
        url = f"https://management.azure.com{path}?api-version=2025-03-01"
        body = {
            "type": "ActualCost",
            "timeframe": "Custom",
            "timePeriod": {"from": f"{start}T00:00:00Z", "to": f"{end}T23:59:59Z"},
            "dataset": {
                "granularity": "Daily",
                "aggregation": {"totalCost": {"name": "PreTaxCost", "function": "Sum"}},
                "grouping": [{"type": "Dimension", "name": "ResourceId"}],
                "filter": {"dimensions": {"name": "ResourceId", "operator": "In", "values": resource_ids}},
            },
        }
        token = await self.credential.get_token("https://management.azure.com/.default")
        pages: list[dict] = []
        visited: set[str] = set()
        for _ in range(100):
            # Never forward Azure credentials to an arbitrary pagination URL.
            parsed = urlsplit(url)
            if (
                parsed.scheme != "https"
                or parsed.netloc != "management.azure.com"
                or parsed.path.lower() != path.lower()
                or parsed.fragment
                or url in visited
            ):
                raise ServiceError(502, "Azure returned an invalid billing continuation link.")
            visited.add(url)
            response = await self.client.post(
                url, json=body, headers={"Authorization": f"Bearer {token.token}"}
            )
            if response.status_code == 429:
                raise ServiceError(
                    503, "Azure billing is rate limited. Wait a few minutes before refreshing."
                )
            response.raise_for_status()
            if response.status_code == 204:
                break
            page = response.json()
            pages.append(page)
            url = page["properties"].get("nextLink")
            if not url:
                break
        else:
            raise ServiceError(502, "The billing report is too large. Choose a shorter period.")
        return parse_cost_rows(pages, self.settings.cost_resources, start, end)
