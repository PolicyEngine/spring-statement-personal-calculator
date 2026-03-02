import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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

// Programs where positive diff = bad for household (taxes/costs)
const TAX_PROGRAMS = ["income_tax", "national_insurance", "council_tax"];

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

function formatChange(value, program) {
  // For taxes: increase in tax = negative for household
  // For benefits: increase = positive for household
  const isTax = TAX_PROGRAMS.includes(program);
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
  const [draftRent, setDraftRent] = useState(800);
  const [draftIsCouple, setDraftIsCouple] = useState(false);
  const [draftPartnerIncome, setDraftPartnerIncome] = useState(0);
  const [draftRegion, setDraftRegion] = useState("LONDON");
  const [draftCouncilTaxBand, setDraftCouncilTaxBand] = useState("D");
  const [draftTenureType, setDraftTenureType] = useState("RENT_PRIVATELY");
  const [moreDetailsExpanded, setMoreDetailsExpanded] = useState(false);

  // API state
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  // Chart ref
  const chartRef = useRef(null);

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/spring-statement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employment_income: draftIncome,
          num_children: draftChildren,
          monthly_rent: draftRent,
          is_couple: draftIsCouple,
          partner_income: draftPartnerIncome,
          region: draftRegion,
          council_tax_band: draftCouncilTaxBand,
          tenure_type: draftTenureType,
          year: 2026,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(
          errData?.detail || `Server error (${response.status})`
        );
      }

      const data = await response.json();
      setResult(data);
      setHasCalculated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [
    draftIncome,
    draftChildren,
    draftRent,
    draftIsCouple,
    draftPartnerIncome,
    draftRegion,
    draftCouncilTaxBand,
    draftTenureType,
  ]);

  // Chart data derived from result
  const chartData = useMemo(() => {
    if (!result) return [];
    const programs = [
      "income_tax",
      "national_insurance",
      "universal_credit",
      "child_benefit",
      "state_pension",
      "council_tax",
    ];
    const labels = result.program_labels || {};

    return programs
      .map((prog) => {
        const diff = result.impact[prog] || 0;
        // Convert to household perspective:
        // For taxes, negative diff = household saves money = positive impact
        const isTax = TAX_PROGRAMS.includes(prog);
        const householdImpact = isTax ? -diff : diff;
        return {
          program: prog,
          label: labels[prog] || prog,
          rawDiff: diff,
          householdImpact,
        };
      })
      .filter((d) => Math.abs(d.rawDiff) > 0.005);
  }, [result]);

  // D3 bar chart
  useEffect(() => {
    if (!chartRef.current || chartData.length === 0) return;

    const container = chartRef.current;
    const containerWidth = container.clientWidth;
    const margin = { top: 20, right: 80, bottom: 20, left: 140 };
    const width = containerWidth - margin.left - margin.right;
    const barHeight = 40;
    const barGap = 12;
    const height = chartData.length * (barHeight + barGap) - barGap;

    // Clear previous
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
    const maxAbs = d3.max(chartData, (d) => Math.abs(d.householdImpact)) || 10;
    const xExtent = Math.max(maxAbs * 1.3, 5);

    const x = d3.scaleLinear().domain([-xExtent, xExtent]).range([0, width]);

    const y = d3
      .scaleBand()
      .domain(chartData.map((d) => d.label))
      .range([0, height])
      .padding(barGap / (barHeight + barGap));

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisBottom(x)
          .ticks(5)
          .tickSize(height)
          .tickFormat("")
      )
      .attr("transform", `translate(0,0)`);

    // Zero line
    g.append("line")
      .attr("x1", x(0))
      .attr("x2", x(0))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1);

    // Tooltip
    const tooltip = d3
      .select(container)
      .append("div")
      .attr("class", "bar-tooltip");

    // Bars
    g.selectAll(".impact-bar")
      .data(chartData)
      .join("rect")
      .attr("class", "impact-bar")
      .attr("y", (d) => y(d.label))
      .attr("height", y.bandwidth())
      .attr("x", (d) => (d.householdImpact >= 0 ? x(0) : x(d.householdImpact)))
      .attr("width", (d) => Math.abs(x(d.householdImpact) - x(0)))
      .attr("rx", 4)
      .attr("fill", (d) =>
        d.householdImpact >= 0 ? COLORS.positive : COLORS.negative
      )
      .attr("opacity", 0.85)
      .on("mouseenter", (event, d) => {
        const sign = d.householdImpact >= 0 ? "+" : "−";
        const absVal = Math.abs(d.householdImpact);
        tooltip
          .style("opacity", 1)
          .html(
            `<div class="tooltip-label">${d.label}</div>` +
              `<div class="tooltip-value" style="color: ${d.householdImpact >= 0 ? COLORS.positive : COLORS.negative}">${sign}£${absVal.toFixed(2)}/year</div>`
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

    // Labels on bars
    g.selectAll(".bar-label")
      .data(chartData)
      .join("text")
      .attr("class", "bar-label")
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("x", (d) => {
        const barEnd =
          d.householdImpact >= 0 ? x(d.householdImpact) : x(d.householdImpact);
        return d.householdImpact >= 0 ? barEnd + 8 : barEnd - 8;
      })
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) =>
        d.householdImpact >= 0 ? "start" : "end"
      )
      .attr("fill", (d) =>
        d.householdImpact >= 0 ? COLORS.positive : COLORS.negative
      )
      .attr("font-size", "13px")
      .attr("font-weight", "600")
      .text((d) => {
        const sign = d.householdImpact >= 0 ? "+" : "−";
        return `${sign}£${Math.abs(d.householdImpact).toFixed(0)}`;
      });

    // Y axis (program labels)
    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).tickSize(0))
      .select(".domain")
      .remove();

    g.selectAll(".axis text")
      .attr("font-size", "13px")
      .attr("font-weight", "500")
      .attr("fill", "#475569");
  }, [chartData]);

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
          <div className="controls-group-label">Income & Housing</div>
          <div className="controls-row controls-row-3">
            <div className="control-item">
              <label>Employment Income</label>
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
          </div>
        </div>

        <div className="controls-group">
          <div className="controls-group-label">Partnership</div>
          <div className="controls-row controls-row-2">
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
              <div className="control-item">
                <label>Partner Income</label>
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
            )}
          </div>
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
            <div className="controls-row controls-row-3" style={{ padding: "0 28px 20px" }}>
              <div className="control-item">
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
              <div className="control-item">
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
              <div className="control-item">
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
                  {[
                    "income_tax",
                    "national_insurance",
                    "universal_credit",
                    "child_benefit",
                    "state_pension",
                    "council_tax",
                  ].map((prog) => {
                    const label =
                      result.program_labels?.[prog] || prog;
                    const baseline = result.baseline[prog] || 0;
                    const reform = result.reform[prog] || 0;
                    const diff = result.impact[prog] || 0;
                    const { text: changeText, className: changeClass } =
                      formatChange(diff, prog);
                    return (
                      <tr key={prog}>
                        <td>{label}</td>
                        <td>
                          £
                          {baseline.toLocaleString("en-GB", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td>
                          £
                          {reform.toLocaleString("en-GB", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className={changeClass}>{changeText}</td>
                      </tr>
                    );
                  })}
                  <tr className="total-row">
                    <td>Net Household Income</td>
                    <td>
                      £
                      {(result.baseline.household_net_income || 0).toLocaleString(
                        "en-GB",
                        {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }
                      )}
                    </td>
                    <td>
                      £
                      {(result.reform.household_net_income || 0).toLocaleString(
                        "en-GB",
                        {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }
                      )}
                    </td>
                    <td
                      className={
                        netImpact > 0.5
                          ? "impact-positive"
                          : netImpact < -0.5
                            ? "impact-negative"
                            : "impact-neutral"
                      }
                    >
                      {formatCurrency(netImpact)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Bar Chart */}
          {chartData.length > 0 && (
            <section className="narrative-section">
              <h2>Impact by Program</h2>
              <p>
                Household perspective: green bars mean you're better off, red
                bars mean you're worse off under the Spring Statement.
              </p>
              <div className="impact-bar-chart" ref={chartRef} />
            </section>
          )}

          {/* Methodology */}
          <footer className="narrative-footer">
            <h3>Methodology</h3>
            <p>
              This calculator uses{" "}
              <a
                href="https://policyengine.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                PolicyEngine UK
              </a>{" "}
              to run two microsimulations of the UK tax-benefit system. The
              baseline reflects the Autumn Budget, and the reform applies
              Spring Statement policy changes. The difference shows how the
              Spring Statement affects your taxes, benefits, and net income.
            </p>
            <p>
              Results are annual amounts for the 2026-27 tax year. All
              calculations assume a working-age household in London.
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
