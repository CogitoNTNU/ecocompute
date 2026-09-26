from dataclasses import replace

import pytest

from app.core.config import ModelDeployment, Settings


@pytest.fixture
def settings():
    return Settings(
        backend_mode="always-on",
        backend_urls={"autoscale": "https://autoscale.example.test"},
        allowed_origins=("https://ui.example.test",),
        models=(
            ModelDeployment(
                "gpt-4.1-nano",
                "GPT-4.1 Nano",
                "nano-deployment",
                "https://foundry.example.test/v1/",
                "secret-key",
            ),
            ModelDeployment(
                "gpt-6-luna",
                "GPT-6 Luna",
                "luna-deployment",
                "https://foundry.example.test/v1/",
                "secret-key",
            ),
        ),
    )


@pytest.fixture
def billing_settings(settings):
    subscription = "7ec1bafb-324b-43b8-9c30-76e35b9d38cd"
    root = f"/subscriptions/{subscription}/resourceGroups/test/providers"
    return replace(
        settings,
        cost_subscription_id=subscription,
        cost_resources={
            "autoscale": [f"{root}/Microsoft.App/containerApps/autoscale"],
            "always-on": [f"{root}/Microsoft.App/containerApps/always-on"],
            "foundry": [f"{root}/Microsoft.CognitiveServices/accounts/foundry"],
        },
    )
