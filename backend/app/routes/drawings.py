import base64
import binascii
import secrets
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import LABELS, settings
from ..database import get_db
from ..models import Drawing
from ..schemas import (
    DrawingCreate,
    DrawingCreated,
    DrawingModerationResult,
    DrawingModerationUpdate,
    DrawingOut,
    LabelsOut,
    ModerationDrawingOut,
    ModerationStatsOut,
    StatsOut,
)


router = APIRouter(prefix="/api", tags=["drawings"])
APPROVED = "approved"
PENDING = "pending"
REJECTED = "rejected"


def require_moderation_key(
    x_secret_key: Annotated[str | None, Header(alias="X-Secret-Key")] = None,
) -> str:
    expected = settings.moderation_secret_key
    if not x_secret_key or not secrets.compare_digest(x_secret_key, expected):
        raise HTTPException(status_code=401, detail="Invalid moderation key")
    return x_secret_key


@router.get("/labels", response_model=LabelsOut)
def list_labels() -> LabelsOut:
    return LabelsOut(labels=list(LABELS))


@router.get("/drawings/stats", response_model=StatsOut)
def drawings_stats(db: Session = Depends(get_db)) -> StatsOut:
    rows = db.execute(
        select(Drawing.label, func.count(Drawing.id))
        .where(Drawing.moderation_status == APPROVED)
        .group_by(Drawing.label)
    ).all()
    counts: dict[str, int] = {label: 0 for label in LABELS}
    for label, count in rows:
        counts[label] = count
    return StatsOut(counts=counts)


@router.get("/drawings", response_model=list[DrawingOut])
def list_drawings(
    label: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
) -> list[DrawingOut]:
    if label not in LABELS:
        raise HTTPException(status_code=400, detail=f"Unknown label '{label}'")

    rows = db.execute(
        select(Drawing)
        .where(Drawing.label == label, Drawing.moderation_status == APPROVED)
        .order_by(Drawing.id.desc())
        .limit(limit)
    ).scalars().all()

    return [
        DrawingOut(
            id=row.id,
            label=row.label,
            nickname=row.nickname,
            png_base64=base64.b64encode(row.png).decode("ascii"),
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("/drawings", response_model=DrawingCreated, status_code=201)
def create_drawing(
    payload: DrawingCreate,
    db: Session = Depends(get_db),
) -> DrawingCreated:
    if payload.label not in LABELS:
        raise HTTPException(status_code=400, detail=f"Unknown label '{payload.label}'")

    raw = payload.png_base64
    if "," in raw:
        raw = raw.split(",", 1)[1]
    try:
        png_bytes = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid png_base64: {exc}")

    drawing = Drawing(
        label=payload.label,
        nickname=payload.nickname.strip(),
        shapes=payload.shapes,
        png=png_bytes,
        moderation_status=PENDING,
    )
    db.add(drawing)
    db.commit()
    db.refresh(drawing)
    return DrawingCreated(id=drawing.id)


@router.get("/drawings/moderation", response_model=list[ModerationDrawingOut])
def list_pending_drawings(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: str = Depends(require_moderation_key),
) -> list[ModerationDrawingOut]:
    rows = db.execute(
        select(Drawing)
        .where(Drawing.moderation_status == PENDING)
        .order_by(Drawing.created_at.asc(), Drawing.id.asc())
        .limit(limit)
    ).scalars().all()

    return [
        ModerationDrawingOut(
            id=row.id,
            label=row.label,
            nickname=row.nickname,
            png_base64=base64.b64encode(row.png).decode("ascii"),
            created_at=row.created_at,
            moderation_status=row.moderation_status,
        )
        for row in rows
    ]


@router.get("/drawings/moderation/stats", response_model=ModerationStatsOut)
def moderation_stats(
    db: Session = Depends(get_db),
    _: str = Depends(require_moderation_key),
) -> ModerationStatsOut:
    pending = db.execute(
        select(func.count(Drawing.id)).where(Drawing.moderation_status == PENDING)
    ).scalar_one()
    return ModerationStatsOut(pending=pending)


@router.patch("/drawings/{drawing_id}/moderation", response_model=DrawingModerationResult)
def moderate_drawing(
    drawing_id: int,
    payload: DrawingModerationUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_moderation_key),
) -> DrawingModerationResult:
    drawing = db.get(Drawing, drawing_id)
    if drawing is None:
        raise HTTPException(status_code=404, detail="Drawing not found")

    drawing.moderation_status = APPROVED if payload.decision == "approve" else REJECTED
    drawing.reviewed_by = "moderator"
    drawing.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(drawing)

    return DrawingModerationResult(
        id=drawing.id,
        moderation_status=drawing.moderation_status,
    )
