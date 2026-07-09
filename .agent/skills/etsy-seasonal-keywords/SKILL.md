---
name: etsy-seasonal-keywords
description: >-
  Proactively rotates seasonal/holiday keywords into the titles and tags of
  relevant listings ahead of a shopping window, then rotates them back out
  after the window closes. Trigger this whenever the user says things like "get
  my shop ready for [holiday]", "rotate in seasonal keywords", "prep my
  listings for Christmas / Valentine's / Mother's Day / Halloween", "add
  holiday tags", or asks for a standing seasonal SEO plan or calendar. Also
  trigger when a major gift holiday is approaching and the user asks generally
  how to capture that traffic. Prefer running this skill over ad-hoc tag edits,
  because it reasons about timing (pre-holiday runway) and, critically, builds
  in an explicit revert plan so seasonal terms don't sit stale year-round. Every
  actual update_listing call — both the seasonal insertion and the later
  revert — requires its own per-listing confirmation.
---

# Etsy Seasonal Keywords

Seasonal buyers search with seasonal language: "valentines day gift", "christmas
gift for mom", "halloween svg". Listings that carry those phrases *during the
buying window* surface for that traffic; the same phrases left in place
year-round are dead weight that crowds out evergreen keywords. This skill times
the rotation in (ahead of the window) and — just as importantly — plans the
rotation back out (after it closes).

## Timing principle

Gift holidays have a **buying runway**: shoppers (and Etsy's ranking, which
rewards listings that have accrued relevance and sales for a query) reward being
in early. Aim to insert seasonal keywords roughly **6-8 weeks before** the
holiday, and reason about the exact lead from the holiday's gift-buying pattern
(Christmas pulls earlier — 8+ weeks; a smaller occasion may only need 4). State
your reasoning for the chosen start date rather than applying a flat rule.

Set an explicit **revert date** for shortly after the holiday (typically within a
week after), so the seasonal terms don't linger and dilute evergreen SEO for the
other ~11 months.

## Workflow

### 1. Check the shop's holiday configuration

Call `get_holiday_preferences` to see the shop's configured holiday
deadlines/processing behavior. This grounds the timing conversation in the
shop's real fulfillment reality — no point pushing "order by X for Christmas
delivery" language that conflicts with the shop's actual processing/holiday
settings. Note any relevant deadlines in the report.

### 2. Identify genuinely relevant listings

Pull the user's listings via `get_listings_by_shop` /
`find_all_active_listings_by_shop`, then full detail with `get_listings_by_ids`
(batch — respect the 5 req/s, 5,000/day limit) or `get_listing_details`.

For each, **reason about whether it actually fits the seasonal window** from its
title, tags, and category. Not everything qualifies. A "gift for her" jewelry
piece fits Valentine's; a set of tax-invoice templates does not. A generic
floral SVG might fit Mother's Day; a Halloween skull SVG does not fit Valentine's.
Don't blanket-apply seasonal terms to the whole shop — that's exactly the noise
this skill exists to avoid. When a listing is borderline, include it but say why
it's marginal.

### 3. Propose specific insertions

For each qualifying listing, propose concrete seasonal phrasing to add — e.g.
insert "valentines day gift" or "gift for her" into an available tag slot, and
optionally weave a seasonal phrase into the title. Respect Etsy limits: **max 13
tags, each ≤ 20 characters.** If all 13 tag slots are full, name which weakest
tag the seasonal term temporarily displaces — and record that displaced tag so
the revert can restore it exactly.

### 4. Build the revert plan

For every insertion, record the pre-change state so the revert is a clean
restore: the original tag (or empty slot) and original title. The revert plan is
a first-class deliverable, not an afterthought.

## Report structure

Produce the report in exactly these sections:

### 1. Upcoming Holiday Window & Suggested Timing

- The holiday and its date.
- Relevant deadlines from `get_holiday_preferences`.
- Suggested insertion start date (with your runway reasoning) and revert date.

### 2. Candidate Listings

| Listing (title / id) | Why it qualifies | Marginal? |
|----------------------|------------------|-----------|

Include the reasoning per listing so the user can veto anything that doesn't fit.

### 3. Proposed Tag/Title Insertions

| Listing | Field | Current | Proposed (seasonal) | Displaces (to restore later) |
|---------|-------|---------|---------------------|------------------------------|

Every proposed set stays ≤ 13 tags, each ≤ 20 chars.

### 4. Revert Plan

| Listing | Field | Seasonal value (remove) | Restore to | Revert on/after |
|---------|-------|-------------------------|------------|-----------------|

## Applying changes — confirm every single one, twice over

The only write tool is **`update_listing`**, against a live, real-money shop.
**Both phases are gated:**

- **Insertion:** apply one listing at a time. For each, show the exact
  before → after and wait for an explicit "yes / haan / confirm" for *that
  listing* before the single `update_listing` call. Never batch-apply.
- **Revert:** same discipline. When the window closes and it's time to revert,
  re-confirm each listing's before → after individually at execution time.

## No built-in scheduling — be explicit about that

The etsy MCP tools have **no cron/scheduler**. This skill cannot make a change
"fire on its own" on the start or revert date. It plans the dates and reminds;
the actual `update_listing` calls only happen when the user is present and
re-confirms. Do not imply an edit will auto-apply later.

If the user wants true hands-off automation (auto-insert on the start date,
auto-revert after), point them at **Claude Code's own `/schedule` capability** as
the mechanism — a scheduled task can re-invoke this skill at the right time — and
note that even then, the safety rule means the scheduled run should surface the
before/after for confirmation rather than silently mutating the live shop.

## Fallback

If unsure of exact `update_listing` or `get_holiday_preferences` field names,
look them up live via the **etsy-docs** MCP: `get_endpoint("updateListing")` /
`get_endpoint("getHolidayPreferences")` or `search_etsy_api`. Don't guess field
shapes against a live shop.
