"""FastAPI backend for the Spring Statement Personal Calculator.

Provides a REST API endpoint for calculating how Spring Statement policy
changes affect household taxes and benefits.
"""

import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .spring_statement import (
    calculate_household_impact,
    calculate_multi_year_net_impact,
    calculate_mtr_data,
)

executor = ThreadPoolExecutor(max_workers=3)

app = FastAPI(
    title="Spring Statement Personal Calculator API",
    description="Calculate how Spring Statement policy changes affect household finances",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SpringStatementInput(BaseModel):
    """API request model for spring statement household calculation."""

    employment_income: float = Field(
        default=30000, ge=0, description="Annual employment income (GBP)"
    )
    self_employment_income: float = Field(
        default=0, ge=0, description="Annual self-employment income (GBP)"
    )
    num_children: int = Field(
        default=0, ge=0, le=6, description="Number of dependent children"
    )
    monthly_rent: float = Field(
        default=800, ge=0, le=5000, description="Monthly rent (GBP)"
    )
    is_couple: bool = Field(
        default=False, description="Whether the household is a couple"
    )
    partner_income: float = Field(
        default=0, ge=0, le=200000, description="Partner annual employment income (GBP)"
    )
    adult_age: int = Field(
        default=30, ge=16, le=100, description="Age of primary adult"
    )
    partner_age: int = Field(
        default=30, ge=16, le=100, description="Age of partner"
    )
    children_ages: Optional[list[int]] = Field(
        default=None, description="Ages of children (list of ints)"
    )
    region: str = Field(
        default="LONDON", description="UK region"
    )
    council_tax_band: str = Field(
        default="D", description="Council tax band (A-H)"
    )
    tenure_type: str = Field(
        default="RENT_PRIVATELY", description="Housing tenure type"
    )
    childcare_expenses: float = Field(
        default=0, ge=0, le=5000, description="Monthly childcare expenses (GBP)"
    )
    student_loan_plan: str = Field(
        default="NO_STUDENT_LOAN", description="Student loan plan type"
    )
    has_postgrad_loan: bool = Field(
        default=False, description="Whether the person has a postgraduate loan"
    )
    salary_growth_rate: float = Field(
        default=0.0, ge=0.0, le=0.10, description="Annual salary growth rate for multi-year projections"
    )
    loan_balance: float = Field(
        default=0, ge=0, le=500000, description="Outstanding student loan balance (GBP)"
    )
    interest_rate: float = Field(
        default=0.0, ge=0.0, le=0.15, description="Annual interest rate on student loan"
    )
    year: int = Field(
        default=2026, ge=2025, le=2030, description="Fiscal year"
    )


@app.post("/spring-statement")
async def spring_statement(data: SpringStatementInput):
    """Calculate the impact of Spring Statement policy changes on a household."""
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


@app.post("/spring-statement/multi-year")
async def spring_statement_multi_year(data: SpringStatementInput):
    """Calculate net household income impact across years 2026-2030."""
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


@app.post("/spring-statement/mtr")
async def spring_statement_mtr(data: SpringStatementInput):
    """Calculate marginal tax rates across income range for baseline and reform."""
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
                self_employment_income=data.self_employment_income,
            ),
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {e}")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


def main():
    """Run the FastAPI server with uvicorn."""
    import uvicorn

    port = int(os.environ.get("PORT", 5002))
    print(f"Starting Spring Statement Calculator API on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
