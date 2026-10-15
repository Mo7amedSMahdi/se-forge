from fastapi import APIRouter

router = APIRouter()


@router.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    """Liveness: the process answers. Compose and later the deployment wait for it."""
    return {"status": "ok"}
