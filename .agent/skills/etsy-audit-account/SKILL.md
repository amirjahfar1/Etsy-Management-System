---
name: etsy-audit-account
description: Runs a full shop health-check across branding, catalog structure, shipping, review sentiment, and finances, then produces a graded Shop Health Scorecard with a prioritized action list. Trigger this whenever the user asks to "audit my shop", "audit my account", "how's my Etsy shop doing overall", asks for a "shop health check", wants to "review my whole store", "give me the state of my shop", "what should I fix on my shop", or any broad, whole-shop diagnostic that isn't scoped to a single listing. Prefer this over per-listing skills any time the request is about the store as a whole rather than one item.
---

# Etsy Account Audit — Shop Health Scorecard

This skill is the top-of-funnel diagnostic: a single sweep of the whole shop that tells the owner where the store is strong, where it's leaking money or trust, and what to fix first. Think of it as the annual physical, not the specialist visit. It stays read-only — it never changes anything on Etsy — and hands off to deeper skills for the drill-down work.

Only one Etsy account is connected today, but every tool accepts an optional `account` argument. If the user names a specific shop (e.g. "audit svgpngkingdom"), pass that as `account` on each call. Otherwise omit it and the default account is used.

Read `../_shared/etsy-seo-standards.md` if unsure of a field limit or blind spot — it's shared across all four audit/optimize skills so the rules stay consistent.

## Why this shape

A shop doesn't fail in one place — it bleeds slowly across five areas that each look fine in isolation. A great catalog with a broken shipping profile still loses sales; strong reviews on a store with no section structure still confuse buyers. Grading each area separately forces an honest look at all of them and surfaces the one or two that are actually dragging the shop down, instead of polishing whatever's already good.

## Workflow

Work through these in order. All are read-only, so no confirmation is needed. Batch where possible and respect the 5 req/s, 5,000/day rate limit — this audit is a handful of calls, not a loop over every listing.

1. **Branding & Policies** — call `get_shop`. Look at: shop title/announcement presence and quality, whether there's a filled-out bio/about, currency, and whether policies (return/exchange, when exposed) read as complete vs empty. A blank announcement or missing about section is a real conversion leak.

2. **Catalog Structure** — call `get_shop_sections` for the section list, and `find_all_active_listings_by_shop` for the full active catalog and total count. Compare how many sections exist against how listings are distributed: are there orphan sections with 0–1 listings, or one giant catch-all section holding everything? A shop with 200 listings and 2 sections is as broken as one with 40 sections of 1 item each. While pulling the catalog, also note (from `get_listing_details`/`get_listings_by_ids` on a sample) any listings with `should_auto_renew` on that look stale/neglected — each renewal is a small recurring fee with no benefit if the listing is dead weight, and it's a cheap, concrete fix to flag under Financial Health too.

3. **Shipping Setup** — call `get_shop_shipping_profiles`, `get_processing_profiles`, and `get_holiday_preferences`. Check: does a sane shipping profile exist and is it plausibly attached to listings; are processing times realistic; is holiday/vacation mode accidentally on. Shipping misconfig is one of the most common silent sales killers.

4. **Review Sentiment** — call `get_shop_reviews`. **Separate volume from sentiment before grading.** If the shop has too few reviews to read a trend from (roughly under 10), say the signal is "N/A — insufficient review volume" rather than assigning a low grade to a shop that's simply new or low-volume; a thin review count is a different problem (visibility/traffic) than bad reviews, and this audit shouldn't conflate them. When there is enough volume, take a snapshot of recent ratings: overall average, the mix of 5-star vs 1–3-star, and any recurring theme in low reviews (shipping speed, item-not-as-described, file/format complaints for digital).

5. **Financial Health** — call `get_payment_ledger_entries` and `get_receipt_transactions_by_shop`. Compare the **trailing 90 days against the prior 90 days**, and against the same period last year if enough history exists, rather than eyeballing "recent trend" — a single before/after pair is too easily thrown off by seasonality (e.g. a post-holiday January will always look like a decline compared to December; that's not a real problem). Get a pulse on net revenue direction, order volume direction, and whether fees/refunds are eating an unusual share, explicitly caveating any apparent dip that lines up with a known seasonal lull. This is a pulse-check, not a full P&L — point to etsy-financial-report for the deep money view.

Also check today's date against upcoming major gift-buying windows (Christmas, Valentine's, Mother's Day, etc.) — if one is within ~8 weeks, note whether the shop looks ready for it (relevant listings exist, no seasonal keyword work started yet) as part of the overall picture; point to etsy-seasonal-keywords if it looks like nothing has been done yet.

## Grading rubric — with concrete anchors, so two runs agree

The letter scale is A (best-practice) → B (solid, minor gaps) → C (functional but leaving money on the table) → D (meaningful problems) → F (broken/empty, fix first). A vague scale produces a different grade every run — anchor each area to something observable:

- **Branding & Policies**: F = no announcement/bio and policies blank; C = one of those present but thin; A = announcement, bio, and policies all filled out and specific to the shop (not boilerplate).
- **Catalog Structure**: F = zero sections, or one section holding >80% of listings; C = sections exist but >50% of listings sit in a single catch-all; A = listings spread across sections with no orphans (0-1 item sections) and no single section dominating.
- **Shipping Setup**: F = no shipping profile at all, or holiday/vacation mode is on right now with no active notice to buyers; C = a profile exists but processing times look unrealistic (e.g. >2x what similar shops advertise) or destinations are narrow; A = profile exists, processing times are specific and plausible, holiday mode matches actual shop status.
- **Review Sentiment**: N/A if review volume is under ~10 (see step 4 above — don't grade a thin sample). Otherwise: F = average rating below ~3.5 or a clear recurring complaint theme with no sign of being addressed; C = average rating fine but 1-3 recurring complaint themes visible; A = strong average rating, no recurring negative theme.
- **Financial Health**: F = net revenue or order volume down materially quarter-over-quarter with no seasonal explanation; C = flat-to-declining with an identifiable but unaddressed cause (e.g. fee share creeping up, refund rate elevated); A = stable-or-growing net revenue with fees/refunds in a normal range, seasonality accounted for.

Grade against what you can actually observe — if an area genuinely can't be assessed (not just "insufficient volume" as above, but truly no data, e.g. no analytics/traffic data exists via this API at all), say so plainly rather than inventing a grade. If a field name is unclear on any endpoint, the read-only `etsy-docs` MCP (`get_endpoint`, `search_etsy_api`) can confirm exact fields — use it as a fallback rather than guessing.

## Ranking the "top 5" priority actions — impact × ease, defined

Don't rank by gut feel. **Impact tiers** (highest first): (a) shop-wide or revenue-blocking (e.g. vacation mode accidentally on, a catalog-wide tag problem) — (b) meaningfully hurts one area's grade — (c) minor polish. **Ease tiers** (easiest first): (1) a single setting/field change — (2) requires touching multiple listings or a coordinated change — (3) requires work outside this system (photos, external design). Sort by impact tier first, then ease within it, and name the exact fix (which section to rename, which setting to toggle) rather than a vague direction.

## Report structure

Always output in exactly this format:

```
# Shop Health Scorecard — <Shop Name>
_As of <date> · <N> active listings_

## Grades
| Area                 | Grade | One-line reason                    |
|----------------------|-------|------------------------------------|
| Branding & Policies  |  ?    | ...                                |
| Catalog Structure    |  ?    | ...                                |
| Shipping Setup       |  ?    | ...                                |
| Review Sentiment     |  ?    | ...                                |
| Financial Health     |  ?    | ...                                |
**Overall: <letter>**

## What's working
- <2–4 genuine strengths>

## What's hurting the shop
- <the concrete problems found, grouped by area>

## Top 5 priority actions
1. <highest-leverage fix first — be specific and actionable>
2. ...
(ordered by impact × ease, not by area order)

## Blind spots
- No analytics/traffic/Ads data is available via the API, so this audit can't
  speak to views, click-through, or ad performance.
- <any area you couldn't fully assess and why>
```

## Natural follow-ups

Close the report by pointing the user to the right drill-down, matched to whatever graded worst:
- **etsy-audit-listings** — to bulk-diagnose the catalog listing by listing.
- **etsy-financial-report** — for a deeper revenue/fee/profit breakdown.
- **etsy-storefront-audit** — for a deeper branding/policy/storefront review.

Offer the one or two most relevant to this shop's weakest grades rather than listing all three mechanically.
