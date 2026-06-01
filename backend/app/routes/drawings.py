import base64
import binascii

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import LABELS
from ..database import get_db
from ..models import Drawing
from ..schemas import (
    DrawingCreate,
    DrawingCreated,
    DrawingOut,
    LabelsOut,
    StatsOut,
)


router = APIRouter(prefix="/api", tags=["drawings"])


@router.get("/labels", response_model=LabelsOut)
def list_labels() -> LabelsOut:
    return LabelsOut(labels=list(LABELS))


@router.get("/drawings/stats", response_model=StatsOut)
def drawings_stats(db: Session = Depends(get_db)) -> StatsOut:
    rows = db.execute(
        select(Drawing.label, func.count(Drawing.id)).group_by(Drawing.label)
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
        .where(Drawing.label == label)
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
    )
    db.add(drawing)
    db.commit()
    db.refresh(drawing)
    return DrawingCreated(id=drawing.id)
