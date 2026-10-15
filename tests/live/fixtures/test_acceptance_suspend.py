"""Hidden acceptance test for ticket 21 (the agent never sees it): contract api-v1.1.0, suspendUser."""

import uuid

from httpx import AsyncClient


async def test_acceptance_suspend(client: AsyncClient) -> None:
    r = await client.post("/v1/users", json={"email": "acceptance-suspend@example.com", "displayName": "S"})
    assert r.status_code == 201, r.text
    created = r.json()
    assert created.get("suspendedAt") is None
    user_id = created["id"]

    r = await client.post(f"/v1/users/{user_id}/suspend")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "SUSPENDED"
    assert body["suspendedAt"] and body["suspendedAt"].endswith(("Z", "+00:00"))

    again = await client.post(f"/v1/users/{user_id}/suspend")
    assert again.status_code == 409
    assert again.headers["content-type"] == "application/problem+json"

    missing = await client.post(f"/v1/users/{uuid.uuid4()}/suspend")
    assert missing.status_code == 404
    assert missing.headers["content-type"] == "application/problem+json"

    got = await client.get(f"/v1/users/{user_id}")
    assert got.json()["suspendedAt"] == body["suspendedAt"]
