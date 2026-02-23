import pytest


@pytest.mark.asyncio
async def test_login_success(client):
    response = await client.post("/api/v1/auth/login", json={
        "email": "jean.dupont@ecole.fr",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    response = await client.post("/api/v1/auth/login", json={
        "email": "jean.dupont@ecole.fr",
        "password": "wrong"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client):
    response = await client.post("/api/v1/auth/login", json={
        "email": "unknown@ecole.fr",
        "password": "password123"
    })
    assert response.status_code == 401
