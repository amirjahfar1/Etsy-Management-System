---
name: etsy-optimize-listing
description: The flagship "make it sell like a top seller" skill — rewrites and improves ONE listing by benchmarking it against BOTH the shop's own best-selling listings AND top-ranking competitor listings in the same keyword space, then presents a concrete OLD→NEW rewrite (title, full 13 tags, description, price) as a diff and waits for confirmation before writing. Trigger this whenever the user asks to "optimize this listing", "make this listing sell better", "rewrite my listing to compete with top sellers", "why is a competitor outselling me on this", "improve my listing so it ranks", or wants a specific listing actually rewritten/leveled-up (not just diagnosed). When the user wants the fix drafted and applied, this is the skill.
---

# Etsy Listing Optimizer — Benchmark & Rewrite

This is the skill that turns a diagnosis into a competitive rewrite. It doesn't just critique — it studies what's actually winning (both inside the shop and among top competitors for the same keywords) and rewrites the target listing's title, tags, description, and price to match those winning patterns. It produces a concrete OLD → NEW diff and then **stops and waits for the user's explicit confirmation before writing anything to Etsy.**

Every tool accepts an optional `account` argument; pass it if the user names a specific shop, otherwise the default is used.

Read `../_shared/etsy-seo-standards.md` if unsure of a field limit (tag length, title length) or a blind spot — it's shared across all four audit/optimize skills so the rules stay consistent.

## Safety — confirm before any write (non-negotiable)

This project manages a **real, live-money shop**, and `update_listing` changes are live and mostly irreversible. Therefore:

- The skill's job ends at **presenting the OLD → NEW diff**. Do **not** call `update_listing` (or any `create_*`/`update_*`/`delete_*` tool) as part of producing the recommendation.
- Only after the user gives an explicit "yes / haan / confirm" against the shown diff may `update_listing` be called — and the call must apply exactly what was shown (which listing, which fields, old → new values), nothing more.
- If the user tweaks the draft, re-show the updated diff and get confirmation again. Never treat an ambiguous "sounds good" about the analysis as approval to write.
- A **partial confirmation** ("yes, but keep the price the same" / "apply the tags but not the title") is not a blanket yes — regenerate the diff with only the approved fields changed, show that narrower diff, and get confirmation again before writing.
- **Re-fetch immediately before writing.** Time may have passed between showing the diff and the user's confirmation (they may have edited the listing elsewhere, or it may have auto-renewed). Call `get_listing_details` again right before the `update_listing` call. If any "OLD" value no longer matches what was shown in the confirmed diff, **stop, do not write** — re-present the diff against the current data instead. Writing against stale OLD values risks silently reverting a change the user made elsewhere.
- **After writing, re-fetch and echo back the applied values** so the user sees the write actually landed as intended, not just that the call returned success.

All the research steps below use read-only tools (`get_*`, `search_*`) and need no confirmation — only the final `update_listing` does.

## Why benchmark against two references

Optimizing in a vacuum produces generic listings. The winning move is to triangulate:
- **The shop's own best-sellers** show what already converts *for this brand and audience* — proven title cadence, tag style, price band. Copy what already works internally.
- **Top-ranking competitors** for the target keyword show what Etsy's search is currently rewarding in this niche — the keyword combinations and positioning buyers are clicking right now.

Diffing the target against both, rather than against best-practice theory alone, is what makes the rewrite competitive instead of merely tidy.

## Workflow

1. **Identify the core keyword(s).** Call `get_listing_details` on the target listing. Extract its primary keyword(s) from the current title and tags — the phrases a buyer would actually type.

2. **Pull the external benchmark — with a real sample, not "a few".** Call `search_listings` for the core keyword and fetch **10-15 results**, not 2-3. Call `get_listing_details` on that set to read title structure, tag patterns, and price points. Treat a pattern as real only if **at least half the sample shares it** — 2 listings doing the same thing is coincidence, not a signal. State plainly that ranking is also driven by factors this rewrite cannot copy (listing age, historical conversion rate, review volume) — matching a top listing's title structure doesn't guarantee matching its rank.

3. **Pull the internal benchmark — the shop's own winners, defined precisely.** Pull `get_receipt_transactions_by_shop` over a **trailing 90-day window** (or the last ~100 transactions if the shop is slow, whichever gives more signal), count sales per `listing_id`, and only treat a listing as a "winner" if it has **at least 5 sales** in that window. Prefer winners that are the **same product type / section** as the target — a top-selling listing from a completely different product line has the wrong title cadence to imitate. **If fewer than 3 listings qualify as winners, skip the internal benchmark and say so explicitly in the report** rather than forcing a comparison against a thin or mismatched sample. Batch listing detail lookups with `get_listings_by_ids` — respect the 5 req/s, 5,000/day limit.

4. **Extract the shop's own voice.** Before drafting anything, read the description style of the shop's qualifying winners (and the shop's `get_shop` announcement/bio) — recurring phrases, tone, formatting conventions (bullet lists vs prose, emoji use, how sizing/shipping info is presented). The rewrite should sound like this shop, not like a generic AI-optimized listing — otherwise every "optimized" listing in the shop converges on the same voice and the brand gets diluted.

5. **Diff the target against both benchmarks** on these axes:
   - **Title structure** — is the primary keyword front-loaded like the winners? Length used?
   - **Tag usage** — all **13 slots** filled with distinct long-tail phrases the benchmarks are using and the target is missing? Every proposed tag must be **≤20 characters** and not an exact duplicate of another tag or the title (see `../_shared/etsy-seo-standards.md`) — a rewrite the API rejects after the user already confirmed it is a wasted round-trip.
   - **Price positioning** — compare **landed price** (listing price + primary domestic shipping rate from the shop's shipping profile), not bare price, against the shop's winners and the competitor band. Under- or over-priced for the signal? Note that competitor prices may reflect an active sale the API can't distinguish from list price — flag as a caveat, don't assert certainty.
   - **Description structure** — does it open strong and cover what/size/format/use the way winners do, in the shop's own voice from step 4?
   - **Seasonality** — if the target listing currently carries deliberately-inserted seasonal keywords mid-window (see `etsy-seasonal-keywords`), don't recommend stripping them just because they look unusual; fold them into the rewrite instead of discarding them.

6. **Produce the rewrite** — a concrete new title, a full **13-tag** set (each checked against the length/duplicate rule above), a description draft in the shop's voice, and a landed-price recommendation, each justified by what the benchmarks showed. If the internal benchmark was skipped (step 3), say the rewrite leans more heavily on the external benchmark and flag that as a lower-confidence recommendation.

If a field name is unclear on any endpoint, confirm via the read-only `etsy-docs` MCP (`get_endpoint`, `search_etsy_api`) before building the `update_listing` payload.

## Blind spot to state

This optimizes for the signals it can actually observe — title, tags, price, and sales — because the Etsy API exposes **no traffic/click-through/conversion data** (no views, no favorites trend, no funnel) and **no Ads data**. So the rewrite is a well-grounded hypothesis, not a guarantee. Tell the user to watch **actual sales and favorites over the following weeks** as the real ground truth, and to revert or re-optimize if the numbers don't move. Also note there's no image-upload tool here — if photos are part of the problem, that's a manual reshoot the owner does outside this system.

## Report structure

Always output in exactly this format:

```
# Listing Optimization — "<title>" (id <listing_id>)

## Core keyword(s)
<the phrases this rewrite targets>

## Benchmarks
**External (top competitors for "<keyword>"):** <patterns observed>
**Internal (this shop's own best-sellers):** <patterns observed>

## Diff
### Title
OLD: <current>
NEW: <proposed>
_Why: <benchmark-backed reason>_

### Tags (13)
OLD: <current tags, note X/13 used>
NEW: <full 13-tag list>
_Why: ..._

### Price (landed = price + primary domestic shipping)
OLD: <current landed price>
NEW: <proposed landed price> — _Why: positioning vs winners/competitors_

### Description
OLD (summary): <what it does now>
NEW:
<full proposed description draft, in the shop's own voice>
_Why: ..._

## Confidence
<state whether the internal benchmark had enough qualifying winners (≥3 with
≥5 sales each in the last 90 days); if not, say the rewrite leans on the
external benchmark alone and is lower-confidence>

## Watch after applying
- Track actual sales & favorites over the next few weeks — that's the real
  signal; the API gives no view/CTR/conversion data to confirm this in advance.

## Confirmation required
This is a draft only. Reply "yes / confirm" to apply these exact changes to the
listing via update_listing, or name specific fields to accept/reject for a
narrower confirmation. Nothing is written until you confirm.
```

Do not call `update_listing` until the user confirms against this diff. Immediately before calling it, re-fetch the listing — if anything shown as OLD has changed since the diff was presented, stop and re-present instead of writing. After the call succeeds, re-fetch once more and report back the actual applied values.
