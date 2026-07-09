---
name: etsy-fee-watchdog
description: >-
  Scans the payment ledger for anomalies — unexpected or duplicate fees, refund
  spikes, currency-conversion losses, and one-off regulatory/tax charges that hide
  in a long ledger. This is a READ-ONLY diagnostic; it flags and explains, it never
  edits anything. Trigger whenever the user is worried something is off with their
  fees or payout, even without naming the skill: "check my Etsy fees for anything
  weird", "did I get double-charged", "watch my ledger for anomalies", "why did my
  payout seem low this time", "am I being overcharged", "scan my ledger", "these
  fees look wrong", "did Etsy charge me something strange". Default lookback is
  ~90 days unless the user specifies.
---

# Etsy Fee Watchdog

A long ledger is where billing mistakes go to hide. This skill reads the payment
ledger over a lookback window, builds a rough per-type baseline, and surfaces the
entries that don't fit — duplicates, refund clusters, currency losses, and
unfamiliar one-off charges — so the owner can catch a genuine billing error or a
problem product before it compounds.

## This skill is read-only

Every call is a `get_*`. It **never** calls `create_*`/`update_*`/`delete_*`. When
it finds something actionable (a fee that looks like an Etsy billing error, a
refund-magnet listing), the output is a *flag with a suggested next step* — e.g.
"contact Etsy support", or a handoff to **etsy-pricing-audit** / **etsy-optimize-listing**
for a problem product. The watchdog watches; it doesn't touch the shop.

## Why baseline-then-deviate

You can't spot an anomaly without a "normal". Fees on Etsy are regular and
predictable per type — transaction fees track order value, processing fees track
payout, listing fees are small and frequent. Establish what *typical* looks like
for each fee type, then the outliers (a duplicate charge minutes apart, a refund
cluster on one listing, a fee type you've never seen) stand out cleanly instead of
drowning in normal traffic.

## Workflow

1. **Set the lookback window.** Use what the user specified; otherwise default to
   ~90 days — long enough to establish a baseline and catch periodic charges,
   short enough to stay relevant. State the exact window used.

2. **Pull the ledger.** Call `get_payment_ledger_entries` across the window.
   Group entries by type (fee type / entry type). Respect the 5 req/s, 5,000/day
   rate limit if the window requires pagination.

3. **Confirm what each type actually is — don't guess.** Ledger `entry_type` /
   fee-type strings vary and are easy to misread, and an unfamiliar type is
   exactly what you're hunting for. Before alarming the user about a strange line,
   verify what it really is against the live schema via the **etsy-docs** MCP:
   `get_endpoint` on the ledger operation (e.g. `getShopPaymentAccountLedgerEntries`)
   to confirm the real `entry_type` / `fee_type` enums and amount/currency fields.
   A "weird fee" is often just a correctly-named regulatory charge you haven't seen
   before — confirm before crying wolf.

4. **Build a per-type baseline.** For each type, compute a rough typical amount
   (median) and frequency. This is the yardstick.

5. **Flag deviations.** For each type, surface entries that deviate sharply:
   - **Duplicate-looking charges** — same type + near-identical amount within a
     tight time window (possible double-charge).
   - **Refund spikes / clusters** — refund volume well above baseline. Cross-
     reference `get_receipt_transactions_by_shop` to see whether refunds concentrate
     on one listing (a problem product — quality, mismatch, delivery issue).
   - **Currency-conversion losses** — conversion fees or FX lines eating margin,
     especially if larger than usual.
   - **Unfamiliar one-off types** — regulatory/tax/adjustment lines not seen
     elsewhere in the window; confirm via etsy-docs before flagging as suspicious.

6. **Attach a next step to every flag.** Each anomaly needs a "so what": contact
   Etsy support (looks like a billing error), investigate a listing (refund
   cluster), or "informational — confirmed legitimate via etsy-docs, no action".

## Report structure

Output this fixed template. If nothing is wrong, say so clearly — a clean bill of
health is a valid and useful result.

```
# Fee Watchdog — <Shop Name>
Lookback: <YYYY-MM-DD> to <YYYY-MM-DD>  (currency: <CUR>)
Entries scanned: <N>   Anomalies flagged: <M>

## Anomalies Found
### <Short label, e.g. "Possible duplicate transaction fee">
- Entry details:  <date, type, amount, ledger_entry_id>
- Why flagged:    <deviation vs baseline — e.g. "2nd identical $X fee 4 min apart">
- Baseline:       <typical amount / frequency for this type>
- Suggested next step: <contact Etsy support | investigate listing <id> | confirmed
                        legit via etsy-docs, informational only>

(repeat per anomaly)

## Refund Cluster Analysis
<If refunds cluster on specific listings: which listing(s), how concentrated,
recommended handoff to etsy-pricing-audit / etsy-optimize-listing to fix the
underlying product. If none: "No refund clustering detected.">

## Clean Bill of Health
<If nothing flagged: "Scanned <N> entries over <window>; all fee types within
normal range, no duplicates, no refund clusters, no unfamiliar charges.">
```

## Guardrails

- Read-only. Flag and explain; never write. Actions (support tickets, listing
  fixes) are for the user or a confirm-gated skill.
- Confirm unfamiliar fee types via etsy-docs `get_endpoint` before alarming — most
  "strange" fees are legitimate once identified.
- State the exact lookback window and currency. Label baselines as rough.
- A clean result is a real deliverable — report it plainly, don't manufacture
  concern.
```
