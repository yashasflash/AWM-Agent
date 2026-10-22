from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime


WasteCategory = Literal[
    "Garbage Overflow",
    "Waste Not Collected",
    "Illegal Dumping",
    "Street Waste",
    "Plastic Waste",
    "Bad Odour",
    "Other",
]


class WasteReportCreate(BaseModel):
    waste_category: WasteCategory = "Other"

    description: str = Field(
        ...,
        min_length=5,
        max_length=2000,
    )

    # Uploaded waste photo reference
    photo_url: Optional[str] = None

    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    address: Optional[str] = Field(default=None, max_length=500)
    ward: Optional[str] = Field(default=None, max_length=100)


class WasteReportResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    report_number: int
    waste_category: str
    description: str
    photo_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    ward: Optional[str] = None
    ai_category: Optional[str] = None
    ai_priority: Optional[str] = None
    ai_summary: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime