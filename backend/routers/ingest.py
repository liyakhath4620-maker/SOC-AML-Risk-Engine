"""
Ingest Router — POST /api/v1/ingest

Accepts a JSON array of mixed SOC and AML records, validates the payload,
and ingests them into the graph database (or mock store).
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from graph_layer.ingestion import ingest_data

router = APIRouter(prefix="/api/v1", tags=["Ingestion"])


class IngestResponse(BaseModel):
    total: int = Field(..., description="Total records received")
    ingested: dict = Field(..., description="Count per record_type ingested")
    errors: int = Field(..., description="Number of records that failed")
    message: str = Field(..., description="Human-readable summary")


@router.post(
    "/ingest",
    response_model=IngestResponse,
    summary="Ingest SOC / AML records",
    description=(
        "Accepts a JSON array of records with `record_type` field "
        "(cyber_alert | transaction | login_event). Each record is "
        "parsed, validated, and stored as interconnected graph nodes."
    ),
)
async def ingest_records(records: list[dict], request: Request):
    """Ingest an array of SOC/AML data records into the graph."""
    if not records:
        raise HTTPException(
            status_code=422,
            detail="Empty payload — provide at least one record.",
        )

    driver = request.app.state.driver
    if driver is None:
        raise HTTPException(
            status_code=503,
            detail="Graph database driver not available.",
        )

    try:
        summary = ingest_data(driver, records)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Ingestion failed: {exc}",
        )

    return IngestResponse(**summary)
