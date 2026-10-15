"""Hidden acceptance test for the pipeline trial: tickets 1 and 2 (D-003, D-004), judged on dev."""

from httpx import AsyncClient


async def test_email_is_unique_regardless_of_case(client: AsyncClient) -> None:
    first = await client.post("/v1/users", json={"email": "Case.Judge@Example.com", "displayName": "First"})
    assert first.status_code == 201, first.text
    assert first.json()["email"] == "case.judge@example.com"
    second = await client.post("/v1/users", json={"email": "case.judge@example.com", "displayName": "Second"})
    assert second.status_code == 409, second.text


async def test_display_name_of_only_spaces_is_400(client: AsyncClient) -> None:
    r = await client.post("/v1/users", json={"email": "blank.judge@example.com", "displayName": "   "})
    assert r.status_code == 400, r.text
    assert "displayName" in {e["field"] for e in r.json()["errors"]}


async def test_display_name_is_trimmed(client: AsyncClient) -> None:
    r = await client.post("/v1/users", json={"email": "trim.judge@example.com", "displayName": "  Ana  "})
    assert r.status_code == 201, r.text
    assert r.json()["displayName"] == "Ana"
