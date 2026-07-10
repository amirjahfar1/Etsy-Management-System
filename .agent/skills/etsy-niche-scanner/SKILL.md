---
name: etsy-niche-scanner
description: >-
  Scans a keyword or product niche on Etsy to map saturation, price tiers, dominant
  title/tag patterns, and gaps worth entering — a go/no-go read before the user
  invests in a new product line. Trigger whenever the user says anything like "is
  [niche] worth entering on Etsy", "scan the market for [keyword]", "how saturated is
  [product category]", "find underserved niches for me", "should I sell [product]",
  "what's the competition like for [keyword]", or asks whether a space is too crowded
  or where the openings are. Also trigger if the user is weighing a new category and
  wants a market read before committing, even without these exact words. Prefer this
  skill over casual searches whenever the intent is sizing up a market opportunity.
---

# Etsy Niche Scanner

Answer one question honestly: is this niche worth entering, and if so, where's the opening? A good scan separates a genuinely fresh gap from a graveyard where a handful of established shops already own every search.

Every tool here is **read-only** (`search_*` / `get_*`). No confirmation gate applies.

## The core honesty caveat — read this first

Etsy's API gives you **no real search-volume data**, no views, no favorites, no traffic funnel, and no Ads API. So when this skill talks about "search volume," it means a **proxy inferred from result density** — how many listings come back for a keyword, and how homogeneous they are. Say this out loud in the report. A keyword returning tens of thousands of near-identical listings is clearly a big, crowded space; one returning a few hundred varied listings is smaller or more fragmented. But you cannot report actual monthly searches, and you must not pretend to.

Likewise, you can't see any other shop's real sales. Review counts on individual listings are a rough sales *proxy* only — label them as such.

## Workflow

1. **Cast the net — `search_listings`.** Run the target keyword plus a handful of close variants and adjacent phrasings (e.g. "personalized dog tag", "custom dog tag", "pet id tag"). Variants matter: one phrasing may look saturated while a neighbor is wide open. Note the result count for each — that's your density proxy.

2. **Sample the top results — `get_listing_details`.** Pull details on a representative sample of the strongest results (roughly the top 20-30 across your searches; batch with `get_listings_by_ids` where possible to respect the 5 req/s, 5,000/day limit). From this sample build:
   - **Price distribution** — min, max, and where the bulk clusters into tiers (budget / mid / premium). Note the boundaries roughly, not to the cent.
   - **Title & tag pattern census** — which words, hooks, and structures recur in the top listings. Heavy repetition = a crowded, convention-locked space; variety = room to differentiate.
   - **Concentration read** — are a few shop names showing up again and again across the top results (shop-dominated), or is every listing a different seller (fragmented)? This is the single most important saturation signal.

3. **Check momentum — `get_trending_listings`.** See whether the niche or an adjacent niche is currently rising. A crowded space that's also trending up may still be worth entering; a crowded space that's flat is a harder sell. Trending is a directional signal, not a guarantee.

4. **Fall back to etsy-docs if needed.** If you're unsure of an exact response field, look it up with the **etsy-docs** MCP (`search_etsy_api` / `get_endpoint`). Don't hardcode guessed field names.

## Reading saturation

- **Fragmented** (many different shops, varied titles/prices, no clear dominators) → generally *enterable*. New sellers can rank and differentiate.
- **Shop-dominated** (the same 2-4 shops own the top results, high review counts, tight price banding) → *hard to crack head-on*. Look for a flanking sub-niche or price tier the incumbents ignore rather than competing directly.
- **Thin** (few results, low variety) → either a real untapped gap or a dead niche with no demand. Distinguish these using the trend signal and whether the existing listings show any review activity at all.

## Report structure

Produce this every time, in this order.

### Niche Snapshot
- **Result density (search-volume proxy)** — result counts per keyword/variant, with the explicit reminder that this is inferred density, not real Etsy search volume.
- **Price tiers** — rough tier boundaries (budget / mid / premium) with the price band for each and where most listings sit.
- **Dominant title & tag patterns** — the recurring words, hooks, and structures in top listings; note how homogeneous vs. varied they are. Right after presenting this, ask: "Save these tags to the tags database for future reuse?" — see `../_shared/tags-database-guide.md` for the schema and save workflow.

### Saturation Verdict
One clear call: **fragmented**, **shop-dominated**, or **thin** — with the evidence (concentration of shop names, review counts, price banding) that led there. State how hard it is for a new entrant to rank.

### Trend Signal
Whether the niche or an adjacent niche appears to be rising, flat, or unreadable from `get_trending_listings`. Directional only.

### Gap Opportunities
2-4 specific, underserved openings — a sub-niche, style, personalization angle, or price tier the incumbents leave uncovered — each with a one-line rationale tying it to something you observed (a missing price band, an untapped variant keyword, a trend the crowd hasn't caught up to). Rank them by how enterable they look.

### Bottom line
One or two sentences: worth entering or not, and if so, through which gap. Be willing to say "skip it" when the data says so — a clear no-go is more valuable than a hedged maybe.
