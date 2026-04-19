"""FitTrack AI — Smart Fitness Companion
Google 2nd Innings Challenge · Challenge 2
"""
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from api.routes import router

BASE = Path(__file__).resolve().parent

app = FastAPI(title="FitTrack AI")
app.include_router(router, prefix="/api")
app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")

@app.get("/")
async def root():
    return FileResponse(BASE / "static" / "index.html")
