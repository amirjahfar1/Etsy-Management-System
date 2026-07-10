---
name: etsy-ship-assistant
description: Finds Etsy orders that need to ship, flags which are overdue or approaching their ship-by deadline, and walks through submitting tracking for each one — ONE confirmed action at a time. Trigger whenever the user says "help me ship my orders", "what orders need shipping", "what's overdue", "submit tracking", "mark this order as shipped", "add a tracking number", "process my shipments", or anything about fulfilling / dispatching orders. Use this skill for any flow that ends in marking an order shipped or attaching tracking. This skill calls write tools (create_receipt_shipment, update_shop_receipt) that are live and buyer-facing, so it gates every single action behind explicit per-order confirmation — it never acts on its own.
---

# Etsy Ship Assistant

Find what needs to ship, sort it by urgency, and walk the user through submitting tracking for each order — pausing for explicit confirmation before every live action. This skill's core purpose is to call write tools, so confirmation discipline is not optional decoration here; it is the whole point.

## The safety rule — read this first, it governs everything below

`create_receipt_shipment` and `update_shop_receipt` are **live, mostly-irreversible writes against a real active shop.** `create_receipt_shipment` in particular **automatically emails the buyer** — so an accidental or wrong call isn't merely a data mistake, it's a customer-facing message that cannot be unsent.

Therefore, for **every** order, before **every** write call:

1. Show exactly what the call will do: the receipt id, buyer, item(s), the **old status → new status**, and the exact carrier + tracking number being submitted.
2. Remind the user, on any `create_receipt_shipment`, that this **sends the buyer an email**.
3. Wait for an explicit **"yes / haan / confirm"** for **that specific order**.
4. Only then make the call.

**Never batch-confirm.** Do not ask "shall I ship all five?" and fire them on one yes. Confirm each order individually, immediately before its own tool call. **Never move to the next order** until the current one is either confirmed-and-executed or explicitly skipped. If the user's answer is ambiguous, treat it as "no" and ask again — the cost of a wrong buyer email far exceeds the cost of one more question.

## Workflow

### 1. Gather what needs shipping
Call `get_shop_receipts` filtered to unshipped/open orders. For each, get enough detail (`get_shop_receipt`, `get_receipt_transactions_by_receipt` as needed) to show the buyer and the item(s) being sent.

### 2. Compute deadline / urgency
Pull processing times via `get_processing_profiles` (and `get_shop_shipping_profile` for the profile attached to each order) to derive each order's ship-by deadline. Compare against **today's actual current date** (read from your own current context, never a hardcoded date — this file is not updated daily, so a fixed date here would silently drift wrong) and bucket each order:
- **Overdue** — past its ship-by date. Highest priority.
- **Due soon** — within ~1 day of the deadline.
- **On-track** — comfortable margin.

### 3. Know the valid carriers
Before proposing any `create_receipt_shipment`, call `get_shipping_carriers` so you use a **valid carrier code**. Don't guess carrier codes — a bad code means a failed or wrong submission.

### 4. Walk through each order, one at a time
Present the sorted list (overdue first), then for each order the user wants to act on, run the per-order confirmation loop from the safety rule above. Get the tracking number and carrier from the user for that order. Show the proposed call, note the buyer email side-effect, get the per-order yes, then call the tool. Report the result. Then — and only then — move to the next order.

If the user wants to only mark an order paid/shipped without tracking, that's `update_shop_receipt`; same confirmation discipline applies (show old → new status, one confirmed action at a time).

## Report structure / Output

Start with the queue, then handle orders one at a time using this fixed shape:

```
# Orders Needing Attention (<count>)   ← sorted, overdue first
1. ⚠️ Receipt <id> — <buyer>, <item(s)> — OVERDUE by N days
2. Receipt <id> — <buyer>, <item(s)> — due <date> (due soon)
3. Receipt <id> — <buyer>, <item(s)> — due <date> (on-track)

--- Processing Receipt <id> ---

Proposed Action:
  Receipt <id> — <buyer>
  Status: <old status> → <new status>
  Carrier: <carrier code/name>   Tracking: <number>
  ⚠️ create_receipt_shipment will EMAIL the buyer automatically.

Confirmation Required:
  Reply "yes" to submit this shipment, or "skip" to move on.

[after explicit yes → call tool]

Result:
  ✅ Receipt <id> marked shipped, tracking <number> submitted, buyer notified.
  (or ⏭️ Skipped, or ❌ error detail)
```

Repeat the `--- Processing Receipt <id> ---` block per order. Never collapse multiple orders into a single confirmation.

## When done
Summarize what shipped, what was skipped, and what still needs to ship later. If overdue orders remain unshipped because the user didn't have tracking yet, call that out so it surfaces again in the next **etsy-morning-briefing**.
