# Premium Ledger

Covered call tracker across a rotating book of positions. A static page: no login,
no database, nothing stored. You load a CSV, the page does the math in your browser,
you export a CSV when you are done.

Live prices come from Finnhub using your own free API key. The key is held in memory
for the open tab only.

## Using it

1. Open the site and download the template, or upload a ledger you exported earlier.
2. Fill one row per call sold. Rows that share a `position_id` are the same lot of shares.
   A row with no `sold` date logs a position that has no calls yet.
3. Upload the file. Row-level errors are listed if anything does not parse.
4. Paste a Finnhub key on the Data tab and press Refresh prices to mark open positions.
5. On the Benchmarks tab set your savings APY and add SPY closes for your position open and close dates.
6. Export before you close the tab. Edits made in the app are included in the export.

### Template columns

| column | meaning |
| --- | --- |
| position_id | Label grouping rows into one lot, like `SOUN-1`. Optional. |
| ticker | Symbol as Finnhub knows it. Required. |
| shares | Shares in the lot. Required. |
| cost_basis | Price paid per share. Required. |
| opened | Purchase date, `YYYY-MM-DD` or `M/D/YYYY`. Required. |
| position_status | `open` or `closed`. Blank means open. |
| exit_price, closed_date, exit_reason | Required when closed. Reason is `sold` or `assigned`. |
| sold | Date the call was sold. Blank means a position-only row. |
| expiry | Expiration date. |
| contracts | Whole number. |
| strike | Strike price. |
| credit | Total premium received, in dollars, for all contracts. |
| buyback | Total paid to close early. Blank means 0. |
| fees | Total commissions. Blank means 0. |
| stock_at_sale, stock_at_expiry | Share price on those dates. Optional, builds the price line. |
| outcome | `open`, `expired`, `assigned`, `rolled`, or `bought_back`. Blank means open. |

Dollar signs and thousands separators in numbers are accepted.

## Deploying to GitHub Pages

1. Create a repository and push this folder to the `main` branch.
2. In the repository, open Settings, then Pages, and set Source to **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds on every push to `main` and
   publishes `dist/`. The site appears at `https://<user>.github.io/<repo>/`.

`vite.config.js` sets `base: "./"`, so the build works under any repository name and
on a custom domain without changes.

## Local development

```bash
npm install
npm run dev
```

Needs Node 18 or newer. `npm run build` writes a static copy to `dist/`.

## Layout

```
index.html                       page shell
vite.config.js                   Vite config, base "./" for Pages
public/premium-ledger-template.csv   the upload template
.github/workflows/deploy.yml     GitHub Pages deploy
src/
  main.jsx      React entry point
  App.jsx       screens and state (in memory only)
  engine.js     every formula, pure functions
  csv.js        template parser, validator, exporter
  quotes.js     Finnhub client
  charts.jsx    hand-built SVG charts and shared atoms
  theme.js      palette and outcome colors
  styles.js     stylesheet
```

## Formulas

- Net premium: credit - buyback - fees
- Effective basis: cost basis - net premium per share
- Stock P&L: (mark - basis) x shares, where mark is exit price if closed, else current price
- Return per call, annualized: (net / collateral) x 365 / days to expiry, collateral at cost basis
- Ticker yield, annualized: sum of net / sum of (collateral x days) x 365
- If assigned: (strike - basis) x shares covered + net premium on that call
- Upside given away: (stock at expiry - strike) x shares covered, summed over assigned calls
- Position ROC: total P&L / capital committed
- Savings benchmark: capital x (1 + APY) ^ (days / 365) - capital, over each position's own window
- SPY benchmark: capital / SPY close at open x SPY close at close - capital; closes are typed in on the Benchmarks tab or logged by Refresh prices for today
- Book XIRR: rate at which every cash flow discounts to zero
- Downside cushion: net premium per share / cost basis

Each position tracks a single lot and does not split shares for partial assignment.
This is a tracking tool, not tax or investment advice.
