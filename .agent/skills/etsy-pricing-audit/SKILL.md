---
name: etsy-pricing-audit
description: >-
  Audits whether the shop's listing prices are positioned well against the live
  market for their keywords — flags underpriced, overpriced, and justified-outlier
  listings with reasoning. This is a READ-ONLY diagnostic; it recommends price
  changes but NEVER makes them. Trigger whenever the user questions their pricing,
  even without naming the skill: "am I pricing this right", "audit my pricing",
  "are my prices too high or too low", "how do my prices compare to the market",
  "is this listing overpriced", "should I raise my prices", "what are competitors
  charging", "check my prices against the market". Works on the whole shop or a
  specified subset of listings.
---

# Etsy Pricing Audit

Position each listing's price against what the broader market actually charges for
comparable items, and surface the ones that are out of band without a good reason.
The goal is a defensible verdict per listing — not a gut call — that the owner can
act on through a separate, confirm-gated flow.

## This skill is read-only

It reads listings and searches the public market. It **never** calls
`update_listing` or any other `create_*`/`update_*`/`delete_*` tool. When a
listing looks mispriced, the output is a *suggestion* plus a handoff to
**etsy-optimize-listing**, which owns the actual price rewrite and the required
user confirmation. Auditing and acting are deliberately separate.

## Why sample the market, not just eyeball it

A single competitor's price is noise. The signal is the *distribution* — the band
most comparable items sit in. A price is only "wrong" relative to that band AND in
the absence of a differentiator. A bundle of 50 SVGs priced above a single-file
listing isn't overpriced; it's a different product. So the audit has to actually
read comparables, not just compare headline numbers.

## Workflow

1. **Scope the listings.** If the user named specific listings, use those.
   Otherwise pull the shop's active listings with `get_listings_by_shop` (or
   `find_all_active_listings_by_shop`) and audit them — for large shops, confirm
   whether they want the whole catalog or the top sellers / a sample.

2. **Get current price + context per listing.** Call `get_listing_details` for
   each target listing to capture current price, title, tags, materials, and
   description. You need the description/attributes to judge whether an outlier is
   *justified* later. Batch reads where possible and respect the 5 req/s, 5,000/day
   rate limit — don't hammer the API on a big catalog.

3. **Sample the market for each listing's core keyword.** Extract the listing's
   core keyword(s) from its title/tags and call `search_listings` on them to pull
   a market sample. This gives you the price spread for comparable items.

4. **Confirm comparables are actually comparable.** Don't trust the search snippet
   alone. Call `get_listing_details` on a handful of the search results to verify
   they're genuinely the same kind of product — same format, similar bundle size,
   similar materials — not a wildly different variant that would poison the band.
   Discard the non-comparable ones before computing the band.

5. **Compute the market band.** From the confirmed comparables, derive a sensible
   band (e.g. the interquartile range, or a low/typical/high). This is what the
   listing's price gets judged against.

6. **Verdict + reasoning per listing.** Classify each:
   - **Underpriced** — notably below the band with no reason to be cheaper.
   - **Overpriced** — notably above the band with no differentiator to justify it.
   - **Justified outlier** — outside the band *for a reason you can point to*
     (premium materials, larger bundle, licensing, quality signals in the
     description). Say what the reason is.
   - **In band** — no action needed; usually omit from the flagged list.

   Reason from the listing's own description/attributes — don't hand-wave.

## Report structure

Output this fixed template, one block per **flagged** listing (skip in-band ones
except for a one-line count so the owner knows they were checked).

```
# Pricing Audit — <Shop Name>
Listings audited: <N>   Flagged: <M>   Date: <YYYY-MM-DD>

## <Listing title>  (listing_id: <id>)
- Current Price:       <amount>
- Market Band Observed: <low>–<high>  (typical ~<mid>, n=<comparables sampled>)
- Verdict:             Underpriced | Overpriced | Justified outlier
- Reasoning:           <why — grounded in the comparables and this listing's own
                        materials/bundle/description>
- Suggested Action:    <e.g. "consider raising to ~<X>"> — hand off to
                        etsy-optimize-listing to make the change (it will confirm
                        with you before writing anything).

(repeat per flagged listing)

## Summary
<N> in-band and healthy. <count> underpriced, <count> overpriced, <count> justified.
Recommended priority order for the etsy-optimize-listing handoff.
```

## Guardrails

- Never call `update_listing` or any write tool. Suggestions only; the rewrite +
  confirmation lives in etsy-optimize-listing.
- Always verify comparables with `get_listing_details` before trusting a band —
  a band built on mismatched products produces a wrong verdict.
- Justify every outlier call from real listing attributes, not vibes.
- Respect the rate limit on large catalogs; sample rather than exhaustively scan
  if the shop is huge, and say that you sampled.
