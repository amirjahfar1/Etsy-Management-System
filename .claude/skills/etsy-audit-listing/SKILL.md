---
name: etsy-audit-listing
description: Deep-dive audit of ONE specific listing against Etsy SEO and conversion best practices, scoring each field and returning concrete, per-field optimization suggestions (not just critique) — plus the top 5 highest-leverage fixes. Optionally accepts extra reference listings named by the user (the shop's own other listings, or a competitor's) to ground suggestions in a real comparison instead of generic best-practice. Trigger this whenever the user asks to "audit this listing", "review listing <id or url>", "what's wrong with listing X", "why isn't this listing selling", "check this one listing", "audit this listing and also check listings Y and Z", or points at a single item by id/URL and wants a thorough critique. Use this — not etsy-audit-listings (plural) — when exactly one listing is named as the target. It diagnoses and suggests; it does not edit.
---

# Etsy Single-Listing Deep Audit

This is the specialist exam for one listing: a field-by-field critique of everything that drives its search ranking and conversion, ending in a score, a concrete optimization suggestion for every field, and a short list of the highest-leverage fixes. It is **read-only** — it critiques and suggests but never changes the listing.

Every tool accepts an optional `account` argument; pass it if the user names a specific shop, otherwise the default is used.

Read `../_shared/etsy-seo-standards.md` if unsure of a field limit or blind spot — it's shared across all five audit/optimize/QA skills (including etsy-listing-qa-check) so the rules stay consistent.

## Why field-by-field, and why suggestions not just critique

A listing that isn't selling usually has more than one thing wrong, and the owner can only see the one that bothers them. Grading title, tags, description, price, images, and attributes separately forces a complete picture and prevents "fix the title, ship it, still doesn't sell". The score-out-of-10 gives a quick before/after handle for later. And a critique that only says "tags are weak" isn't actionable — every finding below must end in a concrete "do this" suggestion, not just a diagnosis, so the owner can act on the report without a follow-up question.

## Workflow

All calls are read-only, so no confirmation is needed.

1. **`get_listing_details`** — the core call, on the target listing. Pulls title, description, tags, price, image count/order, attributes, and shipping profile in one shot.
2. **`get_reviews_by_listing`** — this listing's review signal: rating average, count, and any recurring complaint. Low or absent reviews are themselves a conversion factor.
3. **`get_listing_properties`** — attribute completeness, if `get_listing_details` doesn't already give you the full attribute picture.
4. **Reference listings, only if the user named any** — see the next section.

If any field name is unclear on an endpoint, confirm via the read-only `etsy-docs` MCP (`get_endpoint`, `search_etsy_api`) rather than guessing.

## Reference listings (optional) — audit with a real comparison in hand

The user can name extra listings alongside the target to use as a comparison while auditing — their own other listings ("audit listing #123, also check #456 and #789") or a competitor's. When they do:

- Pull `get_listing_details` on each named reference listing (batch with `get_listings_by_ids` if they're all in the same shop). This is a **light pull, not a second full audit** — running the whole scored deep-audit workflow on each reference listing is out of scope here and wasteful; just read their title structure, tag list, and landed price (price + primary domestic shipping) as comparison material.
- Every suggestion in the critique below should then say, where relevant, what the reference listings do differently — "reference listing #456 uses 'boho wall decor' in an open tag slot, this listing doesn't have it" is a concrete, gradeable suggestion; "add more descriptive tags" is not.
- If the user does **not** name any reference listings, suggestions are grounded in the shared standards file's rules alone — say so plainly rather than implying a comparison happened.
- **Don't go looking for reference listings on your own.** Proactively researching competitors or the shop's best-sellers is `etsy-optimize-listing`'s job (it pulls 10-15 competitor listings plus the shop's own sales winners as a full competitive-research pass) — this skill only uses reference listings the user explicitly names, and stays fast and light because of that.
- If reference listings were named, after presenting the "Reference listings used" report section, automatically save these reference listings' tags to the tags database — no need to ask — see `../_shared/tags-database-guide.md` for the schema and save workflow.

## Step 0 — is it even sellable?

Before critiquing any SEO or copy, check `state` and `quantity` on the listing. If it isn't `active` or has `quantity` of 0, say so immediately and prominently — no amount of title/tag polish matters if the listing can't actually be bought right now. Fix this first, then continue the rest of the audit for when it's back on sale.

## What to critique, field by field — critique AND a concrete suggestion for each

Every field below produces two things in the report: what's wrong (critique) and exactly what to do about it (suggestion). If reference listings were named, ground the suggestion in what they show; otherwise ground it in the shared standards file's rules and say so.

- **Title** — Is the primary keyword front-loaded? Length used well (up to 140 chars)? Reads naturally vs keyword-stuffed? Does it match how buyers actually search? → Suggestion: the exact rewrite direction (e.g. "move the primary keyword into the first 40 characters", "drop the repeated word in position 3", or, with a reference listing, "adopt the `[Keyword] | [Modifier] | [Occasion]` pattern reference listing #456 uses").
- **Tags** — Are all **13 slots** used? Are they distinct multi-word long-tail phrases rather than single words or near-duplicates of each other and the title? Is every tag **≤20 characters** (Etsy's hard limit — a too-long tag suggestion is dead on arrival)? Is every tag **lowercase** (shop style rule — flag any tag with an uppercase character)? Every empty slot is wasted free SEO. → Suggestion: name the exact tags to add/fix, e.g. "fill the 4 empty slots with X, Y, Z" or, with a reference listing, "add 'personalized dog mom' — reference listing #789 uses it and this listing's closest tag is just 'dog'".
- **Description** — First two lines strong (they show above the fold and feed SEO)? Structured/scannable? Covers what/size/format/use? For digital goods, is delivery/format clearly stated? → Suggestion: what to rewrite the opening hook to, or what missing section to add.
- **Pricing** — Compare **landed price** (price + primary domestic shipping rate) against the category and the shop's other items, not bare price — a cheap-looking price with expensive shipping is not actually cheap. Any obvious mismatch with the review/sales signal? Note that a competitor comparison price may reflect an active sale the API can't distinguish from list price. → Suggestion: a specific direction (raise/lower, and roughly by how much) referencing the shop's own price band or a named reference listing's landed price.
- **Images** — count and order **only**. Flag too few images, and a weak lead image ordering. Be explicit: you can see image **count and order but not photo quality, lighting, or composition** — that's a human-judgment gap `upload_listing_image` can't close (it can upload a file, it can't judge one). If a video field is exposed and empty, flag its absence — but only presence/absence, not quality. → Suggestion: e.g. "add at least 3 more images" or "reorder so the lifestyle shot leads, not the plain product shot" (order is the one thing this can meaningfully suggest without seeing photo quality); if the owner has a specific replacement photo ready, `upload_listing_image`/`upload_listing_video` can actually upload it once confirmed.
- **Attributes** — Are category-relevant attributes filled (`materials`, `who_made`, `when_made`, and category-specific properties)? Gaps here hurt filtered-search visibility. → Suggestion: which specific attribute fields to fill and with what kind of value.
- **Variations & personalization** — Does this listing offer `has_variations`/`is_personalizable` if comparable listings in the same niche commonly do? A missing size/color/personalization option that competitors offer is a real conversion gap. → Suggestion: which variation/personalization type to add, citing a reference listing if one was named.
- **Taxonomy/category fit** — Does the listing's category (`taxonomy_id`) actually match its product type? A wrong category quietly kills filtered-search visibility even with perfect copy — check via `etsy-docs` if uncertain rather than assuming it's right. → Suggestion: the correct `taxonomy_id`/category if a mismatch is found.
- **Renewal setting** — If `should_auto_renew` is on for a listing that otherwise looks neglected/stale, flag it: each auto-renewal costs a small fee, so a dead listing left on auto-renew is a quiet, recurring cost with no offsetting benefit. → Suggestion: turn it off, or fix the listing so the renewal is worth paying for.
- **Review signal** — Rating, count, and any theme in complaints that a buyer would see. → Suggestion: if a recurring complaint theme is visible, name the concrete fix that would address it (e.g. "reviews repeatedly mention slow shipping — check processing time on the shipping profile").

## Scoring — fixed point budget, not vibes

Score out of 10 using this exact budget so repeat audits are comparable: **Title 2, Tags 2, Description 2, Price 1, Images 1, Attributes 1, Review signal 1.** Deduct within each category based on how many concrete issues you found there (e.g. Tags: 2/2 if all 13 slots filled with distinct long-tail phrases, 1/2 if partially filled or duplicated, 0/2 if fewer than half the slots are used). State the per-category point loss so the score is traceable, not just asserted.

## Blind spots to state

No analytics/traffic data exists in the API (no views, no favorites trend, no funnel), and no Ads data — so "why isn't it selling" is answered from structure and signal, not from observed visitor behavior. And photo quality can't be assessed programmatically. If reference listings were named, their prices may reflect an active sale the API can't distinguish from list price — say so as a caveat, not a certainty. Say all of this plainly.

## Report structure

Always output in exactly this format:

```
# Listing Audit — "<title>" (id <listing_id>)

## Sellable right now?
<state/quantity check — flag immediately if not active or out of stock>

## Reference listings used
<list any user-named reference listings and a one-line pattern from each,
or "None — suggestions below are grounded in the shop's own standards file
only" if none were given>

## Title — <pts>/2
<critique>
**Suggestion:** <exact, actionable rewrite direction>

## Tags — <pts>/2
<critique — call out X/13 slots used, flag any tag over 20 characters or uppercase>
**Suggestion:** <exact tags to add/fix/rename>

## Description — <pts>/2
<critique>
**Suggestion:** <exact rewrite direction>

## Pricing — <pts>/1
<critique, using landed price = price + shipping>
**Suggestion:** <direction and rough amount>

## Images (count & order only) — <pts>/1
<critique — flag that photo quality is a human-judgment gap; note video presence/absence>
**Suggestion:** <count/order fix only>

## Attributes — <pts>/1
<critique — completeness, incl. materials/who_made/when_made>
**Suggestion:** <which fields to fill>

## Variations, personalization & category fit
<flag if missing variants/personalization competitors have, or category looks mismatched>
**Suggestion:** <what to add or correct>

## Review signal — <pts>/1
<rating, count, themes>
**Suggestion:** <concrete fix for any recurring complaint theme>

## Overall score: <N>/10
<one-paragraph verdict, referencing the per-category points above>

## Top 5 optimization suggestions
1. <most impactful, specific and actionable — grounded in a reference listing if one was given>
2. ...
```

## Next step

This skill stops at diagnosis and suggestions — it never calls `update_listing`. Point the user to:
- **etsy-optimize-listing** — to actually draft the rewritten title, full 13-tag set, description, and price recommendation for this listing as a confirm-before-write diff; that skill runs the full competitive-research pass (10-15 competitors + the shop's own sales winners) that this one intentionally skips.
- **etsy-listing-qa-check** — for a fast, purely mechanical rules-compliance recheck of this same listing after any fix is applied (or standalone, if the user just wants a rules pass/fail rather than the fuller strategic critique this skill gives).
