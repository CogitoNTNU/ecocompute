import pytest

from app.core.config import configured_models


def test_configured_models_accepts_arbitrary_deployments_and_decimal_rates():
    models = configured_models(
        '[{"id":"new-model","label":"New model","deployment":"foundry-name",'
        '"input_usd_per_million":"0.25","output_usd_per_million":"1.5"}]',
        "https://foundry.example.test/openai/v1/",
        "secret",
    )
    assert len(models) == 1
    assert models[0].enabled
    assert models[0].deployment == "foundry-name"
    assert str(models[0].input_usd_per_million) == "0.25"


@pytest.mark.parametrize(
    "raw",
    [
        '[{"id":"same","label":"One","deployment":"one"},{"id":"same","label":"Two","deployment":"two"}]',
        '[{"id":"../unsafe","label":"Bad","deployment":"bad"}]',
        '[{"id":"a","label":"A","deployment":"a","input_usd_per_million":1}]',
        '[{"id":"a","label":"A","deployment":"a","input_usd_per_million":-1,"output_usd_per_million":1}]',
        '[{"id":"a","label":"A","deployment":"a","input_usd_per_million":"NaN","output_usd_per_million":1}]',
        '[{"id":"a","label":"A","deployment":"a","api_key":"secret"}]',
    ],
)
def test_invalid_model_catalog_fails_closed(raw):
    with pytest.raises(ValueError):
        configured_models(raw, "https://foundry.example.test/openai/v1/", "secret")
