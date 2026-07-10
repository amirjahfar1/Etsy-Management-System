---
name: etsy-listing-qa-check
description: Mechanically validates listing(s) against the shop's own hard-coded field rules in ../_shared/etsy-seo-standards.md — title length & front-loading, exactly 13 tags each ≤20 chars with no duplicates/near-duplicates/uppercase, description hook length, materials/styles format, plus the Copy QA Gate (no em dashes, no AI-tell phrasing, no placeholders). This is a rules-compliance checker, not a competitive benchmark — it answers "does this listing follow OUR standards", not "how does it compare to competitors" (that's etsy-optimize-listing) or "is this good strategy" (that's etsy-audit-listing/etsy-audit-listings). Works on ONE listing (give an id/URL) or the WHOLE catalog (omit one — checks every active listing). Trigger this whenever the user asks to "QA check this listing", "does this follow our rules", "validate against our standards", "check my listing/listings for rule violations", "run a compliance check", "benchmark my tags/title against our rules", or wants a fast rules pass/fail rather than a strategic critique or competitive rewrite.
---

# Etsy Listing QA / Compliance Check

A fast, mechanical, rule-by-rule pass: does this listing (or every listing in the shop) technically comply with the exact field rules and style rules this shop has defined for itself? No competitor research, no strategy judgment — just pass/fail per rule, with the exact violation and the exact fix. **Read-only — never edits anything.**

Every tool accepts an optional `account` argument; pass it if the user names a specific shop, otherwise the default is used.

**`../_shared/etsy-seo-standards.md` is the single source of truth for every rule checked here.** Read it at the start of every run. Do not hardcode a second copy of any rule in this file — if a rule changes there (e.g. a tag-length limit), this skill's checks change automatically. If a field name is unclear on any endpoint, confirm via the read-only `etsy-docs` MCP (`get_endpoint`, `search_etsy_api`) rather than guessing.

## How this differs from the other audit/optimize skills

- **etsy-audit-listing / etsy-audit-listings** — subjective quality and strategy critique (is the title compelling, are images well-ordered), scored on a point budget. Broader than rules compliance.
- **etsy-optimize-listing** — competitive benchmark against competitors and the shop's own best-sellers, produces a strategic rewrite.
- **This skill** — none of that. Purely mechanical: does the text technically obey the rules this shop has already written down for itself? No research step, no benchmarking, fast to run, same result every time given the same listing and the same standards file.

Point users to the other two when they want strategy or competitive positioning, not just rule compliance.

## Scope — single listing or whole catalog

- **User names a listing** (id or URL): check that ONE listing only. Call `get_listing_details`.
- **No listing named**: check every active listing in the shop. Call `find_all_active_listings_by_shop` to get all ids, then batch-fetch with `get_listings_by_ids` — do not loop one call per listing (5 req/s, 5,000/day limit).

## Rule checks — every check cites the exact rule it enforces

### Title
- Length ≤140 characters.
- Primary keyword appears within the first ~40 characters (front-loaded).
- Characters `% : & +` each appear at most once.
- No word/phrase repeated 2-3 times (spammy repetition pattern).

### Tags
- Exactly 13 tags present — flag any unused slots.
- Each tag ≤20 characters.
- Only letters, numbers, whitespace, `-`, `'` (not as first character), ™, ©, ® — flag any other character.
- No tag exactly duplicates another tag on the listing or the title verbatim.
- No near-duplicate tags (same word/phrase rephrased instead of covering a new buyer intent).
- **No uppercase letters** — flag every tag containing one.

### Description
- Opening ~160 characters read as a standalone hook (ad-headline style), not a scene-setter.
- Overall length roughly 150-400 words — flag if wildly outside this band (soft check, not a hard fail).

### Materials / Styles
- `materials`: letters/numbers/whitespace only, no punctuation or hyphens.
- `styles`: at most 2 entries, each ≤45 characters, letters/numbers/whitespace only.

### Copy quality (from the Copy QA Gate)
- No em dashes.
- No AI-tell phrasing ("Whether you're X or Y", "Look no further", rhetorical-question openers, rule-of-three adjective stacks).
- No leftover placeholders or template artifacts ("[insert X]", stray brackets, double spaces).

These last three overlap with the Copy QA Gate that `etsy-new-listing-copywriter`/`etsy-optimize-listing`/`etsy-seasonal-keywords` already run at drafting time — this skill re-checks them against **live** listings, including ones written before the gate existed or edited manually outside this system, which is exactly the gap this skill covers that the drafting-time gate can't.

## What this skill does NOT check

No sellability (`state`/`quantity`), no pricing, no images, no reviews, no competitor comparison — those are covered by `etsy-audit-listing`/`etsy-audit-listings` and `etsy-optimize-listing`. Keep this skill narrow and mechanical; if the user wants a fuller picture, point them there after this report.

## Report structure — single listing

```
# QA Compliance Check — "<title>" (id <listing_id>)

## Title
✓/✗ Length (<N>/140 chars)
✓/✗ Front-loaded keyword (first ~40 chars)
✓/✗ % : & + each used at most once
✓/✗ No spammy repetition

## Tags (<X>/13 used)
✓/✗ All 13 slots filled
✓/✗ Each ≤20 chars (list any violators)
✓/✗ Valid characters only
✓/✗ No exact duplicates
✓/✗ No near-duplicates
✓/✗ All lowercase (list any violators)

## Description
✓/✗ Strong standalone opening hook (≤~160 chars)
✓/✗ Length in the 150-400 word band

## Materials / Styles
✓/✗ materials format
✓/✗ styles format (count & length)

## Copy quality
✓/✗ No em dashes
✓/✗ No AI-tell phrasing
✓/✗ No placeholders/template artifacts

## Violations found — exact fixes
1. <rule broken> → <exact fix, e.g. "tag 'HANDMADE GIFT' has uppercase — change to 'handmade gift'">
2. ...
(omit this section entirely if nothing failed — say so plainly)

## Overall: <X>/<Y> rules passed
```

## Report structure — whole catalog (no listing named)

```
# QA Compliance Check — <Shop Name>
_<N> active listings scanned_

## Compliance table
| Listing (title — id) | Title | Tags | Description | Materials/Styles | Copy quality | Violations |
|-----------------------|-------|------|--------------|-------------------|--------------|------------|
| ...                   | ✓/✗   | ✓/✗  | ✓/✗          | ✓/✗               | ✓/✗          | <count>    |
(sorted by violation count, worst first; fully-clean listings can be summarized as a count rather than listed individually)

## Shop-wide violation summary
- <e.g. "14 of 87 listings have at least one uppercase tag">
- <e.g. "6 listings are under 13/13 tags">
- <e.g. "3 listings have a title over 140 chars">

## Top offenders — exact fixes
1. <listing id> → <exact violation and fix>
2. ...
```

## Next step

This skill only diagnoses rule violations — it never calls `update_listing`. Point the user to:
- **etsy-optimize-listing** — to actually fix a flagged listing's title/tags/description with a confirm-before-write diff.
- **etsy-audit-listing** / **etsy-audit-listings** — if they also want the broader strategy/quality critique, not just rules compliance.
