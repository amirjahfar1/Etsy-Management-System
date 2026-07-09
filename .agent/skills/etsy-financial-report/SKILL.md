---
name: etsy-financial-report
description: >-
  Produces a period P&L (profit-and-loss) for the Etsy shop from the payment
  ledger — gross sales, Etsy's fee deductions, refunds, revenue-by-listing, and
  net margin when product costs are known. This is a READ-ONLY diagnostic report;
  it never edits the shop. Trigger this whenever the user wants a financial
  summary of the shop, even if they don't name the skill: "give me a financial
  report", "how much money did I actually make last month", "run a P&L", "what's
  my net revenue after fees", "how did the shop do in June", "break down my Etsy
  income", "what did Etsy take from me", "which listings made me the most money".
  Default to the trailing 30 days when no period is given.
---

# Etsy Financial Report (Period P&L)

Turn the raw payment ledger into a clean profit-and-loss statement the shop owner
can actually reason about: what came in, what Etsy skimmed off, what got refunded,
and — if costs are known — what's actually left. Think like a growth-agency
analyst handing a founder their monthly numbers, not a checklist robot.

## This skill is read-only

Every tool below is a `get_*` call. **Never** call `create_*`, `update_*`, or
`delete_*` from this skill. If the numbers surface something worth acting on (a
loss-leader listing, a price that's too low), *say so and recommend a handoff* —
e.g. to `etsy-pricing-audit` for a pricing look or `etsy-optimize-listing` for a
rewrite. This skill diagnoses; it does not touch the live shop.

## Why the ledger is the source of truth

Etsy's Payment Ledger is the authoritative money record — every credit (a sale
posting) and debit (a fee, a refund, a tax remittance) hits it. Receipts tell you
*what was ordered*; the ledger tells you *what actually settled into your account*.
For a P&L you want the ledger, cross-referenced with receipts for the per-listing
breakdown.

## Workflow

1. **Resolve the period.** If the user named one ("last month", "June", "Q2"),
   use it. Otherwise default to the trailing 30 days from today. State the exact
   date window you used at the top of the report so the numbers are auditable.

2. **Pull the ledger.** Call `get_payment_ledger_entries` for the window. This is
   the backbone. Group entries by type to separate:
   - **Gross sales** (sale/order credits)
   - **Fees** — listing fees, transaction fees, payment processing fees, and any
     marketing/offsite-ads fees
   - **Refunds** (debits back to buyers)
   - **Taxes / regulatory** remittances that reduce payout
   - **Deposits** (payouts to the bank — these net to zero against the money
     earned, don't double-count them as an expense)

3. **Confirm fee-type field names — don't guess.** Ledger entry `entry_type` /
   fee-category strings are easy to get wrong and they vary. Before you label a
   line "payment processing fee" vs "transaction fee", verify the actual field
   names and enum values against the live schema using the **etsy-docs** MCP:
   `get_endpoint` on the ledger operation (e.g. the `getShopPaymentAccountLedgerEntries`
   operationId) to see exactly what `entry_type`, `fee_type`, and amount/currency
   fields are returned. Guessing here silently miscategorizes real money.

4. **Break revenue down per listing.** Call `get_receipt_transactions_by_shop`
   for the same window and roll transactions up by `listing_id` to rank products
   by revenue. This is where dead weight shows up — listings generating fees and
   effort but little income. If you need listing titles for the ranking, batch
   them with `get_listings_by_ids` (never loop `get_listing` one-per-item; respect
   the 5 req/s, 5,000/day limit).

5. **Reconcile against actual payouts.** Call `get_payments` (deposit-level) and
   check that what Etsy says it paid out lines up with `gross − fees − refunds −
   tax` from the ledger. A mismatch usually means a timing lag (a sale settled
   just outside the window) — call that out rather than hiding it. If the gap
   looks structural, flag it and suggest running **etsy-fee-watchdog**.

6. **Compute margin only if costs exist.** Etsy has **no cost-of-goods-sold data
   whatsoever** — materials, time, packaging, none of it. True net margin is only
   as good as the cost figures the user supplies. If per-listing or blended costs
   were provided earlier in the conversation, use them and show net margin.
   Otherwise **ask once** whether they want to supply costs; if not, report gross
   only and explicitly label margin as unknown. Do not invent a cost number.

7. **Isolate ad spend carefully.** There is **no Etsy Ads API**. You cannot get a
   clean ad-spend figure. You can only *infer* it from marketing-looking fee-type
   ledger entries (Offsite Ads, Etsy Ads/Promoted Listings). Always label any such
   figure as a **rough estimate**, never a hard number.

## Report structure

Output this fixed template. Keep currency consistent; note the shop's currency.

```
# Financial Report — <Shop Name>
Period: <YYYY-MM-DD> to <YYYY-MM-DD>  (currency: <CUR>)

## Period Summary
- Gross sales:        <amount>
- Total Etsy fees:    <amount>   (−X% of gross)
- Refunds:            <amount>
- Taxes/regulatory:   <amount>
- Net (after fees & refunds): <amount>
- Estimated net margin: <amount / %>  OR  "margin unknown — provide product costs to enable this"

## Revenue by Listing (ranked)
| Rank | Listing | Units | Gross Revenue | % of total |
| ...  | ...     | ...   | ...           | ...        |
(Call out any clear dead weight at the bottom.)

## Fee Breakdown
| Fee type | Amount | % of gross |
| Listing fees | ... | ... |
| Transaction fees | ... | ... |
| Payment processing | ... | ... |
| Marketing/ads (rough estimate) | ... | ... |

## Payout Reconciliation
Ledger-implied payout: <amount>  vs  Actual deposits (get_payments): <amount>
Delta: <amount> — <explanation: timing lag / clean / investigate>

## Notable Movements
Vs a typical period (if inferable from the data pulled): what moved and why.
Any recommended handoffs (etsy-pricing-audit / etsy-fee-watchdog / etsy-optimize-listing).
```

## Guardrails

- State the exact date window and currency up front.
- Never present inferred ad spend or an unverified fee label as fact — mark
  estimates and confirm ambiguous fee types via etsy-docs `get_endpoint`.
- Never fabricate COGS. No costs supplied → margin is "unknown", full stop.
- Read-only. Any action lives in another skill after user confirmation.
