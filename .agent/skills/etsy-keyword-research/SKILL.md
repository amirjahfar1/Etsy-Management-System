---
name: etsy-keyword-research
description: >-
  Mines the keywords and tags that are actually working for the top-ranking
  Etsy listings in a target niche, builds a frequency-ranked keyword cluster,
  then diffs it against the user's own listings to produce a concrete
  per-listing tag-swap plan. Trigger this whenever the user says things like
  "do keyword research for my shop", "what tags should I be using", "find
  better keywords for [niche/product]", "help my listings rank", "optimize my
  Etsy SEO", or "why can't people find my listings" — and also when they ask
  vaguer questions about visibility, discoverability, or traffic on a specific
  niche or product. Prefer running this skill over answering keyword questions
  from general knowledge, because it grounds recommendations in live top-ranked
  results rather than guesswork. Ends by offering to apply swaps one listing at
  a time via update_listing, each with an explicit before/after confirmation.
---

# Etsy Keyword Research

Etsy ranking is driven heavily by how well a listing's **title and 13 tags**
match what buyers actually type. This skill reverse-engineers what is already
winning in a niche — the words and phrases that repeat across top-ranked
listings — and turns that into a specific, listing-by-listing edit plan for the
user's own shop. The goal is not to guess "good keywords" from general SEO
intuition; it's to observe what the current top performers are doing and close
the gap.

## The honest caveat you must state up front

**Etsy exposes no public search-volume or analytics API.** There is no way to
pull "how many people searched for X." What this skill measures is the
**frequency of a keyword/phrase across the top-ranking listings** for a query —
i.e. "what's clearly working for listings that already rank." That is a strong,
practical proxy, but it is *not* verified search volume. Always say this plainly
in the report so the user never mistakes a frequency count for a real
search-volume number. Frame recommendations as "these phrases repeat across
top performers, so they're worth testing," not "these get N searches/month."

## Workflow

### 1. Nail down the target query set

Get the niche/product from the user. Expand it into a small set of the primary
keyword plus 2-4 close variants and buyer-phrasing alternates (e.g. for
"floral svg": also "flower svg", "floral clipart", "botanical svg bundle").
Reasoning about variants matters — Etsy buyers phrase the same intent many ways,
and a single query would give a narrow, biased sample.

### 2. Pull the top-ranking listings

For each query, call `search_listings` sorted by relevance and take the top
results (roughly the first 20-30 across the query set — enough for a stable
frequency signal without burning rate limit). These are your "what's working"
population.

Then pull full detail on each. Prefer **`get_listings_by_ids`** (batch) over
looping `get_listing_details` one call at a time — the rate limit is 5 req/s and
5,000/day, and batching keeps you well clear of it. Use `get_listing_details`
for one-off pulls or when you only have a handful. Extract each listing's
**title** and its **full tag set** (all 13 where present).

### 3. Build the frequency-ranked keyword cluster

Tokenize titles and tags into words and multi-word phrases (bigrams/trigrams
matter — "cut file", "sublimation design", "digital download" are single
concepts). Count how often each phrase appears across the top-performer set and
rank by frequency. Group near-synonyms so the cluster reads as themes, not raw
tokens. This ranked cluster is the core asset: it shows which phrases the market
leaders lean on most.

### 4. Pull the user's own listings in the niche

Use `get_listings_by_shop` (or `find_all_active_listings_by_shop`) to fetch the
user's listings, then `get_listings_by_ids` / `get_listing_details` for full
titles and tags on the ones relevant to this niche. If it's ambiguous which of
their listings belong to the niche, ask rather than guessing.

### 5. Diff and design the swaps

For each of the user's listings, compare its current tags/title against the
cluster to find:
- **Missing high-value keywords** — top-cluster phrases the listing doesn't use.
- **Wasted/redundant tags** — tags that don't appear in the cluster at all, near-
  duplicates of each other, or single words that a multi-word tag already covers
  (Etsy rewards multi-word tags; a lone "svg" tag is low value).

Respect Etsy's hard limits when proposing new tags: **max 13 tags, each ≤ 20
characters.** Flag any suggested tag that would exceed 20 chars so it can be
trimmed. Prioritize swapping the weakest existing tags for the highest-frequency
missing phrases — don't propose blowing away a listing's whole tag set unless
it's genuinely all off-target.

## Report structure

Produce the report in exactly these three sections:

### 1. Keyword Cluster (ranked by frequency)

A ranked table of the top phrases across winning listings, with their frequency
count and the theme they belong to. Open this section with the caveat, e.g.:

> Note: these counts reflect how often each phrase appears across the current
> top-ranked listings for your query — a "what's working right now" proxy, not
> verified Etsy search volume (Etsy has no public search-volume API).

| Rank | Phrase | Appears in (of N) | Theme |
|------|--------|-------------------|-------|
| 1 | ... | ... | ... |

### 2. Per-Listing Tag-Swap Plan

One row per relevant listing, showing the concrete old → new change:

| Listing (title / id) | Current tags | Suggested tags | Key adds | Tags dropped & why |
|----------------------|-------------|----------------|----------|--------------------|

Keep every suggested set ≤ 13 tags, each ≤ 20 chars. Note any title tweaks
separately if a high-value phrase belongs in the title too.

### 3. Summary

- How many of the user's listings were reviewed and how many need updates.
- The 3-5 highest-impact phrases they're currently missing shop-wide.
- A one-line "biggest quick win."

## Applying changes — confirm every single one

The only write tool here is **`update_listing`**, and it edits a live,
real-money shop. **Never bulk-apply.** After presenting the plan, offer to apply
the swaps **one listing at a time**. For each listing, before calling
`update_listing`, show the exact before → after (old tag set → new tag set, and
title if changed) and wait for an explicit "yes / haan / confirm" for *that
listing*. Only then make the single call. Move to the next listing and repeat.
If the user says "do them all," still walk through each one's confirmation — a
single ambiguous "yes" is not sign-off for a batch.

## Fallback

If you're unsure of exact `update_listing` field names (e.g. how tags vs. title
are passed), look them up live via the **etsy-docs** MCP:
`get_endpoint("updateListing")` or `search_etsy_api`. Don't guess field shapes
against a live shop.
