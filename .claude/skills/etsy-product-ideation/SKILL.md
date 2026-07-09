---
name: etsy-product-ideation
description: >-
  Generates concrete new product concepts for the user's Etsy shop by crossing
  current market trends, competitor bestsellers, and — crucially — the user's OWN
  proven sellers, then offers to spin a chosen concept into a draft listing. Trigger
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

This skill's research steps are all read-only. But it ends by offering to create a **draft listing**, and `create_draft_listing` is a **write** to a live Etsy shop. A draft is unpublished, but it is still a real mutation.

**Never call `create_draft_listing` off this skill without an explicit confirmation.** Show the user exactly what the draft will contain — title, tags, price, description shell — and wait for a clear "yes / haan / confirm" before calling it. One concept at a time, only the one the user picks.

Also flag, every time you offer a draft: **image, file, and video upload aren't wired up in this system yet.** So a draft stops at a text concept + listing shell. The user will have to add photos manually in Etsy before it can be published. Set that expectation up front so nobody thinks they're getting a finished listing.

## Workflow — the three inputs

1. **What's rising — `get_trending_listings`.** Read what's currently gaining on Etsy, both in and adjacent to the user's niche. Trending is directional, not a promise, but it tells you where attention is flowing.

2. **What competitors win with — `search_listings` + `get_listing_details`.** Find strong-performing listings in adjacent niches and pull their details. Bestseller status can only be *inferred* — you can't see other shops' sales, so use review count/velocity on a listing as a rough sales proxy and say so. Look for the shape of what's working (format, bundle, personalization hook, price band), not a listing to clone.

3. **What already works for THIS shop — the key step.** Cross-reference `get_receipt_transactions_by_shop` (the user's real, actual sales — the only true sales data you have) against `get_listings_by_shop` to identify their own top-selling listings. Batch with `get_listings_by_ids` where useful to stay under the 5 req/s, 5,000/day limit. Mine what this shop's customers already buy — new concepts that *extend a proven seller* carry far less risk than chasing the market cold.

If you need exact field names for any endpoint, look them up via the **etsy-docs** MCP (`search_etsy_api` / `get_endpoint`) rather than guessing.

## Synthesize — 5 concepts

Cross the three inputs into **five concrete product concepts**. Each concept must tie back to a specific signal: a trend, a competitor gap, or an extension of one of the user's own bestsellers. Spread the five across those sources — don't let all five be "trend-chasing" or all five be "line extensions."

Each concept gets:
- **Working title** — the kind of title that would actually go on the listing (SEO-aware, not a codename).
- **Suggested tag set** — 13 tags (Etsy's max), the mix you'd genuinely put on the listing.
- **Suggested price band** — a range, benchmarked against what the niche research showed comparable listings charge.
- **Rationale** — one line linking it explicitly to a trend, a competitor gap, or the user's own bestseller line.

## Report structure

Produce this every time, in this order.

### Inputs read
A 2-3 line recap: what's trending, what competitor listings looked strongest (proxy-flagged), and which of the user's OWN listings are their proven sellers. This shows the concepts are grounded, not invented.

### The 5 concepts
For each, in a clean block:

> **1. [Working Title]**
> - **Tags (13):** tag1, tag2, … tag13
> - **Price band:** $X-$Y
> - **Rationale:** one line tying it to a trend / competitor gap / your own bestseller.

Repeat for concepts 2-5.

### Next step
Close with an explicit offer: *"Pick one and I'll turn it into a draft listing (`create_draft_listing`) once you confirm the details."* Restate the two caveats in one line: (1) the draft is unpublished and you'll confirm the exact title/tags/price/description before creating it, and (2) image upload isn't available in this system yet, so photos must be added manually in Etsy before publishing.

## Tone

Write like a growth partner who knows this shop, not a generic idea generator. Favor concepts the user could plausibly make and rank for, grounded in their real sales and the real market — not a wishlist of trendy things with no connection to what they actually do.
