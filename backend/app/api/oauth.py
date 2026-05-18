from __future__ import annotations

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import JSONResponse

from app.services import service_client_service

router = APIRouter(prefix="/api/oauth", tags=["oauth"])


@router.post("/token")
async def token(
    grant_type: str = Form(...),
    client_id: str = Form(...),
    client_secret: str = Form(...),
    scope: str = Form(default=""),
):
    if grant_type != "client_credentials":
        raise HTTPException(status_code=400, detail="Unsupported grant_type")
    return JSONResponse(
        service_client_service.issue_client_credentials_token(
            client_id=client_id,
            client_secret=client_secret,
            requested_scope=scope,
        )
    )
