import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as d3 from "d3";
import "./SpringStatementCalculator.css";

const API_URL = import.meta.env.VITE_API_URL || "https://policyengine--spring-statement-calculator-api-fastapi-app.modal.run";

const COLORS = {
  positive: "#059669", // Green — household gains
  negative: "#dc2626", // Red — household loses
  teal: "#319795",
  tealDark: "#2c7a7b",
  text: "#1e293b",
  textSecondary: "#475569",
  border: "#e2e8f0",
};


function formatCurrency(value) {
  const absVal = Math.abs(value);
  const formatted =
    absVal >= 1
      ? `£${absVal.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : `£${absVal.toFixed(2)}`;
  if (value < -0.005) return `−${formatted}`;
  if (value > 0.005) return `+${formatted}`;
  return formatted;
}

function formatChange(value, program, taxPrograms) {
  // For taxes: increase in tax = negative for household
  // For benefits: increase = positive for household
  const isTax = taxPrograms.includes(program);
  const householdImpact = isTax ? -value : value;

  const absVal = Math.abs(value);
  const formatted =
    absVal >= 1
      ? `£${absVal.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : `£${absVal.toFixed(2)}`;

  let prefix = "";
  let className = "impact-neutral";

  if (value > 0.005) {
    prefix = "+";
  } else if (value < -0.005) {
    prefix = "−";
  }

  if (householdImpact > 0.5) className = "impact-positive";
  else if (householdImpact < -0.5) className = "impact-negative";

  return { text: `${prefix}${formatted}`, className };
}

export default function SpringStatementCalculator() {
  // Draft state (form controls)
  const [draftIncome, setDraftIncome] = useState(30000);
  const [draftChildren, setDraftChildren] = useState(0);
  const [draftChildrenAges, setDraftChildrenAges] = useState([]);
  const [draftRent, setDraftRent] = useState(800);
  const [draftIsCouple, setDraftIsCouple] = useState(true);
  const [draftPartnerIncome, setDraftPartnerIncome] = useState(0);
  const [draftAdultAge, setDraftAdultAge] = useState(30);
  const [draftPartnerAge, setDraftPartnerAge] = useState(30);
  const [draftYear, setDraftYear] = useState(2026);
  const [draftRegion, setDraftRegion] = useState("LONDON");
  const [draftCouncilTaxBand, setDraftCouncilTaxBand] = useState("D");
  const [draftTenureType, setDraftTenureType] = useState("RENT_PRIVATELY");
  const [draftChildcare, setDraftChildcare] = useState(0);
  const [draftStudentLoan, setDraftStudentLoan] = useState("NO_STUDENT_LOAN");
  const [moreDetailsExpanded, setMoreDetailsExpanded] = useState(false);
  const [expandedPrograms, setExpandedPrograms] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});

  // Keep children ages array in sync with num_children
  useEffect(() => {
    setDraftChildrenAges((prev) => {
      if (draftChildren === 0) return [];
      if (prev.length === draftChildren) return prev;
      const next = [...prev];
      while (next.length < draftChildren) next.push(5);
      return next.slice(0, draftChildren);
    });
  }, [draftChildren]);

  // API state
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  // Multi-year state
  const [multiYearData, setMultiYearData] = useState(null);
  const [multiYearLoading, setMultiYearLoading] = useState(false);

  // Chart ref
  const multiYearChartRef = useRef(null);

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMultiYearData(null);
    setMultiYearLoading(true);

    const requestBody = {
      employment_income: draftIncome,
      num_children: draftChildren,
      children_ages: draftChildrenAges.length > 0 ? draftChildrenAges : null,
      monthly_rent: draftRent,
      is_couple: draftIsCouple,
      partner_income: draftPartnerIncome,
      adult_age: draftAdultAge,
      partner_age: draftPartnerAge,
      region: draftRegion,
      council_tax_band: draftCouncilTaxBand,
      tenure_type: draftTenureType,
      childcare_expenses: draftChildcare,
      student_loan_plan: draftStudentLoan,
      year: draftYear,
    };

    // Fire main and multi-year requests in parallel
    const mainPromise = fetch(`${API_URL}/spring-statement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const multiYearPromise = fetch(`${API_URL}/spring-statement/multi-year`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    // Handle main request
    try {
      const response = await mainPromise;

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(
          errData?.detail || `Server error (${response.status})`
        );
      }

      const data = await response.json();
      setResult(data);
      setHasCalculated(true);

      // Auto-expand groups that have non-zero change, collapse others
      const groups = data.program_groups || [];
      const progs = data.program_structure || [];
      const autoExpanded = {};
      for (const g of groups) {
        const hasChange = progs
          .filter((p) => p.group === g.id)
          .some((p) => Math.abs(data.impact[p.id] || 0) >= 0.01);
        autoExpanded[g.id] = hasChange;
      }
      setExpandedGroups(autoExpanded);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }

    // Handle multi-year request independently
    try {
      const multiYearResponse = await multiYearPromise;
      if (multiYearResponse.ok) {
        const multiYearResult = await multiYearResponse.json();
        setMultiYearData(multiYearResult);
      }
    } catch {
      // Multi-year failure is non-critical; silently ignore
    } finally {
      setMultiYearLoading(false);
    }
  }, [
    draftIncome,
    draftChildren,
    draftChildrenAges,
    draftRent,
    draftIsCouple,
    draftPartnerIncome,
    draftAdultAge,
    draftPartnerAge,
    draftYear,
    draftRegion,
    draftCouncilTaxBand,
    draftTenureType,
    draftChildcare,
    draftStudentLoan,
  ]);

  // Program structure and groups from API response
  const programStructure = result?.program_structure || [];
  const programGroups = result?.program_groups || [];

  // Multi-year bar chart data
  const multiYearChartData = useMemo(() => {
    if (!multiYearData?.yearly_impact) return [];
    const breakdown = multiYearData.yearly_breakdown || {};
    return Object.entries(multiYearData.yearly_impact)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, impact]) => ({
        year,
        label: `${year}-${String(Number(year) + 1).slice(-2)}`,
        impact,
        breakdown: breakdown[year] || [],
      }));
  }, [multiYearData]);

  // D3 multi-year vertical bar chart
  useEffect(() => {
    if (!multiYearChartRef.current || multiYearChartData.length === 0) return;

    const container = multiYearChartRef.current;
    const containerWidth = container.clientWidth;
    const margin = { top: 24, right: 20, bottom: 40, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = 280;

    d3.select(container).selectAll("*").remove();

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3
      .scaleBand()
      .domain(multiYearChartData.map((d) => d.label))
      .range([0, width])
      .padding(0.35);

    const maxAbs = d3.max(multiYearChartData, (d) => Math.abs(d.impact)) || 10;
    const yExtent = maxAbs * 1.35;

    const y = d3
      .scaleLinear()
      .domain([-yExtent, yExtent])
      .range([height, 0]);

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-width)
          .tickFormat("")
      );

    // Zero line
    g.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1);

    // Tooltip
    const tooltip = d3
      .select(container)
      .append("div")
      .attr("class", "bar-tooltip");

    // Bars
    g.selectAll(".multi-year-bar")
      .data(multiYearChartData)
      .join("rect")
      .attr("class", "multi-year-bar")
      .attr("x", (d) => x(d.label))
      .attr("width", x.bandwidth())
      .attr("y", (d) => (d.impact >= 0 ? y(d.impact) : y(0)))
      .attr("height", (d) => Math.abs(y(d.impact) - y(0)))
      .attr("rx", 4)
      .attr("fill", (d) =>
        d.impact >= 0 ? COLORS.positive : COLORS.negative
      )
      .attr("opacity", 0.85)
      .on("mouseenter", (event, d) => {
        const sign = d.impact >= 0 ? "+" : "\u2212";
        const absVal = Math.abs(d.impact);
        let breakdownHtml = "";
        if (d.breakdown && d.breakdown.length > 0) {
          const rows = d.breakdown
            .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
            .map((p) => {
              const pSign = p.impact >= 0 ? "+" : "\u2212";
              const pColor = p.impact >= 0 ? COLORS.positive : COLORS.negative;
              return `<div class="tooltip-breakdown-row"><span class="tooltip-breakdown-label">${p.label}</span><span style="color:${pColor};font-weight:600">${pSign}£${Math.abs(p.impact).toFixed(2)}</span></div>`;
            })
            .join("");
          breakdownHtml = `<div class="tooltip-breakdown">${rows}</div>`;
        }
        tooltip
          .style("opacity", 1)
          .html(
            `<div class="tooltip-label">${d.label}</div>` +
              `<div class="tooltip-value" style="color: ${d.impact >= 0 ? COLORS.positive : COLORS.negative}">${sign}£${absVal.toFixed(2)}/year</div>` +
              breakdownHtml
          );
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", event.clientX + 12 + "px")
          .style("top", event.clientY - 10 + "px");
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });

    // Value labels on bars
    g.selectAll(".multi-year-label")
      .data(multiYearChartData)
      .join("text")
      .attr("class", "multi-year-label")
      .attr("x", (d) => x(d.label) + x.bandwidth() / 2)
      .attr("y", (d) => (d.impact >= 0 ? y(d.impact) - 8 : y(d.impact) + 18))
      .attr("text-anchor", "middle")
      .attr("fill", (d) =>
        d.impact >= 0 ? COLORS.positive : COLORS.negative
      )
      .attr("font-size", "13px")
      .attr("font-weight", "600")
      .text((d) => {
        const sign = d.impact >= 0 ? "+" : "\u2212";
        return `${sign}£${Math.abs(d.impact).toFixed(0)}`;
      });

    // X axis (year labels)
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0))
      .select(".domain")
      .remove();

    g.selectAll(".axis text")
      .attr("font-size", "13px")
      .attr("font-weight", "500")
      .attr("fill", "#475569")
      .attr("dy", "1em");

    // Y axis (£ labels)
    g.append("g")
      .attr("class", "axis axis-y")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => `£${d}`)
      )
      .select(".domain")
      .remove();

    g.selectAll(".axis-y text")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("fill", "#475569");
  }, [multiYearChartData]);

  const netImpact = result?.impact?.household_net_income || 0;

  return (
    <div className="narrative-container">
      <header className="narrative-hero">
        <h1>Spring Statement Personal Calculator</h1>
        <p className="narrative-lead">
          See how the <strong>Spring Statement</strong> policy changes affect
          your household's taxes and benefits compared to the Autumn Budget
          baseline.
        </p>
      </header>

      <p className="narrative-about">
        The Spring Statement updated OBR inflation forecasts, which changes how
        benefits and tax thresholds are uprated. This calculator uses{" "}
        <a href="https://policyengine.org" target="_blank" rel="noopener noreferrer">
          PolicyEngine UK
        </a>{" "}
        to simulate the difference between the Autumn Budget baseline and the
        Spring Statement reforms on your household's taxes, benefits, and net
        income. Results are annual amounts for the selected tax year.
      </p>

      {/* Controls */}
      <div className="controls-panel">
        <div className="controls-panel-header">
          <h2 className="controls-panel-title">Your Household</h2>
          <button
            className="calculate-button"
            onClick={handleCalculate}
            disabled={loading}
          >
            {loading ? "Calculating…" : "Calculate"}
            {!loading && <span className="calculate-arrow">→</span>}
          </button>
        </div>

        <div className="controls-group">
          <div className="controls-row controls-row-6">
            <div className="control-item control-span-2">
              <label>Your Income</label>
              <div className="salary-input-wrapper">
                <span className="currency-symbol">£</span>
                <input
                  type="number"
                  value={draftIncome}
                  onChange={(e) =>
                    setDraftIncome(parseFloat(e.target.value) || 0)
                  }
                  min={0}
                  step={1000}
                />
              </div>
            </div>
            <div className="control-item">
              <label>Your Age</label>
              <input
                type="number"
                value={draftAdultAge}
                onChange={(e) =>
                  setDraftAdultAge(parseInt(e.target.value) || 30)
                }
                min={16}
                max={100}
                className="age-input"
              />
            </div>
            <div className="control-item">
              <label>Monthly Rent</label>
              <div className="salary-input-wrapper">
                <span className="currency-symbol">£</span>
                <input
                  type="number"
                  value={draftRent}
                  onChange={(e) =>
                    setDraftRent(parseFloat(e.target.value) || 0)
                  }
                  min={0}
                  step={50}
                />
              </div>
            </div>
            <div className="control-item">
              <label>Children</label>
              <select
                value={draftChildren}
                onChange={(e) => setDraftChildren(parseInt(e.target.value))}
              >
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="control-item">
              <label>Tax Year</label>
              <select
                value={draftYear}
                onChange={(e) => setDraftYear(parseInt(e.target.value))}
              >
                {[2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                  <option key={y} value={y}>
                    {y}-{String(y + 1).slice(-2)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Second row: couple + children ages (only if applicable) */}
          {(draftIsCouple || draftChildren > 0) && (
            <div className="controls-row controls-row-6 controls-row-secondary">
              <div className="control-item">
                <label>Couple</label>
                <button
                  type="button"
                  className={`switch ${draftIsCouple ? "switch-on" : ""}`}
                  onClick={() => setDraftIsCouple(!draftIsCouple)}
                  role="switch"
                  aria-checked={draftIsCouple}
                >
                  <span className="switch-thumb" />
                  <span className="switch-label">{draftIsCouple ? "Yes" : "No"}</span>
                </button>
              </div>
              {draftIsCouple && (
                <>
                  <div className="control-item control-span-2">
                    <label>Partner's Income</label>
                    <div className="salary-input-wrapper">
                      <span className="currency-symbol">£</span>
                      <input
                        type="number"
                        value={draftPartnerIncome}
                        onChange={(e) =>
                          setDraftPartnerIncome(parseFloat(e.target.value) || 0)
                        }
                        min={0}
                        step={1000}
                      />
                    </div>
                  </div>
                  <div className="control-item">
                    <label>Partner's Age</label>
                    <input
                      type="number"
                      value={draftPartnerAge}
                      onChange={(e) =>
                        setDraftPartnerAge(parseInt(e.target.value) || 30)
                      }
                      min={16}
                      max={100}
                      className="age-input"
                    />
                  </div>
                </>
              )}
              {draftChildrenAges.map((age, i) => (
                <div className="control-item" key={i}>
                  <label>Child {i + 1} Age</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setDraftChildrenAges((prev) => {
                        const next = [...prev];
                        next[i] = Math.min(Math.max(val, 0), 18);
                        return next;
                      });
                    }}
                    min={0}
                    max={18}
                    className="age-input"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Couple toggle when no children and not yet a couple */}
          {!draftIsCouple && draftChildren === 0 && (
            <div className="controls-row controls-row-6 controls-row-secondary">
              <div className="control-item">
                <label>Couple</label>
                <button
                  type="button"
                  className={`switch ${draftIsCouple ? "switch-on" : ""}`}
                  onClick={() => setDraftIsCouple(!draftIsCouple)}
                  role="switch"
                  aria-checked={draftIsCouple}
                >
                  <span className="switch-thumb" />
                  <span className="switch-label">{draftIsCouple ? "Yes" : "No"}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible household details section */}
        <div className="controls-group controls-group-expandable">
          <button
            className="cpi-expand-button"
            onClick={() => setMoreDetailsExpanded(!moreDetailsExpanded)}
          >
            <div className="controls-group-label">More Household Details</div>
            <span className={`expand-chevron ${moreDetailsExpanded ? "expanded" : ""}`}>
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </button>
          {moreDetailsExpanded && (
            <div style={{ padding: "0 28px 20px" }}>
              <div className="controls-row controls-row-6" style={{ marginBottom: 14 }}>
                <div className="control-item control-span-2">
                  <label>Monthly Childcare</label>
                  <div className="salary-input-wrapper">
                    <span className="currency-symbol">£</span>
                    <input
                      type="number"
                      value={draftChildcare}
                      onChange={(e) => setDraftChildcare(parseFloat(e.target.value) || 0)}
                      min={0}
                      step={50}
                    />
                  </div>
                </div>
                <div className="control-item control-span-2">
                  <label>Student Loan</label>
                  <select
                    value={draftStudentLoan}
                    onChange={(e) => setDraftStudentLoan(e.target.value)}
                  >
                    <option value="NO_STUDENT_LOAN">None</option>
                    <option value="PLAN_1">Plan 1</option>
                    <option value="PLAN_2">Plan 2</option>
                    <option value="PLAN_4">Plan 4 (Scotland)</option>
                    <option value="PLAN_5">Plan 5</option>
                    <option value="POSTGRADUATE">Postgraduate</option>
                  </select>
                </div>
                <div className="control-item control-span-2">
                  <label>Region</label>
                  <select
                    value={draftRegion}
                    onChange={(e) => setDraftRegion(e.target.value)}
                  >
                    <option value="NORTH_EAST">North East</option>
                    <option value="NORTH_WEST">North West</option>
                    <option value="YORKSHIRE">Yorkshire and the Humber</option>
                    <option value="EAST_MIDLANDS">East Midlands</option>
                    <option value="WEST_MIDLANDS">West Midlands</option>
                    <option value="EAST_OF_ENGLAND">East of England</option>
                    <option value="LONDON">London</option>
                    <option value="SOUTH_EAST">South East</option>
                    <option value="SOUTH_WEST">South West</option>
                    <option value="WALES">Wales</option>
                    <option value="SCOTLAND">Scotland</option>
                    <option value="NORTHERN_IRELAND">Northern Ireland</option>
                  </select>
                </div>
              </div>
              <div className="controls-row controls-row-6">
                <div className="control-item control-span-2">
                  <label>Council Tax Band</label>
                  <select
                    value={draftCouncilTaxBand}
                    onChange={(e) => setDraftCouncilTaxBand(e.target.value)}
                  >
                    {["A", "B", "C", "D", "E", "F", "G", "H"].map((band) => (
                      <option key={band} value={band}>
                        Band {band}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="control-item control-span-2">
                  <label>Tenure Type</label>
                  <select
                    value={draftTenureType}
                    onChange={(e) => setDraftTenureType(e.target.value)}
                  >
                    <option value="RENT_PRIVATELY">Rent (private)</option>
                    <option value="RENT_FROM_COUNCIL">Rent (council)</option>
                    <option value="RENT_FROM_HA">Rent (housing association)</option>
                    <option value="OWNED_WITH_MORTGAGE">Own (mortgage)</option>
                    <option value="OWNED_OUTRIGHT">Own (outright)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="api-loading">
          Running PolicyEngine simulations… this may take a moment.
        </div>
      )}
      {error && <div className="api-error">Error: {error}</div>}

      {/* Results */}
      {hasCalculated && result && !loading && (
        <>
          {/* Headline */}
          <div
            className={`impact-headline ${netImpact > 0.5 ? "positive" : netImpact < -0.5 ? "negative" : "neutral"}`}
          >
            <p>
              The Spring Statement changes would{" "}
              {netImpact > 0.5
                ? "increase"
                : netImpact < -0.5
                  ? "decrease"
                  : "not significantly change"}{" "}
              your household's annual net income by{" "}
              <span
                className={`impact-amount ${netImpact > 0.5 ? "positive" : netImpact < -0.5 ? "negative" : "neutral"}`}
              >
                {formatCurrency(netImpact)}
              </span>
            </p>
          </div>

          {/* Impact Table */}
          <section className="narrative-section">
            <h2>Breakdown by Program</h2>
            <div className="impact-table-container">
              <table className="impact-table">
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Autumn Baseline</th>
                    <th>Spring Forecast</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {programGroups.map((group) => {
                    const groupPrograms = programStructure.filter(
                      (p) => p.group === group.id
                    );
                    if (groupPrograms.length === 0) return null;
                    const isGroupExpanded = expandedGroups[group.id] ?? true;
                    return (
                      <React.Fragment key={group.id}>
                        <tr
                          className="group-header-row"
                          onClick={() => setExpandedGroups((prev) => ({
                            ...prev,
                            [group.id]: !prev[group.id],
                          }))}
                        >
                          <td colSpan={4}>
                            <span className={`group-chevron ${isGroupExpanded ? "expanded" : ""}`}>
                              <svg width="10" height="10" viewBox="0 0 10 10">
                                <path d="M3 2L7 5L3 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                            </span>
                            {group.label}
                          </td>
                        </tr>
                        {isGroupExpanded && groupPrograms.map((prog) => {
                          const baseline = result.baseline[prog.id] || 0;
                          const reform = result.reform[prog.id] || 0;
                          const diff = result.impact[prog.id] || 0;
                          const { text: changeText, className: changeClass } =
                            formatChange(diff, prog.id, prog.is_tax ? [prog.id] : []);
                          const hasChildren = prog.children && prog.children.length > 0;
                          const isZero = Math.abs(baseline) < 0.01 && Math.abs(reform) < 0.01;
                          const canExpand = hasChildren && !isZero;
                          const isExpanded = expandedPrograms[prog.id] && !isZero;

                          return (
                            <React.Fragment key={prog.id}>
                              <tr
                                className={canExpand ? "expandable-row" : ""}
                                onClick={canExpand ? () => setExpandedPrograms((prev) => ({
                                  ...prev,
                                  [prog.id]: !prev[prog.id],
                                })) : undefined}
                              >
                                <td>
                                  {hasChildren && (
                                    <span className={`row-chevron ${isExpanded ? "expanded" : ""} ${isZero ? "row-chevron-disabled" : ""}`}>
                                      <svg width="10" height="10" viewBox="0 0 10 10">
                                        <path d="M3 2L7 5L3 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                      </svg>
                                    </span>
                                  )}
                                  {prog.label}
                                </td>
                                <td>
                                  £{baseline.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </td>
                                <td>
                                  £{reform.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </td>
                                <td className={changeClass}>{changeText}</td>
                              </tr>
                              {isExpanded && prog.children?.map((child) => {
                                const cb = result.baseline[child.id] || 0;
                                const cr = result.reform[child.id] || 0;
                                const cd = result.impact[child.id] || 0;
                                const { text: cText, className: cClass } =
                                  formatChange(cd, child.id, prog.is_tax ? [child.id] : []);
                                return (
                                  <tr key={child.id} className="child-row">
                                    <td className="child-label">{child.label}</td>
                                    <td>
                                      £{cb.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </td>
                                    <td>
                                      £{cr.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </td>
                                    <td className={cClass}>{cText}</td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  <tr className="total-row">
                    <td>Net Household Income</td>
                    <td>
                      £{(result.baseline.household_net_income || 0).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td>
                      £{(result.reform.household_net_income || 0).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className={netImpact > 0.5 ? "impact-positive" : netImpact < -0.5 ? "impact-negative" : "impact-neutral"}>
                      {formatCurrency(netImpact)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Multi-Year Impact Chart */}
          {(multiYearLoading || multiYearChartData.length > 0) && (
            <section className="narrative-section">
              <h2>Impact Over Time</h2>
              <p>
                Net household income impact for each tax year as CPI forecasts
                diverge between the Autumn Budget and Spring Statement.
              </p>
              {multiYearLoading ? (
                <div className="multi-year-loading">
                  Loading multi-year projections…
                </div>
              ) : (
                <div className="impact-bar-chart multi-year-chart" ref={multiYearChartRef} />
              )}
            </section>
          )}

        </>
      )}
    </div>
  );
}
