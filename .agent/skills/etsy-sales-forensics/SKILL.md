---
name: etsy-sales-forensics
description: Diagnoses WHY sales dropped over a period — comparing order velocity between a recent window and a baseline, broken down by listing, then hunting for concrete causes (delisted/expired items, price changes, a cluster of negative reviews, new aggressive competitors in the same keyword space). Trigger whenever the user says "why did my sales drop", "sales are down, what happened", "diagnose a slow month/week", "why did this listing stop selling", "my revenue fell off", "figure out why I'm not selling", or any request to explain a decline in sales or orders. This skill is read-only. It is explicit about a hard limitation: Etsy's API exposes no traffic/views/favorites data, so it can rule causes IN with evidence but cannot definitively rule out a pure search-visibility/traffic drop — it frames conclusions as "most likely explanation given available signals," never as certainty.
---

# Etsy Sales Forensics

Figure out why sales fell. The method: quantify the drop, localize it (shop-wide vs. a few listings), then test concrete, evidence-backed hypotheses one by one. Report only what the evidence actually supports, and be honest about what the data can't tell you.

This skill is read-only — it never mutates the shop.

## The hard limitation — state this up front, every time

**Etsy's API gives no traffic, views, or favorites data.** That means you cannot directly distinguish "fewer people are looking at my listings" from "the same people are looking but not buying." You can prove specific causes *in* (a listing went inactive; a price jumped; a run of bad reviews landed; a cheaper competitor appeared). You **cannot** definitively rule *out* a pure traffic / search-visibility decline, because you can't see the traffic.

So frame every conclusion as **"most likely explanation given the available signals,"** not as certainty — and always include an explicit "Unable to rule out" section. Overclaiming here sends the owner chasing the wrong fix.

## Workflow

### 1. Define the windows
Establish the **recent period** (where the drop is) and a comparable **baseline period** before it (same length; account for seasonality where you can). If the user didn't specify, propose sensible windows and confirm.

### 2. Quantify and localize the drop
Pull order/receipt velocity for both windows via `get_shop_receipts` and `get_receipt_transactions_by_shop`, and break it down **by listing**. The key question: is the drop **shop-wide** (roughly proportional across everything) or **concentrated** on a few specific listings? That split drives everything downstream — a concentrated drop points at listing-specific causes; a broad drop points at shop-wide or market causes.

### 3. Check for delisted / expired / deactivated listings
Compare current `find_all_active_listings_by_shop` against the set of listings that were selling in the baseline. A previously-active earner that is now missing/inactive/expired is often the entire story — an expired listing sells zero. Use `get_listings_by_ids` (batch) rather than looping to check status efficiently.

### 4. Check for price changes on affected listings
For the listings that lost sales, pull current price via `get_listing_details` and reason about whether the price point changed versus the period when they were selling. A price increase right at the start of the slow window is a strong candidate cause.

### 5. Check for a negative-review cluster
Call `get_shop_reviews` and look for a cluster of low-star reviews whose timing lines up with the start of the drop — especially on the specifically-affected listings. A fresh 1–2 star review can suppress both conversion and placement.

### 6. Check the competitive landscape
For the affected listings' main keywords, use `search_listings` (and `get_shop_listings` / `get_shop_by_name` on specific rivals) to look for **new aggressive competitors** — newer shops, lower prices, or heavy volume in the same keyword space that appeared around when the drop began. This is inherently a snapshot (no historical competitor data), so treat it as suggestive, not conclusive.

Respect the rate limit (5 req/s, 5,000/day) — batch listing reads with `get_listings_by_ids`, don't loop one call per listing.

## Report structure / Output

```
# Sales Forensics — <shop> — <recent window> vs <baseline window>

## Sales Trend Summary
- Overall: <baseline orders/revenue> → <recent> (<−X%>)
- Shape: [shop-wide | concentrated on N listings]
- By listing (biggest movers):
    <listing> — <baseline> → <recent> (<−X%>)
    ...

## Ruled-In Factors   ← only include factors with actual supporting evidence
- Delisted/expired: <listing> is now <inactive/expired> — was N sales/period. [evidence]
- Price change: <listing> now <price>, up from <prior> around <date>. [evidence]
- Negative reviews: cluster of <n> ≤3★ reviews starting <date>. [evidence]
- New competitors: <shop/listing> at <price> appeared in "<keyword>". [evidence]
  (Omit any factor you found no evidence for. Don't pad.)

## Unable to Rule Out
- A pure traffic / search-visibility drop CANNOT be confirmed or denied —
  Etsy's API exposes no views/favorites/traffic data. If none of the ruled-in
  factors fully account for the decline, a visibility drop is the leading
  remaining suspect, but it is unprovable from available data.

## Most Likely Explanation
<Best-supported story, stated as "most likely given available signals," not certainty.>

## Recommended Next Steps
- <targeted actions>
- Hand off to **etsy-optimize-listing** to improve tags/photos/SEO on affected listings.
- Hand off to **etsy-pricing-audit** if price is a suspected driver.
```

## Tone and honesty
Write like an ops lead who respects the owner's time and money: lead with the number, name causes only when the evidence is real, and never dress up a guess as a finding. If the evidence is thin, say the diagnosis is inconclusive and recommend what to watch next — that's more useful than false confidence.
