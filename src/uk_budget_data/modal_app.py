"""Modal deployment for Spring Statement Personal Calculator API.

This module provides a serverless deployment of the spring statement calculator
API using Modal.com infrastructure.

To deploy:
    modal deploy src/uk_budget_data/modal_app.py

To run locally:
    modal serve src/uk_budget_data/modal_app.py
"""

import modal
from pathlib import Path

app = modal.App("spring-statement-calculator-api")

image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install(
        "fastapi",
        "pydantic",
        "numpy",
        "pandas",
        "policyengine-uk==2.74.0",
    )
    .add_local_file(
        Path(__file__).parent / "spring_statement.py",
        remote_path="/root/spring_statement.py",
    )
)


@app.function(
    image=image,
    timeout=300,
    memory=2048,
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def fastapi_app():
    """Serve the FastAPI app via Modal."""
    import sys
    sys.path.insert(0, "/root")

    # Pre-warm PolicyEngine on container start
    from policyengine_uk import Simulation  # noqa: F401

    import asyncio
    from concurrent.futures import ThreadPoolExecutor

    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field

    from spring_statement import calculate_household_impact

    executor = ThreadPoolExecutor(max_workers=3)

    api = FastAPI(
        title="Spring Statement Personal Calculator API",
        description="Calculate how Spring Statement CPI forecast changes affect household finances",
        version="1.0.0",
    )

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class SpringStatementInput(BaseModel):
        employment_income: float = Field(default=30000, ge=0)
        num_children: int = Field(default=0, ge=0, le=6)
        monthly_rent: float = Field(default=800, ge=0, le=5000)
        is_couple: bool = Field(default=False)
        partner_income: float = Field(default=0, ge=0, le=200000)
        region: str = Field(default="LONDON")
        council_tax_band: str = Field(default="D")
        tenure_type: str = Field(default="RENT_PRIVATELY")
        year: int = Field(default=2026, ge=2025, le=2030)

    @api.get("/")
    async def root():
        return {"status": "ok", "service": "spring-statement-calculator-api", "version": "1.0.0"}

    @api.get("/health")
    async def health_check():
        return {"status": "healthy"}

    @api.post("/spring-statement")
    async def spring_statement(data: SpringStatementInput):
        try:
            loop = asyncio.get_event_loop()

            result = await loop.run_in_executor(
                executor,
                lambda: calculate_household_impact(
                    employment_income=data.employment_income,
                    num_children=data.num_children,
                    monthly_rent=data.monthly_rent,
                    is_couple=data.is_couple,
                    partner_income=data.partner_income,
                    region=data.region,
                    council_tax_band=data.council_tax_band,
                    tenure_type=data.tenure_type,
                    year=data.year,
                ),
            )
            return result

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Calculation error: {e}")

    return api
