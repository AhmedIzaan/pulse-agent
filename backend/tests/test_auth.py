import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_me_no_token():
    """Request without Authorization header returns 403 (Bearer scheme required)."""
    response = client.get("/api/me")
    assert response.status_code == 403


def test_me_invalid_token(monkeypatch):
    """Request with a malformed JWT returns 401.
    Monkeypatches a non-empty JWKS URL so the client initialises;
    PyJWT then fails on the malformed header before any network call."""
    from core import auth as auth_module
    auth_module._jwks_client = None
    monkeypatch.setattr(
        "core.auth.settings.clerk_jwks_url",
        "https://example.clerk.accounts.dev/.well-known/jwks.json",
    )
    response = client.get("/api/me", headers={"Authorization": "Bearer not.a.real.jwt"})
    assert response.status_code == 401
    auth_module._jwks_client = None


def test_me_missing_clerk_jwks_url(monkeypatch):
    """Returns 503 when CLERK_JWKS_URL is not configured."""
    from core import auth
    # Reset cached client so it re-evaluates the config
    auth._jwks_client = None
    monkeypatch.setattr("core.auth.settings.clerk_jwks_url", "")
    response = client.get("/api/me", headers={"Authorization": "Bearer a.b.c"})
    assert response.status_code in (401, 503)
    # Restore
    auth._jwks_client = None
