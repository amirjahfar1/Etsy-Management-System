---
name: etsy-competitor-research
description: >-
  Builds a structured competitive dossier on rival Etsy shops in your niche (3-5 by
  default, or however many the user asks for — 10, 15, whatever), then benchmarks
  them side-by-side against your own shop. Trigger this whenever the user says
  anything like "research my competitors", "who are my top competitors on Etsy",
  "build a competitor profile for shop X", "how does my shop compare to
  [competitor]", "size up [shop name] for me", "what are other shops in [niche]
  doing", or asks to compare catalog size, pricing, or review counts against another
  shop. Also trigger if the user names a specific rival shop and wants to understand
  it, even if they don't use the word "competitor". Prefer running this skill over
  ad-hoc lookups whenever the intent is competitive intelligence.
---

# Etsy Competitor Research

Turn a vague "keep an eye on the competition" instinct into a real dossier the user can act on. The goal is not a data dump — it's a clear read on where rivals are winning, where the user's shop is already ahead, and the two or three moves worth stealing.

All tools used here are **read-only** (`get_*` / `search_*`). No confirmation gate applies. You never need to write anything to run this skill.

## How many competitors, and how to actually find real ones

**3-5 is just a sane default, not a limit.** If the user asks for 10, 15, or any other number, do that — at Etsy's rate limit (5 req/s, 5,000/day) even 15 shops is a trivial number of calls. The only real cost of going wider is that the report gets longer to read, so at 10+ shops lean harder on the head-to-head table and trim the per-shop prose (shorter bullets, skip restating things two rivals share) so the dossier stays scannable instead of becoming a wall of text.

Figure out what the user actually handed you, and use the strongest discovery method available for that case:

- **Named shops** ("compare me to WoodlandCraftCo") → resolve each directly with `get_shop_by_name`. This is the most reliable case — no guessing needed.
- **A niche or keyword given, no shop names** ("who competes with me in boho wall art") → don't reach for `search_shops` first. **Run `search_listings` on the exact keyword(s) a buyer would type**, and look at *which shops own the top-ranking listings*. A shop that repeatedly shows up ranking for the same buyer search terms as your listings is a real, buyer-facing competitor — that's a much stronger signal than a shop merely having similar words in its name or bio, which is all `search_shops` tells you. Use `search_shops` only as a supplement (e.g. the user names a style/aesthetic rather than a searchable product keyword). Prefer candidates that also sit in a similar price tier to the user's own listings for that keyword — a shop selling the same keyword at 5x the price is a different market segment, not a true competitor, and should be noted as such rather than silently included.
- **Nothing but "my competitors"** → infer the niche from the user's own catalog first (`get_listings_by_shop` on their shop, read the dominant tags/titles/sections), then run the `search_listings`-based discovery above using those inferred keywords.

Whatever the discovery method, **name the criteria in the report** (e.g. "these N shops were selected because they rank in the top results for '<keyword>', which is one of your own top tags") so the user can judge whether the shortlist actually makes sense, and confirm the shortlist with the user before profiling all of them if there's any ambiguity — don't silently commit to profiling the wrong shops at scale.

## Why each step matters

Etsy's API gives you **no traffic, views, favorites, or sales analytics for other shops** — and there is no Ads API. You cannot see how many sales a rival makes. The only sales-like signal available on someone else's shop is **review count and review velocity**, which you use as a rough *proxy* for sales activity. Always label it as a proxy, never as a sales figure: a shop with 4,000 reviews is plainly busier than one with 12, but the exact multiple is unknowable, and review-to-sale ratios vary wildly by category and by how aggressively a shop chases reviews.

For **each competitor**, work through these calls:

1. **`get_shop_by_name`** (or resolve via `search_shops`) — pulls the shop's identity: name, location, total listing count, total sales count if exposed, shop-level review average, announcement/bio text. This is your Shop Overview and part of your Branding read.
2. **`get_shop_listings`** — their live catalog. From this, derive:
   - Catalog size (how many active listings).
   - Price range spread (lowest → highest, and where the bulk clusters).
   - Section / category mix (are they focused or sprawling?).
   - Recent-addition inference: higher listing IDs and their ordering hint at what they've added lately. Treat this as a soft signal, not a timestamp — the API doesn't hand you clean "created date" sorting here, so say "appears to have recently added" rather than asserting it.
3. **`get_shop_reviews`** — review count and how fresh the recent reviews are. A cluster of reviews in the last few weeks signals an active seller; a trickle spread over years signals a quiet one. This is your Review Velocity section — the sales proxy.

Then profile the **user's own shop** the same way for the benchmark:
- `get_listings_by_shop` for their catalog size, pricing, and section mix.
- `get_shop_reviews` for their own review count and velocity.

Use `get_listings_by_ids` if you need to batch-pull details on a specific set of listings rather than looping one call per listing — the rate limit is 5 requests/second and 5,000/day, so batch wherever a tool supports it.

If you're ever unsure of an exact field name on a response, fall back to the **etsy-docs** MCP: `search_etsy_api` or `get_endpoint(operationId)`. Don't guess field names into the report.

## Report structure

Produce this every time, in this order.

### Per-competitor profile (repeat for each of the 3-5 shops)

**[Shop Name]**

- **Shop Overview** — location, total active listings, total sales if exposed, shop age/tenure signal, one-line positioning.
- **Catalog & Pricing** — number of active listings, price range (low → high), where prices cluster, how many sections/categories and how focused vs. sprawling.
- **Review Velocity (proxy for sales)** — total review count, average rating, and how fresh recent reviews are. Explicitly restate this is a proxy for sales activity, not a sales count.
- **Branding notes** — shop name/aesthetic read, announcement/bio tone, apparent target customer, anything distinctive in how they present.
- **What they're doing that you aren't** — 1-3 concrete tactics: a price tier you don't cover, a product type you lack, a bundling or personalization angle, a section strategy, etc.

### Head-to-head comparison table

A single table across all tracked competitors plus the user's shop, with columns like: Shop | Active Listings | Price Range | Review Count | Recent Review Velocity | Focus (niche breadth). Put the user's shop in its own clearly marked row so the comparison is instant.

### Where you're ahead / where they're ahead

Two short bulleted lists closing the dossier:
- **Where you're ahead** — dimensions where the user's shop leads (pricing coverage, review rating, catalog focus, whatever the data shows).
- **Where they're ahead** — the rivals' genuine advantages, ranked by how addressable they are.

Finish with **2-3 recommended moves** — the highest-leverage things the user could do next, each tied to a specific observation above. Keep them concrete ("add a $12-15 mini bundle tier — three of your rivals own it and you don't") rather than generic advice.

## Honesty guardrails

- Never present review counts as sales counts. Proxy language, every time.
- Never assert a listing's exact creation date from its ID — say "appears recent."
- If `search_shops` surfaced the competitors (user gave only a niche), name that the shortlist is your best guess and invite the user to swap shops in or out before you go deep.
- If a shop has almost no reviews, say the sales signal is too thin to read rather than inventing a conclusion.
