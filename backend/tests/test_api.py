from dataclasses import replace

from fastapi.testclient import TestClient

from app.main import create_app


def test_public_config_excludes_secrets(settings):
    with TestClient(create_app(settings)) as client:
        response = client.get("/api/config")
        assert response.status_code == 200
        assert "secret-key" not in response.text
        assert "foundry.example" not in response.text
        assert response.json()["models"][1]["enabled"] is True
        assert response.headers["cache-control"] == "no-store"
        assert client.get("/health").json()["backend"] == "always-on"


def test_unconfigured_billing_and_ranges(settings):
    with TestClient(create_app(settings)) as client:
        for days in (7, 30, 90):
            response = client.get(f"/api/costs?days={days}")
            assert response.status_code == 200, response.text
            assert response.json()["status"] == "not_configured"
            assert response.json()["totals"] == {}
            assert response.json()["currency"] is None
        assert client.get("/api/costs?days=365").status_code == 422


def test_cors_allowlist(settings):
    with TestClient(create_app(settings)) as client:
        headers = {
            "Origin": "https://ui.example.test",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        }
        assert (
            client.options("/api/chat", headers=headers).headers["access-control-allow-origin"]
            == "https://ui.example.test"
        )
        headers["Origin"] = "https://untrusted.example.test"
        assert client.options("/api/chat", headers=headers).status_code == 400


def test_request_limits_and_private_validation(settings):
    with TestClient(create_app(settings)) as client:
        response = client.post("/api/chat", json={"messages": "private prompt", "model": "bad"})
        assert response.status_code == 422
        assert "private prompt" not in response.text
        assert client.post("/api/chat", content=b"x" * 140000).status_code == 413


def test_spa_routes_and_no_api_fallback(settings, tmp_path):
    (tmp_path / "index.html").write_text("<html>React application</html>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log('app')")
    with TestClient(create_app(replace(settings, frontend_dist=tmp_path))) as client:
        for path in ("/", "/costs"):
            response = client.get(path)
            assert response.status_code == 200 and "React application" in response.text
            assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
        assert client.get("/assets/app.js").status_code == 200
        assert client.get("/api/not-real").status_code == 404
        assert client.get("/missing.js").status_code == 404
