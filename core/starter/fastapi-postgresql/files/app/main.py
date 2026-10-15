from fastapi import FastAPI

from app import health, problems

app = FastAPI(title="{{title}} API")
problems.install(app)
app.include_router(health.router)
# Feature routers go here, one per feature folder (app/<feature>/router.py): skill stack-fastapi.
