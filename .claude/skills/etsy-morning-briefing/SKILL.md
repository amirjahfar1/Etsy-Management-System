---
name: etsy-morning-briefing
description: Produces a fast, scannable daily operations digest for the Etsy shop — new orders, orders approaching or past their ship-by deadline, new reviews (loudly flagging anything negative), and a recent money-movement pulse — so the owner sees everything actionable in one place with zero digging. Trigger this whenever the user asks for a "morning briefing", "daily shop update", "what happened in my shop today/overnight", "catch me up on my Etsy shop", "anything I need to do today", "shop status", or any variant of a start-of-day / on-demand shop check-in. Prefer this skill over ad-hoc receipt lookups when the intent is a general "what's going on" snapshot rather than a specific single-order question. This skill is read-only and safe to run unattended.
---

# Etsy Morning Briefing

A once-a-day (or on-demand) operations digest. The goal is a single scannable snapshot the owner can read in fifteen seconds and know exactly what — if anything — needs their attention. This is a digest, not a deep report: bias toward brevity, surface the time-sensitive things first, and don't make the reader dig.

This skill is entirely read-only. It never mutates shop data, so it can be run repeatedly and unattended without confirmation.

## Why this exists

Running a live shop means small time-sensitive things (an order quietly sliding past its processing deadline, a fresh 2-star review) can do outsized damage to seller ratings and search placement if they sit unseen. A daily glance catches them while they're still cheap to fix. Overdue-to-ship in particular is the single most consequential metric here — Etsy penalizes late shipment on the seller's rating, so it always leads the briefing.

## Pairs with scheduling

This skill only *produces* one snapshot when invoked — it does not schedule itself. It pairs naturally with Claude Code's own `/schedule` capability: set up a recurring task (e.g. every morning at 8am) that invokes this skill, and you get a hands-free daily briefing. If the user wants that recurring behavior, point them at `/schedule`; this skill is the thing that gets run.

## Workflow

Work through these in order. Batch reads where possible — the API budget is 5 requests/second, 5,000/day.

1. **New orders since last check.** Call `get_shop_receipts` filtered to recent activity (unshipped and/or created in the lookback window — default to the last 24 hours, or since the last briefing if the user indicates one). This is the spine of the briefing.

2. **Overdue-to-ship computation.** For the open/unshipped orders, determine each order's ship-by deadline. Pull the shop's processing times via `get_processing_profiles` (and `get_shop_receipt` for per-order detail where needed) and compare each order's creation date + processing window against **today's actual current date** (read from your own current context, never a hardcoded date — this file is not updated daily, so a fixed date here would silently drift wrong). Bucket each open order as **overdue** (past deadline), **due soon** (within ~1 day of deadline), or on-track. This is the most important output — compute it carefully.

3. **New reviews.** Call `get_shop_reviews` and pick out reviews newer than the last briefing. Flag anything **≤ 3 stars** as urgent — a negative review left unaddressed is both a ratings hit and a customer-service opportunity slipping away.

4. **Money pulse.** Call `get_payment_ledger_entries` for a quick read on recent net money movement (sales in, refunds/fees out) since the last briefing. This is a pulse, not full accounting — one or two summary numbers, not a ledger dump.

If any call fails or returns nothing, say so plainly in that section rather than omitting it — "no new reviews" is a useful signal.

## Report structure

Keep it SCANNABLE. Lead with the most time-sensitive item. Use this fixed template:

```
# Morning Briefing — <date> (<account/shop name>)

## ⚠️ Overdue-to-Ship         ← only if any exist; ALWAYS first when present
- Receipt <id> — <buyer>, <item(s)> — due <date>, N days overdue
- ...
  (If none: omit this whole section, or note "None overdue" under Orders.)

## New Orders (<count>)
- Receipt <id> — <buyer>, <item(s)>, <total> — due to ship <date> [on-track | due soon]
- ...

## New Reviews (<count>)
- ⭐⭐ (2/5) "<snippet>" — <listing> ← NEGATIVE, needs response
- ⭐⭐⭐⭐⭐ (5/5) "<snippet>" — <listing>
  (Flag every review ≤3 stars explicitly.)

## Money Pulse
- Net movement since last briefing: <+/− amount>
- <sales count / refund count / fees, if notable>

## Bottom line
<One line: the single most important action, or an explicit all-clear.>
```

If everything is genuinely quiet — no new orders, nothing overdue, no new reviews — say so explicitly with a clean all-clear rather than padding: e.g. *"All clear — no new orders, nothing overdue to ship, no new reviews. Nothing needs you today."* A confirmed nothing-to-do is a valid and valuable result.

## Handoffs

- If orders are overdue or need tracking submitted, hand off to **etsy-ship-assistant** to actually process them.
- If sales look unusually thin over the window, suggest **etsy-sales-forensics** for a diagnosis.
