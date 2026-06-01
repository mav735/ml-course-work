from datetime import datetime

from pydantic import BaseModel, Field


class DrawingCreate(BaseModel):
    label: str = Field(min_length=1, max_length=50)
    nickname: str = Field(min_length=1, max_length=50)
    shapes: list = Field(default_factory=list)
    png_base64: str = Field(min_length=1)


class DrawingOut(BaseModel):
    id: int
    label: str
    nickname: str
    png_base64: str
    created_at: datetime


class DrawingCreated(BaseModel):
    id: int


class LabelsOut(BaseModel):
    labels: list[str]


class StatsOut(BaseModel):
    counts: dict[str, int]
