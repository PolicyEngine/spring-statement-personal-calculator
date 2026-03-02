"""Spring Statement Personal Calculator.

Compares how Spring Statement policy changes affect a sample household's
taxes and benefits using PolicyEngine UK. Runs a baseline (Autumn Budget)
and a reform (Spring Statement) simulation, then returns per-program diffs.
"""

from policyengine_uk import Simulation, Scenario

CPI_YEARS = range(2025, 2031)

# OBR CPI YoY growth forecasts from Spring Statement 2025
SPRING_CPI = {
    2025: 0.0360,
    2026: 0.0330,
    2027: 0.0290,
    2028: 0.0220,
    2029: 0.0200,
    2030: 0.0200,
}

# The source parameter that feeds the uprating pipeline.
CPI_PARAMETER = "gov.economic_assumptions.yoy_growth.obr.consumer_price_index"

# ---------------------------------------------------------------------------
# Variable extraction config: (variable_name, entity_level)
# entity_level: "person" = sum across people, "benunit" = first benunit,
#               "household" = first household
# ---------------------------------------------------------------------------
PERSON_VARS = "person"
BENUNIT_VARS = "benunit"
HOUSEHOLD_VARS = "household"

# Ordered group definitions for display.
PROGRAM_GROUPS = [
    {"id": "direct_taxes", "label": "Direct Taxes"},
    {"id": "indirect_taxes", "label": "Indirect Taxes"},
    {"id": "property_local_taxes", "label": "Property & Local Taxes"},
    {"id": "other_deductions", "label": "Other Deductions"},
    {"id": "core_benefits", "label": "Core Benefits"},
    {"id": "pension_retirement", "label": "Pension & Retirement"},
    {"id": "disability_carer", "label": "Disability & Carer Benefits"},
    {"id": "employment_support", "label": "Employment Support"},
    {"id": "childcare", "label": "Childcare"},
    {"id": "scottish_benefits", "label": "Scottish Benefits"},
]

# Top-level programs with their sub-components for breakdown display.
# Structure: list of dicts, each with id, label, entity, is_tax, group, children.
PROGRAM_STRUCTURE = [
    # ── DIRECT TAXES ─────────────────────────────────────────────────────
    {
        "id": "income_tax",
        "label": "Income Tax",
        "entity": PERSON_VARS,
        "is_tax": True,
        "group": "direct_taxes",
        "children": [
            {"id": "earned_income_tax", "label": "Earned Income", "entity": PERSON_VARS},
            {"id": "savings_income_tax", "label": "Savings Income", "entity": PERSON_VARS},
            {"id": "dividend_income_tax", "label": "Dividend Income", "entity": PERSON_VARS},
        ],
    },
    {
        "id": "national_insurance",
        "label": "National Insurance",
        "entity": PERSON_VARS,
        "is_tax": True,
        "group": "direct_taxes",
        "children": [
            {"id": "ni_class_1_employee", "label": "Class 1 (Employee)", "entity": PERSON_VARS},
            {"id": "ni_class_2", "label": "Class 2 (Self-Employed)", "entity": PERSON_VARS},
            {"id": "ni_class_4", "label": "Class 4 (Self-Employed)", "entity": PERSON_VARS},
        ],
    },
    {
        "id": "capital_gains_tax",
        "label": "Capital Gains Tax",
        "entity": PERSON_VARS,
        "is_tax": True,
        "group": "direct_taxes",
    },
    # ── INDIRECT TAXES ───────────────────────────────────────────────────
    {
        "id": "vat",
        "label": "Value Added Tax (VAT)",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "indirect_taxes",
    },
    {
        "id": "fuel_duty",
        "label": "Fuel Duty",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "indirect_taxes",
    },
    # ── PROPERTY & LOCAL TAXES ───────────────────────────────────────────
    {
        "id": "council_tax",
        "label": "Council Tax",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "property_local_taxes",
    },
    {
        "id": "domestic_rates",
        "label": "Domestic Rates (NI)",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "property_local_taxes",
    },
    {
        "id": "stamp_duty_land_tax",
        "label": "Stamp Duty Land Tax",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "property_local_taxes",
    },
    {
        "id": "lbtt",
        "label": "Land & Buildings Transaction Tax",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "property_local_taxes",
    },
    {
        "id": "land_transaction_tax",
        "label": "Land Transaction Tax",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "property_local_taxes",
    },
    {
        "id": "business_rates",
        "label": "Business Rates",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "property_local_taxes",
    },
    # ── OTHER DEDUCTIONS ─────────────────────────────────────────────────
    {
        "id": "student_loan_repayment",
        "label": "Student Loan Repayment",
        "entity": PERSON_VARS,
        "is_tax": True,
        "group": "other_deductions",
    },
    {
        "id": "tv_licence",
        "label": "TV Licence",
        "entity": HOUSEHOLD_VARS,
        "is_tax": True,
        "group": "other_deductions",
    },
    # ── CORE BENEFITS ────────────────────────────────────────────────────
    {
        "id": "universal_credit",
        "label": "Universal Credit",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "core_benefits",
        "children": [
            {"id": "uc_standard_allowance", "label": "Standard Allowance", "entity": BENUNIT_VARS},
            {"id": "uc_child_element", "label": "Child Element", "entity": BENUNIT_VARS},
            {"id": "uc_housing_costs_element", "label": "Housing Element", "entity": BENUNIT_VARS},
            {"id": "uc_childcare_element", "label": "Childcare Element", "entity": BENUNIT_VARS},
            {"id": "uc_disability_element", "label": "Disability Element", "entity": BENUNIT_VARS},
            {"id": "uc_carer_element", "label": "Carer Element", "entity": BENUNIT_VARS},
        ],
    },
    {
        "id": "child_benefit",
        "label": "Child Benefit",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "core_benefits",
        "children": [
            {"id": "child_benefit_less_tax_charge", "label": "After High-Income Tax Charge", "entity": BENUNIT_VARS},
        ],
    },
    {
        "id": "housing_benefit",
        "label": "Housing Benefit",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "core_benefits",
    },
    {
        "id": "working_tax_credit",
        "label": "Working Tax Credit",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "core_benefits",
    },
    {
        "id": "child_tax_credit",
        "label": "Child Tax Credit",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "core_benefits",
    },
    # ── PENSION & RETIREMENT ─────────────────────────────────────────────
    {
        "id": "state_pension",
        "label": "State Pension",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "pension_retirement",
    },
    {
        "id": "pension_credit",
        "label": "Pension Credit",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "pension_retirement",
        "children": [
            {"id": "guarantee_credit", "label": "Guarantee Credit", "entity": BENUNIT_VARS},
            {"id": "savings_credit", "label": "Savings Credit", "entity": BENUNIT_VARS},
        ],
    },
    {
        "id": "winter_fuel_allowance",
        "label": "Winter Fuel Allowance",
        "entity": HOUSEHOLD_VARS,
        "is_tax": False,
        "group": "pension_retirement",
    },
    # ── DISABILITY & CARER BENEFITS ──────────────────────────────────────
    {
        "id": "pip",
        "label": "Personal Independence Payment",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "disability_carer",
        "children": [
            {"id": "pip_dl", "label": "Daily Living", "entity": PERSON_VARS},
            {"id": "pip_m", "label": "Mobility", "entity": PERSON_VARS},
        ],
    },
    {
        "id": "dla",
        "label": "Disability Living Allowance",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "disability_carer",
        "children": [
            {"id": "dla_sc", "label": "Self-Care", "entity": PERSON_VARS},
            {"id": "dla_m", "label": "Mobility", "entity": PERSON_VARS},
        ],
    },
    {
        "id": "attendance_allowance",
        "label": "Attendance Allowance",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "disability_carer",
    },
    {
        "id": "carers_allowance",
        "label": "Carer's Allowance",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "disability_carer",
    },
    # ── EMPLOYMENT SUPPORT ───────────────────────────────────────────────
    {
        "id": "esa_income",
        "label": "ESA (Income-Related)",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "esa_contrib",
        "label": "ESA (Contributory)",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "jsa_income",
        "label": "JSA (Income-Based)",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "jsa_contrib",
        "label": "JSA (Contributory)",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "income_support",
        "label": "Income Support",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "statutory_sick_pay",
        "label": "Statutory Sick Pay",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    {
        "id": "statutory_maternity_pay",
        "label": "Statutory Maternity Pay",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "employment_support",
    },
    # ── CHILDCARE ────────────────────────────────────────────────────────
    {
        "id": "tax_free_childcare",
        "label": "Tax-Free Childcare",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "childcare",
    },
    {
        "id": "universal_childcare_entitlement",
        "label": "Universal Childcare Entitlement",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "childcare",
    },
    {
        "id": "extended_childcare_entitlement",
        "label": "Extended Childcare Entitlement",
        "entity": BENUNIT_VARS,
        "is_tax": False,
        "group": "childcare",
    },
    {
        "id": "targeted_childcare_entitlement",
        "label": "Targeted Childcare Entitlement",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "childcare",
    },
    # ── SCOTTISH BENEFITS ────────────────────────────────────────────────
    {
        "id": "scottish_child_payment",
        "label": "Scottish Child Payment",
        "entity": PERSON_VARS,
        "is_tax": False,
        "group": "scottish_benefits",
        "region": "SCOTLAND",
    },
]


def _all_variable_ids():
    """Get flat list of all variable IDs including children."""
    ids = []
    for prog in PROGRAM_STRUCTURE:
        ids.append(prog["id"])
        for child in prog.get("children", []):
            ids.append(child["id"])
    return ids


ALL_VARIABLE_IDS = _all_variable_ids()


def _get_autumn_cpi(sim: Simulation) -> dict:
    """Read baseline CPI YoY growth values from PE UK's parameter tree."""
    param = sim.tax_benefit_system.parameters.gov.economic_assumptions.yoy_growth.obr.consumer_price_index
    return {year: float(param(f"{year}-01-01")) for year in CPI_YEARS}


def _build_situation(
    employment_income: float,
    num_children: int,
    monthly_rent: float,
    is_couple: bool,
    partner_income: float,
    year: int,
    adult_age: int = 30,
    partner_age: int = 30,
    children_ages: list = None,
    region: str = "LONDON",
    council_tax_band: str = "D",
    tenure_type: str = "RENT_PRIVATELY",
    childcare_expenses: float = 0,
    student_loan_plan: str = "NO_STUDENT_LOAN",
) -> dict:
    """Build a PolicyEngine household situation dict."""
    people = {
        "adult": {
            "age": {year: adult_age},
            "employment_income": {year: employment_income},
        }
    }
    members = ["adult"]

    if student_loan_plan != "NO_STUDENT_LOAN":
        people["adult"]["student_loan_plan"] = {year: student_loan_plan}

    if is_couple:
        people["partner"] = {
            "age": {year: partner_age},
            "employment_income": {year: partner_income},
        }
        members.append("partner")

    # Use provided children_ages or default to evenly spaced ages
    if children_ages is None:
        children_ages = [5 + i * 2 for i in range(num_children)]
    for i in range(num_children):
        child_id = f"child_{i + 1}"
        age = children_ages[i] if i < len(children_ages) else 5 + i * 2
        people[child_id] = {
            "age": {year: age},
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

    if childcare_expenses > 0:
        # Assign childcare expenses to the first child
        first_child = next(
            (m for m in members if m.startswith("child_")), None
        )
        if first_child:
            people[first_child]["childcare_expenses"] = {year: childcare_expenses * 12}

    return situation


def _extract_results(sim: Simulation, situation: dict, year: int) -> dict:
    """Extract all tax/benefit values from a completed simulation."""
    num_people = len(situation["people"])
    results = {}

    def _person_sum(variable: str) -> float:
        raw = sim.calculate(variable, year)
        return float(raw.sum()) if num_people > 1 else float(raw[0])

    def _benunit_val(variable: str) -> float:
        return float(sim.calculate(variable, year)[0])

    def _household_val(variable: str) -> float:
        return float(sim.calculate(variable, year)[0])

    # Build entity lookup from PROGRAM_STRUCTURE
    entity_map = {}
    for prog in PROGRAM_STRUCTURE:
        entity_map[prog["id"]] = prog["entity"]
        for child in prog.get("children", []):
            entity_map[child["id"]] = child["entity"]

    for var_id in ALL_VARIABLE_IDS:
        entity = entity_map[var_id]
        try:
            if entity == PERSON_VARS:
                results[var_id] = round(_person_sum(var_id), 2)
            elif entity == BENUNIT_VARS:
                results[var_id] = round(_benunit_val(var_id), 2)
            else:
                results[var_id] = round(_household_val(var_id), 2)
        except Exception:
            results[var_id] = 0.0

    results["household_net_income"] = round(_household_val("household_net_income"), 2)

    return results


def calculate_household_impact(
    employment_income: float,
    num_children: int,
    monthly_rent: float,
    is_couple: bool,
    partner_income: float,
    year: int = 2026,
    adult_age: int = 30,
    partner_age: int = 30,
    children_ages: list = None,
    region: str = "LONDON",
    council_tax_band: str = "D",
    tenure_type: str = "RENT_PRIVATELY",
    childcare_expenses: float = 0,
    student_loan_plan: str = "NO_STUDENT_LOAN",
    spring_cpi: dict = None,
) -> dict:
    """Calculate the impact of Spring Statement policy changes on a household.

    Runs two PolicyEngine simulations:
    - Baseline: current law (Autumn Budget)
    - Reform: Spring Statement policy changes

    Returns per-program values and diffs, with hierarchical breakdown.
    """
    situation = _build_situation(
        employment_income=employment_income,
        num_children=num_children,
        monthly_rent=monthly_rent,
        is_couple=is_couple,
        partner_income=partner_income,
        year=year,
        adult_age=adult_age,
        partner_age=partner_age,
        children_ages=children_ages,
        region=region,
        council_tax_band=council_tax_band,
        tenure_type=tenure_type,
        childcare_expenses=childcare_expenses,
        student_loan_plan=student_loan_plan,
    )

    # Baseline simulation — PolicyEngine defaults reflect Autumn Budget parameters
    baseline_sim = Simulation(situation=situation)
    baseline = _extract_results(baseline_sim, situation, year)

    # Read baseline CPI values from PE UK's parameter tree (instead of hardcoding)
    autumn_cpi = _get_autumn_cpi(baseline_sim)

    # Reform simulation — override CPI YoY growth rates with Spring values.
    reform_cpi = spring_cpi if spring_cpi is not None else SPRING_CPI
    parameter_changes = {
        CPI_PARAMETER: {
            f"{yr}-01-01": rate for yr, rate in reform_cpi.items()
        }
    }
    scenario = Scenario(parameter_changes=parameter_changes)
    reform_sim = Simulation(situation=situation, scenario=scenario)
    reform = _extract_results(reform_sim, situation, year)

    # Compute impact for all variables
    impact = {}
    for var_id in ALL_VARIABLE_IDS:
        impact[var_id] = round(reform[var_id] - baseline[var_id], 2)
    impact["household_net_income"] = round(
        reform["household_net_income"] - baseline["household_net_income"], 2
    )

    # Build full program structure, filtering by region where applicable.
    active_structure = []
    for prog in PROGRAM_STRUCTURE:
        prog_region = prog.get("region")
        if prog_region and prog_region != region:
            continue
        pid = prog["id"]
        entry = {
            "id": pid,
            "label": prog["label"],
            "is_tax": prog.get("is_tax", False),
            "group": prog["group"],
        }
        children = prog.get("children", [])
        if children:
            entry["children"] = [
                {"id": child["id"], "label": child["label"]}
                for child in children
            ]
        active_structure.append(entry)

    return {
        "baseline": baseline,
        "reform": reform,
        "impact": impact,
        "program_structure": active_structure,
        "program_groups": PROGRAM_GROUPS,
        "cpi_values": {
            "autumn": autumn_cpi,
            "spring": reform_cpi,
        },
    }


def calculate_multi_year_net_impact(
    employment_income: float,
    num_children: int,
    monthly_rent: float,
    is_couple: bool,
    partner_income: float,
    adult_age: int = 30,
    partner_age: int = 30,
    children_ages: list = None,
    region: str = "LONDON",
    council_tax_band: str = "D",
    tenure_type: str = "RENT_PRIVATELY",
    childcare_expenses: float = 0,
    student_loan_plan: str = "NO_STUDENT_LOAN",
    spring_cpi: dict = None,
) -> dict:
    """Calculate net household income impact for each year 2026-2030.

    Much lighter than calling calculate_household_impact() 5x because it only
    extracts household_net_income rather than all 35+ program variables.
    """
    reform_cpi = spring_cpi if spring_cpi is not None else SPRING_CPI
    yearly_impact = {}
    yearly_breakdown = {}

    # Top-level programs only (no children) for lightweight extraction
    top_programs = [
        {
            "id": p["id"],
            "label": p["label"],
            "entity": p["entity"],
            "is_tax": p.get("is_tax", False),
        }
        for p in PROGRAM_STRUCTURE
        if not (p.get("region") and p["region"] != region)
    ]

    for year in range(2026, 2031):
        situation = _build_situation(
            employment_income=employment_income,
            num_children=num_children,
            monthly_rent=monthly_rent,
            is_couple=is_couple,
            partner_income=partner_income,
            year=year,
            adult_age=adult_age,
            partner_age=partner_age,
            children_ages=children_ages,
            region=region,
            council_tax_band=council_tax_band,
            tenure_type=tenure_type,
            childcare_expenses=childcare_expenses,
            student_loan_plan=student_loan_plan,
        )

        num_people = len(situation["people"])

        def _calc(sim, var_id, entity):
            try:
                if entity == PERSON_VARS:
                    raw = sim.calculate(var_id, year)
                    return float(raw.sum()) if num_people > 1 else float(raw[0])
                else:
                    return float(sim.calculate(var_id, year)[0])
            except Exception:
                return 0.0

        # Baseline simulation (Autumn Budget defaults)
        baseline_sim = Simulation(situation=situation)
        baseline_net = float(baseline_sim.calculate("household_net_income", year)[0])

        # Reform simulation (Spring Statement CPI overrides)
        parameter_changes = {
            CPI_PARAMETER: {
                f"{yr}-01-01": rate for yr, rate in reform_cpi.items()
            }
        }
        scenario = Scenario(parameter_changes=parameter_changes)
        reform_sim = Simulation(situation=situation, scenario=scenario)
        reform_net = float(reform_sim.calculate("household_net_income", year)[0])

        yearly_impact[str(year)] = round(reform_net - baseline_net, 2)

        # Per-program breakdown (only non-zero diffs)
        breakdown = []
        for prog in top_programs:
            b_val = _calc(baseline_sim, prog["id"], prog["entity"])
            r_val = _calc(reform_sim, prog["id"], prog["entity"])
            diff = r_val - b_val
            if abs(diff) > 0.005:
                household_impact = -diff if prog["is_tax"] else diff
                breakdown.append({
                    "label": prog["label"],
                    "impact": round(household_impact, 2),
                })
        yearly_breakdown[str(year)] = breakdown

    return {"yearly_impact": yearly_impact, "yearly_breakdown": yearly_breakdown}
