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
    from typing import Optional

    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field

    from spring_statement import calculate_household_impact, calculate_multi_year_net_impact, calculate_mtr_data

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
        self_employment_income: float = Field(default=0, ge=0)
        num_children: int = Field(default=0, ge=0, le=6)
        monthly_rent: float = Field(default=800, ge=0, le=5000)
        is_couple: bool = Field(default=False)
        partner_income: float = Field(default=0, ge=0, le=200000)
        adult_age: int = Field(default=30, ge=16, le=100)
        partner_age: int = Field(default=30, ge=16, le=100)
        children_ages: Optional[list[int]] = Field(default=None)
        region: str = Field(default="LONDON")
        council_tax_band: str = Field(default="D")
        tenure_type: str = Field(default="RENT_PRIVATELY")
        childcare_expenses: float = Field(default=0, ge=0, le=5000)
        student_loan_plan: str = Field(default="NO_STUDENT_LOAN")
        has_postgrad_loan: bool = Field(default=False)
        salary_growth_rate: float = Field(default=0.0, ge=0.0, le=0.10)
        loan_balance: float = Field(default=0, ge=0, le=500000)
        interest_rate: float = Field(default=0.0, ge=0.0, le=0.15)
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
                    self_employment_income=data.self_employment_income,
                    num_children=data.num_children,
                    monthly_rent=data.monthly_rent,
                    is_couple=data.is_couple,
                    partner_income=data.partner_income,
                    year=data.year,
                    adult_age=data.adult_age,
                    partner_age=data.partner_age,
                    children_ages=data.children_ages,
                    region=data.region,
                    council_tax_band=data.council_tax_band,
                    tenure_type=data.tenure_type,
                    childcare_expenses=data.childcare_expenses,
                    student_loan_plan=data.student_loan_plan,
                ),
            )
            return result

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Calculation error: {e}")

    @api.post("/spring-statement/multi-year")
    async def spring_statement_multi_year(data: SpringStatementInput):
        try:
            loop = asyncio.get_event_loop()

            result = await loop.run_in_executor(
                executor,
                lambda: calculate_multi_year_net_impact(
                    employment_income=data.employment_income,
                    self_employment_income=data.self_employment_income,
                    num_children=data.num_children,
                    monthly_rent=data.monthly_rent,
                    is_couple=data.is_couple,
                    partner_income=data.partner_income,
                    adult_age=data.adult_age,
                    partner_age=data.partner_age,
                    children_ages=data.children_ages,
                    region=data.region,
                    council_tax_band=data.council_tax_band,
                    tenure_type=data.tenure_type,
                    childcare_expenses=data.childcare_expenses,
                    student_loan_plan=data.student_loan_plan,
                    salary_growth_rate=data.salary_growth_rate,
                ),
            )
            return result

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Calculation error: {e}")

    @api.post("/spring-statement/mtr")
    async def spring_statement_mtr(data: SpringStatementInput):
        try:
            loop = asyncio.get_event_loop()

            result = await loop.run_in_executor(
                executor,
                lambda: calculate_mtr_data(
                    num_children=data.num_children,
                    monthly_rent=data.monthly_rent,
                    is_couple=data.is_couple,
                    partner_income=data.partner_income,
                    year=data.year,
                    adult_age=data.adult_age,
                    partner_age=data.partner_age,
                    children_ages=data.children_ages,
                    region=data.region,
                    council_tax_band=data.council_tax_band,
                    tenure_type=data.tenure_type,
                    childcare_expenses=data.childcare_expenses,
                    student_loan_plan=data.student_loan_plan,
                ),
            )
            return result

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Calculation error: {e}")

    return api
