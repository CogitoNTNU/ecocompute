from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from app.core.errors import ServiceError
from app.services.costs import AzureCostService, date_range, parse_cost_rows


def page(rows, next_link=None):
    return {
        "properties": {
            "columns": [{"name": name} for name in ("Currency", "ResourceId", "UsageDate", "PreTaxCost")],
            "rows": rows,
            "nextLink": next_link,
        }
    }


def test_cost_aggregation_by_resource_and_decimal(billing_settings):
    resources = billing_settings.cost_resources
    auto, foundry = resources["autoscale"][0], resources["foundry"][0]
    report = parse_cost_rows(
        [
            page(
                [
                    ["USD", auto.upper(), 20260901, 0.1],
                    ["USD", auto, 20260901, 0.2],
                    ["USD", foundry, 20260902, 2.0],
                ]
            )
        ],
        resources,
        date(2026, 9, 1),
        date(2026, 9, 3),
    )
    assert report.totals == {"autoscale": 0.3, "always-on": 0.0, "foundry": 2.0}
    assert report.daily[0].autoscale == 0.3
    assert report.daily[2].foundry == 0
    assert "shared" not in report.configured_categories


def test_empty_data_is_not_a_zero_invoice(billing_settings):
    report = parse_cost_rows([page([])], billing_settings.cost_resources, date(2026, 9, 1), date(2026, 9, 3))
    assert report.status == "empty" and report.currency is None and report.daily == []


def test_mixed_currency_rejected(billing_settings):
    resource = billing_settings.cost_resources["autoscale"][0]
    with pytest.raises(ValueError, match="currencies"):
        parse_cost_rows(
            [page([["USD", resource, 20260901, 1], ["NOK", resource, 20260901, 2]])],
            billing_settings.cost_resources,
            date(2026, 9, 1),
            date(2026, 9, 3),
        )


async def test_pagination_filter_and_cache(billing_settings):
    resource = billing_settings.cost_resources["autoscale"][0]
    start, _ = date_range(7)
    usage_date = int(start.strftime("%Y%m%d"))
    calls = []
    path = f"/subscriptions/{billing_settings.cost_subscription_id}/providers/Microsoft.CostManagement/query"

    def handle(request):
        calls.append(request)
        assert request.headers["authorization"] == "Bearer fake"
        if len(calls) == 1:
            return httpx.Response(
                200,
                json=page(
                    [["USD", resource, usage_date, 1]],
                    f"https://management.azure.com{path}?api-version=2025-03-01&$skiptoken=next",
                ),
            )
        return httpx.Response(200, json=page([["USD", resource, usage_date, 2]]))

    credential = SimpleNamespace(get_token=AsyncMock(return_value=SimpleNamespace(token="fake")))
    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        service = AzureCostService(billing_settings, credential, client)
        report = await service.report(7)
        assert report.totals["autoscale"] == 3
        assert await service.report(7) is report
    assert len(calls) == 2
    assert b'"ResourceId"' in calls[0].content


@pytest.mark.parametrize(
    "next_link", ["https://attacker.test/steal", "https://management.azure.com/other-scope"]
)
async def test_pagination_cannot_leak_credentials(billing_settings, next_link):
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(200, json=page([], next_link))

    credential = SimpleNamespace(get_token=AsyncMock(return_value=SimpleNamespace(token="secret")))
    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        with pytest.raises(ServiceError) as failure:
            await AzureCostService(billing_settings, credential, client).report(7)
        assert failure.value.status_code == 502
    assert len(calls) == 1


async def test_billing_throttle_is_an_error_not_empty_data(billing_settings):
    credential = SimpleNamespace(get_token=AsyncMock(return_value=SimpleNamespace(token="fake")))
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(429))) as client:
        with pytest.raises(ServiceError) as failure:
            await AzureCostService(billing_settings, credential, client).report(30)
        assert failure.value.status_code == 503
