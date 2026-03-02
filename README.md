# Spring Statement 2025 Personal Calculator

See how the Spring Statement policy changes affect your household's taxes and benefits compared to the Autumn Budget baseline.

**Live:** [spring-statement-calculator.vercel.app](https://spring-statement-calculator.vercel.app)

## How it works

The calculator runs two [PolicyEngine UK](https://policyengine.org) microsimulations:

1. **Baseline** — Autumn Budget parameters (current law)
2. **Reform** — Spring Statement policy changes

The difference shows the per-program impact on your household: income tax, National Insurance, Universal Credit, child benefit, state pension, and council tax.

## Architecture

| Layer | Stack | Host |
|-------|-------|------|
| Frontend | React + D3 + Vite | Vercel |
| Backend | FastAPI + PolicyEngine UK | Modal |

## Local development

**Backend:**

```bash
conda activate python313
python -m uvicorn src.uk_budget_data.api:app --port 5002 --reload
```

**Frontend:**

```bash
VITE_API_URL=http://localhost:5002 npm run dev
```

## Deployment

- **Vercel** auto-deploys on push to `main`
- **Modal** auto-deploys on push to `main` via GitHub Actions (requires `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` secrets)

Manual deploy:

```bash
modal deploy src/uk_budget_data/modal_app.py
```
