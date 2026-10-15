"""The team API style (decisions 33, 81): every error is RFC 9457 problem details. Keep these green."""

from httpx import AsyncClient

PROBLEM = "application/problem+json"


async def test_unknown_route_is_a_404_problem(client: AsyncClient) -> None:
    r = await client.get("/v1/no-such-route")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith(PROBLEM)
    body = r.json()
    assert body["status"] == 404
    assert body["title"]
    assert body["instance"] == "/v1/no-such-route"


async def test_wrong_method_is_a_405_problem(client: AsyncClient) -> None:
    r = await client.post("/health")
    assert r.status_code == 405
    assert r.headers["content-type"].startswith(PROBLEM)
    assert r.json()["status"] == 405
