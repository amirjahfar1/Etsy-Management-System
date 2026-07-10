---
name: etsy-product-ideation
description: >-
  Generates concrete new product concepts for the user's Etsy shop by crossing
  current market trends, competitor bestsellers, and — crucially — the user's OWN
  proven sellers, then hands the chosen concept off to etsy-new-listing-copywriter
  for the actual research-first, QA-gated title/tags/description draft (this skill
  never drafts final copy or calls create_draft_listing itself). Trigger
  whenever the user says anything like "what new products should I add", "give me new
  listing ideas", "help me brainstorm new products for my shop", "what should I make
  next", "I need fresh listings", "what would sell for me", or asks for product
  ideas, line extensions, or what to launch. Also trigger when the user is clearly
  looking for what to create next even without these exact words. Prefer this skill
  over generic brainstorming whenever the intent is new Etsy products for their shop.
---

# Etsy Product Ideation

The difference between a growth-agency idea and a lazy one: lazy ideas copy whatever's trending. Good ideas cross **three inputs** — what the market is rising toward, what competitors are winning with, and what already works *specifically for this shop*. That last input is the one most people skip, and it's the most valuable, because the user's own sales history is real data, not a proxy.

## Safety gate — read before any draft

This skill's research steps are all read-only, and **this skill itself never calls `create_draft_listing`.** Its deliverable is concepts — a working title direction, a price band, and a rationale — not launch-ready copy. Turning a chosen concept into an actual title, full 13-tag set, and description is **`etsy-new-listing-copywriter`'s job**: it runs its own research-first pass (reads what's actually ranking for the concept's keyword, benchmarks the shop's own winners if it extends a line) and enforces the mandatory Copy QA Gate (no em dashes, no AI-tell phrasing, lowercase tags, field limits) before anything is shown or written. Drafting final copy here would skip that gate entirely, so don't do it — hand the chosen concept off instead (see "Next step" below).

Once the user is in `etsy-new-listing-copywriter`'s flow, that skill's own confirm-before-write discipline applies: nothing is created without an explicit "yes / haan / confirm" against the exact payload, one concept at a time.

Also flag, whenever a concept is presented: photos still need to be added before a new listing can be published (`upload_listing_image`/`upload_listing_video` exist for that, once files are ready and confirmed — but this skill doesn't judge photo quality or generate images). Set that expectation up front so nobody thinks a concept is a finished listing.

## Workflow — the three inputs

1. **What's rising — `get_trending_listings`.** Read what's currently gaining on Etsy, both in and adjacent to the user's niche. Trending is directional, not a promise, but it tells you where attention is flowing.

2. **What competitors win with — `search_listings` + `get_listing_details`.** Find strong-performing listings in adjacent niches and pull their details. Bestseller status can only be *inferred* — you can't see other shops' sales, so use review count/velocity on a listing as a rough sales proxy and say so. Look for the shape of what's working (format, bundle, personalization hook, price band), not a listing to clone.

3. **What already works for THIS shop — the key step.** Cross-reference `get_receipt_transactions_by_shop` (the user's real, actual sales — the only true sales data you have) against `get_listings_by_shop` to identify their own top-selling listings. Batch with `get_listings_by_ids` where useful to stay under the 5 req/s, 5,000/day limit. Mine what this shop's customers already buy — new concepts that *extend a proven seller* carry far less risk than chasing the market cold.

If you need exact field names for any endpoint, look them up via the **etsy-docs** MCP (`search_etsy_api` / `get_endpoint`) rather than guessing.

## Synthesize — 5 concepts

Cross the three inputs into **five concrete product concepts**. Each concept must tie back to a specific signal: a trend, a competitor gap, or an extension of one of the user's own bestsellers. Spread the five across those sources — don't let all five be "trend-chasing" or all five be "line extensions."

Each concept gets:
- **Working title direction** — the shape and keyword angle a real title would take (SEO-aware, not a codename) — a direction to hand to `etsy-new-listing-copywriter`, not a finished, QA-gated title.
- **Positioning keywords** — 3-5 phrases the research surfaced for this concept (not a finished 13-tag set — that's `etsy-new-listing-copywriter`'s output, after its own deeper research and QA pass).
- **Suggested price band** — a range, benchmarked against what the niche research showed comparable listings charge.
- **Rationale** — one line linking it explicitly to a trend, a competitor gap, or the user's own bestseller line.

## Report structure

Produce this every time, in this order.

### Inputs read
A 2-3 line recap: what's trending, what competitor listings looked strongest (proxy-flagged), and which of the user's OWN listings are their proven sellers. This shows the concepts are grounded, not invented.

### The 5 concepts
For each, in a clean block:

> **1. [Working title direction]**
> - **Positioning keywords:** kw1, kw2, kw3 (3-5, not a finished tag set)
> - **Price band:** $X-$Y
> - **Rationale:** one line tying it to a trend / competitor gap / your own bestseller.

Repeat for concepts 2-5.

### Next step
Close with an explicit offer: *"Pick one and I'll hand it to `etsy-new-listing-copywriter` to do the real research-first title/13-tag/description draft (with its Copy QA Gate) — nothing gets created until you confirm that skill's exact payload."* Restate the two caveats in one line: (1) this skill's concepts are directional, not launch-ready copy — the copywriter skill does its own deeper research before drafting anything final, and (2) photos still need to be added (`upload_listing_image`/`upload_listing_video`, once files are ready) before a new listing can be published.

## Tone

Write like a growth partner who knows this shop, not a generic idea generator. Favor concepts the user could plausibly make and rank for, grounded in their real sales and the real market — not a wishlist of trendy things with no connection to what they actually do.
