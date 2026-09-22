from fastapi import FastAPI
from .connectors import CONNECTOR_TYPES

app=FastAPI(title="AssetNova Connector Service",version="0.1.0")

@app.get("/health/live")
async def live(): return {"status":"ok"}

@app.get("/health/ready")
async def ready(): return {"status":"ready"}

@app.get("/connectors")
async def connectors(): return {"connectors":sorted(CONNECTOR_TYPES)}

