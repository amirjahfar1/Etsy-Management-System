---
name: etsy-audit-listings
description: Bulk-audits every active listing in the shop at once and returns a severity-sorted table of problems plus a shop-wide priority fix list. Trigger this whenever the user asks to "audit all my listings", "check every listing for problems", wants a "bulk listing review", asks "which listings need work", "scan my catalog", "find my worst listings", or any request that spans the whole catalog rather than one specific item. Use this — not etsy-audit-listing (singular) — when no single listing id or URL is named and the user wants a sweep across many or all listings.
---

# Etsy Listings Bulk Audit

This is the catalog-wide triage pass: it looks at every active listing, flags the ones with problems, and ranks them so the owner knows which fixes will move the needle first. It is **diagnostic only** — nothing gets changed here. The goal is a prioritized worklist, not edits.

Every tool accepts an optional `account` argument. If the user names a specific shop, pass it through; otherwise the default account is used.

Read `../_shared/etsy-seo-standards.md` if unsure of a field limit or blind spot — it's shared across all five audit/optimize/QA skills (including etsy-listing-qa-check) so the rules stay consistent.

## Why bulk-first

Owners tend to optimize the listing they happened to click on, which is rarely the one costing them the most. Auditing the whole catalog at once reveals shop-wide patterns — every listing missing tag slots, a cluster of near-duplicate titles competing with each other, a price outlier that's scaring buyers off — that you simply can't see one listing at a time.

## Workflow

1. **Pull the catalog.** Call `find_all_active_listings_by_shop` (or `get_listings_by_shop`) to get all active listing ids and the total count.

2. **Batch-fetch details — do not loop.** Use `get_listings_by_ids` to pull full data for listings in batches. This matters: the rate limit is 5 req/s and 5,000/day, and looping `get_listing` once per item will burn the budget and be slow on a large catalog. Batch it.

3. **Pull attributes where needed.** For attribute-completeness checks, use `get_listing_properties` on the listings you're scrutinizing. Be selective — don't call it for every listing if the catalog is large; sample or focus on the ones already flagged on other axes. **State your coverage in the report** (e.g. "attributes checked on 24 of 87 listings") and only make shop-wide attribute claims ("most listings are missing materials") from a genuinely random sample or a full pass — a sample drawn only from already-flagged listings will overstate the problem.

4. **Compute a shop baseline.** Before flagging price outliers, compute the shop's own average/median **landed price** (price + primary domestic shipping rate — see `../_shared/etsy-seo-standards.md`) and per-section averages if sections are meaningful. Outliers are relative to *this* shop's landed price, not a global notion of "expensive", and not bare price (a free-shipping listing and a cheap-plus-shipping listing at the same landed cost shouldn't be flagged against each other).

## What to check on each listing

- **Sellability first** — `state` and `quantity`. A listing that's inactive or out of stock isn't a "needs better tags" problem, it's a "can't be bought" problem — flag it separately and with higher urgency than SEO issues.
- **Title** — length (Etsy allows up to 140 chars; very short titles waste SEO real estate), and keyword stuffing / repetition that reads as spam rather than natural front-loaded keywords.
- **Tags** — whether all **13 tag slots** are used, and whether any used tag exceeds **20 characters** (Etsy will reject it) or contains an **uppercase character** (shop style rule, not an API rejection, but flag it). Unused tag slots are the single most common free SEO win. Flag any listing under 13.
- **Attributes** — missing or thin attributes (via `get_listing_properties`), including `materials`/`who_made`/`when_made`; incomplete attributes hurt filtered-search visibility.
- **Variations, personalization & category fit** — flag listings missing variants/personalization that are common for their product type, and any that look miscategorized (`taxonomy_id` mismatched to the actual product — check `etsy-docs` if unsure).
- **Renewal leak** — listings with `should_auto_renew` on that otherwise look stale/neglected are a quiet recurring fee cost with no offsetting benefit; flag as a cheap, concrete fix (turn it off, or actually fix the listing).
- **Price outliers** — flag listings priced (by landed price) well above or below the shop's own average without an obvious reason.
- **Price vs. signal mismatch** — a high price on a listing with no sales/reviews signal, or a rock-bottom price on a proven seller, both warrant a flag.
- **Stale / duplicate** — titles that are near-duplicates of another listing in the same shop (they cannibalize each other's ranking), or listings that look stale/neglected.

Assign each flagged listing a severity: **High** (actively losing sales or search visibility, or literally unsellable — e.g. inactive/out-of-stock, only 3 tags used, or a near-duplicate pair), **Medium** (clear improvement available), **Low** (minor polish).

## Blind spots to state

The Etsy API exposes **no analytics or traffic data** — no views, no favorites trend, no conversion funnel — and no Ads data. So this audit reasons from listing structure and sales/review signals, not from actual visitor behavior. Say this plainly; don't imply you can see traffic. If a field name on any endpoint is unclear, confirm it via the read-only `etsy-docs` MCP (`get_endpoint`, `search_etsy_api`) rather than guessing.

## Ranking the "top 10" fixes — impact × ease, defined

Don't rank by gut feel. Use this tiering so the list is reproducible:

**Impact tiers** (highest first): (a) affects search visibility or sellability across many listings, or a listing that's literally unsellable right now (inactive/out-of-stock) — (b) affects one listing's conversion (price mismatch, thin description) — (c) cosmetic/minor polish.

**Ease tiers** (easiest first): (1) a single API-editable field (one tag, one price) — (2) multiple fields need coordinated changes (a full tag-set rewrite, a title+description pass) — (3) requires something manual outside this system (new photos, a reshoot).

Sort by impact tier first, then ease tier within it (an (a)(1) item outranks an (a)(2), which outranks a (b)(1)). Every item in the top 10 must name the specific listing id(s) and the exact change — "improve tags" is not a fix, "add 6 missing tags to listing #4471102" is.

## Report structure

Always output in exactly this format:

```
# Bulk Listing Audit — <Shop Name>
_<N> active listings scanned · shop avg landed price <X> · attributes checked on <M> of <N>_

## Flagged listings (severity-sorted)
| Listing (title — id) | Issues found                          | Severity |
|----------------------|---------------------------------------|----------|
| ...                  | e.g. only 4/13 tags; thin attributes  | High     |
| ...                  | ...                                   | Medium   |
(sorted High → Low; clean listings omitted or summarized as a count)

## Shop-wide patterns
- <recurring issues across many listings, e.g. "22 listings use <10 tags" —
  only claim shop-wide patterns from the sample coverage stated above>

## Top 10 shop-wide priority fixes
1. <highest impact-tier × ease-tier fix, naming specific listing id(s)>
2. ...
(ranked per the impact × ease tiering above, not by gut feel)

## Blind spots
- No traffic/views/favorites/Ads data available via API — flags are based on
  listing structure and sales/review signal only.
```

## Next step

This skill stops at diagnosis. Point the user to:
- **etsy-audit-listing** — deep-dive one flagged listing before touching it.
- **etsy-optimize-listing** — actually draft the rewrite/fix for a specific listing.
- **etsy-listing-qa-check** — if what the user actually wants is a faster, purely mechanical rules pass/fail across the whole catalog (no severity judgment, no shop-wide-pattern narrative, just "which listings violate which field/style rule") rather than this skill's fuller structural/SEO/pricing triage. Point to this instead of (or after) this skill when the ask is narrowly "are my tags/titles rule-compliant," not "what's wrong with my catalog."

Suggest they start with the High-severity items and run one of those per listing.
