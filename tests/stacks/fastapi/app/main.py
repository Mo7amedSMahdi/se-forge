from fastapi import FastAPI

from app import problems
from app.users.router import router as users_router

app = FastAPI(title="Users")
problems.install(app)
app.include_router(users_router)
