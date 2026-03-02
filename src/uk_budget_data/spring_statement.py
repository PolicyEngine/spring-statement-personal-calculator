"""Spring Statement Personal Calculator.

Compares how Spring Statement policy changes affect a sample household's
taxes and benefits using PolicyEngine UK. Runs a baseline (Autumn Budget)
and a reform (Spring Statement) simulation, then returns per-program diffs.
"""

from policyengine_uk import Simulation, Scenario

# OBR CPI YoY growth forecasts from Autumn Budget 2024
# These are the defaults baked into PolicyEngine UK's parameter files.
AUTUMN_CPI = {
    2025: 0.0345,
    2026: 0.0248,
    2027: 0.0202,
    2028: 0.0204,
    2029: 0.0204,
    2030: 0.0200,
}

# OBR CPI YoY growth forecasts from Spring Statement 2025
SPRING_CPI = {
    2025: 0.0360,
    2026: 0.0330,
    2027: 0.0290,
    2028: 0.0220,
    2029: 0.0200,
    2030: 0.0200,
}

PROGRAMS = [
    "income_tax",
    "national_insurance",
    "universal_credit",
    "child_benefit",
    "state_pension",
    "council_tax",
]

PROGRAM_LABELS = {
    "income_tax": "Income Tax",
    "national_insurance": "National Insurance",
    "universal_credit": "Universal Credit",
    "child_benefit": "Child Benefit",
    "state_pension": "State Pension",
    "council_tax": "Council Tax",
}

# The source parameter that feeds the uprating pipeline.
CPI_PARAMETER = "gov.economic_assumptions.yoy_growth.obr.consumer_price_index"


def _build_situation(
    employment_income: float,
    num_children: int,
    monthly_rent: float,
    is_couple: bool,
    partner_income: float,
    year: int,
    region: str = "LONDON",
    council_tax_band: str = "D",
    tenure_type: str = "RENT_PRIVATELY",
) -> dict:
    """Build a PolicyEngine household situation dict."""
    people = {
        "adult": {
            "age": {year: 30},
            "employment_income": {year: employment_income},
        }
    }
    members = ["adult"]

    if is_couple:
        people["partner"] = {
            "age": {year: 30},
            "employment_income": {year: partner_income},
        }
        members.append("partner")

    for i in range(num_children):
        child_id = f"child_{i + 1}"
        people[child_id] = {
            "age": {year: 5 + i * 2},
        }
        members.append(child_id)

    situation = {
        "people": people,
        "benunits": {
            "benunit": {
                "members": members,
            }
        },
        "households": {
            "household": {
                "members": members,
                "region": {year: region},
                "council_tax_band": {year: council_tax_band},
                "tenure_type": {year: tenure_type},
            }
        },
    }

    if monthly_rent > 0:
        situation["households"]["household"]["rent"] = {year: monthly_rent * 12}

    if num_children > 0 or monthly_rent > 0:
        situation["benunits"]["benunit"]["would_claim_uc"] = {year: True}

    return situation


def _extract_results(sim: Simulation, situation: dict, year: int) -> dict:
    """Extract tax/benefit values from a completed simulation."""
    num_people = len(situation["people"])

    # Person-level variables — sum across household members
    income_tax_raw = sim.calculate("income_tax", year)
    ni_raw = sim.calculate("national_insurance", year)

    income_tax = float(income_tax_raw.sum()) if num_people > 1 else float(income_tax_raw[0])
    national_insurance = float(ni_raw.sum()) if num_people > 1 else float(ni_raw[0])

    # Benefit-unit level
    universal_credit = float(sim.calculate("universal_credit", year)[0])
    child_benefit = float(sim.calculate("child_benefit", year)[0])

    # Household level
    household_net_income = float(sim.calculate("household_net_income", year)[0])
    council_tax = float(sim.calculate("council_tax", year)[0])

    # State pension (person-level)
    state_pension_raw = sim.calculate("state_pension", year)
    state_pension = float(state_pension_raw.sum()) if num_people > 1 else float(state_pension_raw[0])

    return {
        "income_tax": round(income_tax, 2),
        "national_insurance": round(national_insurance, 2),
        "universal_credit": round(universal_credit, 2),
        "child_benefit": round(child_benefit, 2),
        "state_pension": round(state_pension, 2),
        "council_tax": round(council_tax, 2),
        "household_net_income": round(household_net_income, 2),
    }


def calculate_household_impact(
    employment_income: float,
    num_children: int,
    monthly_rent: float,
    is_couple: bool,
    partner_income: float,
    year: int = 2026,
    region: str = "LONDON",
    council_tax_band: str = "D",
    tenure_type: str = "RENT_PRIVATELY",
    spring_cpi: dict = None,
) -> dict:
    """Calculate the impact of Spring Statement policy changes on a household.

    Runs two PolicyEngine simulations:
    - Baseline: current law (Autumn Budget)
    - Reform: Spring Statement policy changes

    Returns per-program values and diffs.
    """
    situation = _build_situation(
        employment_income=employment_income,
        num_children=num_children,
        monthly_rent=monthly_rent,
        is_couple=is_couple,
        partner_income=partner_income,
        year=year,
        region=region,
        council_tax_band=council_tax_band,
        tenure_type=tenure_type,
    )

    # Baseline simulation — PolicyEngine defaults reflect Autumn Budget CPI
    baseline_sim = Simulation(situation=situation)
    baseline = _extract_results(baseline_sim, situation, year)

    # Reform simulation — override CPI YoY growth rates with Spring values.
    # Scenario(parameter_changes=...) calls reset_parameters() + process_parameters(),
    # which re-runs the full uprating pipeline with the new CPI growth rates.
    reform_cpi = spring_cpi if spring_cpi is not None else SPRING_CPI
    parameter_changes = {
        CPI_PARAMETER: {
            f"{yr}-01-01": rate for yr, rate in reform_cpi.items()
        }
    }
    scenario = Scenario(parameter_changes=parameter_changes)
    reform_sim = Simulation(situation=situation, scenario=scenario)
    reform = _extract_results(reform_sim, situation, year)

    # Compute per-program impact
    impact = {}
    for program in PROGRAMS:
        diff = reform[program] - baseline[program]
        impact[program] = round(diff, 2)

    impact["household_net_income"] = round(
        reform["household_net_income"] - baseline["household_net_income"], 2
    )

    return {
        "baseline": baseline,
        "reform": reform,
        "impact": impact,
        "cpi_values": {
            "autumn": AUTUMN_CPI,
            "spring": reform_cpi,
        },
        "program_labels": PROGRAM_LABELS,
    }
