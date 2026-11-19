# DeFi Dashboard · Staking Rewards Calculator

Full-stack take-home: a **Staking Rewards Calculator** integrated into the existing demo dashboard, powered by a compound-interest API.

## Requirements

- Node.js **v18+**
- npm 8+

## Getting started

```bash
npm install
npm start
```

This runs:

| Process | URL |
| --- | --- |
| React client (CRA) | http://localhost:3000 |
| Express API | http://localhost:5025 |

Open **Dashboard** (`/dashboard`) — the calculator sits above the offers table.

Optional env overrides:

```bash
PORT=5025
REACT_APP_API_URL=http://localhost:5025
```

## API

### `POST /api/calculate-rewards`

**Request**

```json
{
  "principal": 1000,
  "apy": 5,
  "duration": 365,
  "durationUnit": "days",
  "compoundingFrequency": "daily",
  "tokenPrice": 1.25
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `principal` | yes | `> 0` and `<= 1e15` (overflow guard) |
| `apy` | yes | `0..1000` (percent). Zero APY allowed |
| `duration` | yes | `> 0` (fractions OK, e.g. `1.5`); max **100 years** after normalization |
| `durationUnit` | yes | `days` \| `years` |
| `compoundingFrequency` | yes | `daily` \| `weekly` \| `monthly` \| `annually` |
| `tokenPrice` | no | `>= 0` — enables USD projections |
| `chartPoints` | no | `2..120` (default 60) |

Non-finite calculation results (IEEE overflow) are rejected with **400**, not returned as `Infinity`.

**Success `200`**

```json
{
  "success": true,
  "data": {
    "projectedBalance": 1051.26749693,
    "totalRewards": 51.26749693,
    "durationYears": 1,
    "chartData": [{ "index": 0, "yearFraction": 0, "day": 0, "balance": 1000 }],
    "assumptions": { "rateModel": "nominal", "formula": "A = P * (1 + r/n)^(n*t)" }
  }
}
```

**Errors**

- `400` — validation / out-of-range input (`{ success: false, message }`)
- `500` — unexpected failures (centralized handler; process stays up)

Quick smoke test:

```bash
curl -s -X POST http://localhost:5025/api/calculate-rewards \
  -H 'Content-Type: application/json' \
  -d '{"principal":1000,"apy":5,"duration":365,"durationUnit":"days","compoundingFrequency":"daily"}'
```

## Tests

```bash
# Calculation engine (Node built-in test runner)
npm run test:server

# HTTP API integration tests
npm run test:api

# Both
npm run test:all

# CRA / React tests
npm test
```

## Architecture

```
server/
  services/rewardsCalculator.js   # pure math (no HTTP)
  controllers/rewardsController.js
  middleware/validateRewardsRequest.js
  middleware/errorHandler.js
  routes/api/rewards.js
server.js                         # Express entry (PORT 5025)

src/
  components/staking-calculator/  # dashboard widget + chart
  api/rewards.ts                  # client API helper
  views/dashboard/Dashboard.tsx   # calculator embedded in existing UI
```

**Choices & trade-offs**

- **Reuse Express** already in the repo instead of a separate microservice — faster integration, same process as `npm start`.
- **Pure service module** for math so it is unit-tested without spinning up HTTP.
- **Thin validation middleware** + service-level checks: HTTP layer coerces types/enums; service enforces numeric bounds.
- **No database** — calculator is stateless; in-memory only as allowed.
- **Recharts** for the growth chart — lightweight, works with MUI layout.
- Existing auth/posts/Mongo routes were left intact and unused by this feature.

## Mathematical assumptions

Formula (assignment):

\[
A = P\left(1+\frac{r}{n}\right)^{nt}
\]

| Symbol | Meaning |
| --- | --- |
| \(P\) | Principal |
| \(r\) | Annual rate as decimal (`apy / 100`) |
| \(n\) | Compounding periods / year (`daily=365`, `weekly=52`, `monthly=12`, `annually=1`) |
| \(t\) | Duration in years (`days / 365` when unit is days) |
| \(A\) | Projected final balance |

**APY semantics:** the `apy` field is treated as a **nominal** annual rate (percent), applied directly in the formula above — **not** converted from effective APY.

If an effective-APY product model were required, the nominal rate would be derived first:

\[
r = n\left((1+\mathrm{APY})^{1/n}-1\right)
\]

Zero APY short-circuits to \(A = P\). Invalid / out-of-range inputs are rejected.

**Complexity**

| Operation | Time | Space |
| --- | --- | --- |
| Closed-form balance / rewards | \(O(1)\) | \(O(1)\) |
| Chart series of \(k\) points | \(O(k)\) | \(O(k)\) |

## UI notes

- Embedded in the existing dashboard (not a standalone app).
- States: **idle**, **loading**, **success**, **error**.
- Client-side field validation plus API error surfacing.
- Uses the dashboard palette (`#173039`, `#00dbe3`) and respects MUI light/dark `palette.mode` tokens where applied.

## Limitations

- Year length fixed at 365 days (no leap-year model).
- Nominal rate model (documented above) — not effective-APY conversion.
- Chart uses evenly spaced samples, not one point per compounding event.
- Principal capped at `1e15`; duration capped at 100 years to keep results finite.
- Existing marketplace Sell/Buy/Exchange UI remains demo/static data.
# assesment
# assesment
