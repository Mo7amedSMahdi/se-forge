"""API tests per status code of the contract (tests/stacks/contract/users.yaml)."""

import uuid

from httpx import AsyncClient

PROBLEM = "application/problem+json"


async def create(client: AsyncClient, email: str, name: str = "Amal") -> dict[str, object]:
    r = await client.post("/v1/users", json={"email": email, "displayName": name})
    assert r.status_code == 201, r.text
    return dict(r.json())


async def test_create_returns_201_with_location_and_camel_case(client: AsyncClient) -> None:
    r = await client.post("/v1/users", json={"email": "Amal@Example.com", "displayName": "Amal"})
    assert r.status_code == 201
    body = r.json()
    assert r.headers["location"] == f"/v1/users/{body['id']}"
    assert body["email"] == "amal@example.com"
    assert body["displayName"] == "Amal" and body["status"] == "ACTIVE" and "createdAt" in body


async def test_duplicate_email_is_409_problem(client: AsyncClient) -> None:
    await create(client, "dup@example.com")
    r = await client.post("/v1/users", json={"email": "dup@example.com", "displayName": "Again"})
    assert r.status_code == 409
    assert r.headers["content-type"] == PROBLEM
    assert r.json()["title"] == "Email already used"


async def test_invalid_input_is_400_with_field_errors(client: AsyncClient) -> None:
    r = await client.post("/v1/users", json={"email": "not-an-email", "role": "admin"})
    assert r.status_code == 400
    assert r.headers["content-type"] == PROBLEM
    fields = {e["field"] for e in r.json()["errors"]}
    assert {"email", "displayName", "role"} <= fields


async def test_unknown_user_is_404_problem(client: AsyncClient) -> None:
    for user_id in (str(uuid.uuid4()), "not-a-uuid"):
        r = await client.get(f"/v1/users/{user_id}")
        assert r.status_code == 404
        assert r.headers["content-type"] == PROBLEM


async def test_get_returns_the_user(client: AsyncClient) -> None:
    user = await create(client, "get@example.com")
    r = await client.get(f"/v1/users/{user['id']}")
    assert r.status_code == 200 and r.json()["email"] == "get@example.com"


async def test_list_pages_with_a_cursor_newest_first(client: AsyncClient) -> None:
    for i in range(3):
        await create(client, f"page{i}@example.com", f"P{i}")
    seen: list[str] = []
    cursor = None
    while True:
        r = await client.get("/v1/users", params={"limit": 2, **({"cursor": cursor} if cursor else {})})
        assert r.status_code == 200
        page = r.json()
        seen += [u["email"] for u in page["items"]]
        cursor = page["nextCursor"]
        if cursor is None:
            break
    assert len(seen) == len(set(seen)), "no user twice"
    assert seen.index("page2@example.com") < seen.index("page0@example.com"), "newest first"


async def test_bad_limit_and_cursor_are_400(client: AsyncClient) -> None:
    assert (await client.get("/v1/users", params={"limit": 0})).status_code == 400
    assert (await client.get("/v1/users", params={"cursor": "garbage"})).status_code == 400
