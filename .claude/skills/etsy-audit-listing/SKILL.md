---
name: etsy-audit-listing
description: Deep-dive audit of ONE specific listing against Etsy SEO and conversion best practices, scoring each field and returning the top concrete fixes. Trigger this whenever the user asks to "audit this listing", "review listing <id or url>", "what's wrong with listing X", "why isn't this listing selling", "check this one listing", or points at a single item by id/URL and wants a thorough critique. Use this — not etsy-audit-listings (plural) — when exactly one listing is named. It diagnoses; it does not edit.
---

# Etsy Single-Listing Deep Audit

This is the specialist exam for one listing: a field-by-field critique of everything that drives its search ranking and conversion, ending in a score and a short list of the highest-leverage fixes. It is **read-only** — it critiques but never changes the listing.

Every tool accepts an optional `account` argument; pass it if the user names a specific shop, otherwise the default is used.

Read `../_shared/etsy-seo-standards.md` if unsure of a field limit or blind spot — it's shared across all four audit/optimize skills so the rules stay consistent.

## Why field-by-field

A listing that isn't selling usually has more than one thing wrong, and the owner can only see the one that bothers them. Grading title, tags, description, price, images, and attributes separately forces a complete picture and prevents "fix the title, ship it, still doesn't sell". The score-out-of-10 gives a quick before/after handle for later.

## Workflow

All calls are read-only, so no confirmation is needed.

1. **`get_listing_details`** — the core call. Pulls title, description, tags, price, image count/order, attributes, and shipping profile in one shot.
2. **`get_reviews_by_listing`** — this listing's review signal: rating average, count, and any recurring complaint. Low or absent reviews are themselves a conversion factor.
3. **`get_listing_properties`** — attribute completeness, if `get_listing_details` doesn't already give you the full attribute picture.

If any field name is unclear on an endpoint, confirm via the read-only `etsy-docs` MCP (`get_endpoint`, `search_etsy_api`) rather than guessing.

## Step 0 — is it even sellable?

Before critiquing any SEO or copy, check `state` and `quantity` on the listing. If it isn't `active` or has `quantity` of 0, say so immediately and prominently — no amount of title/tag polish matters if the listing can't actually be bought right now. Fix this first, then continue the rest of the audit for when it's back on sale.

## What to critique, field by field

- **Title** — Is the primary keyword front-loaded? Length used well (up to 140 chars)? Reads naturally vs keyword-stuffed? Does it match how buyers actually search?
- **Tags** — Are all **13 slots** used? Are they distinct multi-word long-tail phrases rather than single words or near-duplicates of each other and the title? Is every tag **≤20 characters** (Etsy's hard limit — a too-long tag suggestion is dead on arrival)? Every empty slot is wasted free SEO.
- **Description** — First two lines strong (they show above the fold and feed SEO)? Structured/scannable? Covers what/size/format/use? For digital goods, is delivery/format clearly stated?
- **Pricing** — Compare **landed price** (price + primary domestic shipping rate) against the category and the shop's other items, not bare price — a cheap-looking price with expensive shipping is not actually cheap. Any obvious mismatch with the review/sales signal? Note that a competitor comparison price may reflect an active sale the API can't distinguish from list price.
- **Images** — count and order **only**. Flag too few images, and a weak lead image ordering. Be explicit: you can see image **count and order but not photo quality, lighting, or composition** — that's a human-judgment gap. Recommend a human review of the actual photos; note that this system also has no image-upload tool, so replacing photos is a manual step for the owner. If a video field is exposed and empty, flag its absence — but only presence/absence, not quality.
- **Attributes** — Are category-relevant attributes filled (`materials`, `who_made`, `when_made`, and category-specific properties)? Gaps here hurt filtered-search visibility.
- **Variations & personalization** — Does this listing offer `has_variations`/`is_personalizable` if comparable listings in the same niche commonly do? A missing size/color/personalization option that competitors offer is a real conversion gap.
- **Taxonomy/category fit** — Does the listing's category (`taxonomy_id`) actually match its product type? A wrong category quietly kills filtered-search visibility even with perfect copy — check via `etsy-docs` if uncertain rather than assuming it's right.
- **Renewal setting** — If `should_auto_renew` is on for a listing that otherwise looks neglected/stale, flag it: each auto-renewal costs a small fee, so a dead listing left on auto-renew is a quiet, recurring cost with no offsetting benefit.
- **Review signal** — Rating, count, and any theme in complaints that a buyer would see.

## Scoring — fixed point budget, not vibes

Score out of 10 using this exact budget so repeat audits are comparable: **Title 2, Tags 2, Description 2, Price 1, Images 1, Attributes 1, Review signal 1.** Deduct within each category based on how many concrete issues you found there (e.g. Tags: 2/2 if all 13 slots filled with distinct long-tail phrases, 1/2 if partially filled or duplicated, 0/2 if fewer than half the slots are used). State the per-category point loss so the score is traceable, not just asserted.

## Blind spots to state

No analytics/traffic data exists in the API (no views, no favorites trend, no funnel), and no Ads data — so "why isn't it selling" is answered from structure and signal, not from observed visitor behavior. And photo quality can't be assessed programmatically. Say both plainly.

## Report structure

Always output in exactly this format:

```
# Listing Audit — "<title>" (id <listing_id>)

## Sellable right now?
<state/quantity check — flag immediately if not active or out of stock>

## Title — <pts>/2
<critique + specific issues>

## Tags — <pts>/2
<critique — call out X/13 slots used, flag any tag over 20 characters>

## Description — <pts>/2
<critique>

## Pricing — <pts>/1
<critique, using landed price = price + shipping>

## Images (count & order only) — <pts>/1
<critique — flag that photo quality is a human-judgment gap; note video presence/absence>

## Attributes — <pts>/1
<critique — completeness, incl. materials/who_made/when_made>

## Variations, personalization & category fit
<flag if missing variants/personalization competitors have, or category looks mismatched>

## Review signal — <pts>/1
<rating, count, themes>

## Overall score: <N>/10
<one-paragraph verdict, referencing the per-category points above>

## Top 5 concrete fixes
1. <most impactful, specific and actionable>
2. ...
```

## Next step

Point the user to **etsy-optimize-listing** to actually draft the rewritten title, full 13-tag set, description, and price recommendation for this listing — that skill benchmarks against the shop's own winners and top competitors and produces a confirm-before-write diff.
