---
name: etsy-review-insights
description: Mines the entire body of shop reviews to surface recurring themes — what buyers repeatedly complain about, what they praise — and maps each negative theme back to the specific listings it clusters around, so the user knows exactly what to fix and where. Trigger this whenever the user asks "what are people complaining about", "analyze my reviews", "find patterns in my customer feedback", "what do my reviews say I should improve", "any recurring issues in my reviews", "what are buyers unhappy about", "read through my reviews and tell me what's wrong", or any request to summarize, cluster, diagnose, or extract actionable signal from Etsy review text. Also trigger when the user names a single listing and wants that product's reviews understood. Do NOT wait for the user to say the skill name — reach for this on any review-analysis intent, even a casual "what's the vibe of my reviews lately".
---

# Etsy Review Insights

This skill turns raw review text into a prioritized, listing-level fix list. The value is not summarizing — it's clustering. One-off complaints are noise; the same complaint appearing across ten reviews on the same three listings is a product defect you can act on. Your job is to separate signal from noise and tie every actionable theme to a specific listing so the user can go fix the actual thing.

All tools used here are read-only, so no confirmation is required before calling them. Confirmation gates only apply to write/delete tools, and this skill calls none.

## When to pull what

- **Whole-shop analysis** (the default): call `get_shop_reviews` to pull the full review set. Page through until you have the complete history the API will return — do not stop at the first page and generalize from a handful of reviews. A pattern claim needs volume behind it.
- **Single named listing**: if the user points at one product ("what are people saying about my mermaid SVG bundle"), call `get_reviews_by_listing` for that listing_id instead of, or in addition to, the shop-level pull.
- **Product context for mapping**: to describe *what* each listing is (so "download problem" maps to "the digital file listings" and "sizing" maps to "the physical apparel listings"), pull `get_listings_by_shop` for the catalog, and `get_listing_details` on specific listings a theme clusters on. When you need details on several listings at once, use `get_listings_by_ids` (batch) rather than looping `get_listing_details` one at a time — the API budget is 5 requests/second and 5,000/day, and looping burns it fast.

## How to cluster (don't force a taxonomy)

Read what is actually there. This shop's product mix determines which themes exist — a digital-download shop will surface "file wouldn't open / wrong format / couldn't unzip" complaints that make no sense for a physical shop, while a physical shop surfaces sizing, damage-in-transit, and color-accuracy issues. Infer the categories from the review corpus in front of you. Common clusters to watch for, but only report the ones that genuinely appear:

- **Sizing / fit** (physical goods) — runs small, runs large, chart was wrong.
- **Shipping speed / delivery** — arrived late, slow processing, tracking issues.
- **File / download problems** (digital goods) — wrong format, corrupt zip, couldn't open in their software, missing files, licensing confusion.
- **Quality** — material, print, stitching, durability (can be praise or complaint).
- **Packaging** — arrived damaged, over/under-packaged, presentation.
- **Communication / service** — responsiveness, resolution of a problem.
- **Value / price** — felt worth it, or didn't.
- **Accuracy** — item didn't match photos or description.

Rank themes by frequency, not by how loud any single review is. A three-paragraph angry outlier is one data point; five terse "ran small" reviews is a pattern.

## Mapping themes to listings

For every **negative** theme, identify which listing(s) it clusters on. Reviews from `get_shop_reviews` carry the listing they're attached to — group the complaining reviews by listing_id, then translate those IDs into human titles/product types via the catalog pull. The deliverable the user actually wants is "listing X has a recurring sizing problem," not "some people mentioned sizing." If a theme is spread thinly across the whole catalog (e.g. general shipping speed), say so — that points at a shop-level fix, not a listing edit.

## Report structure

Produce exactly these sections, in this order:

### 1. Overall Sentiment Snapshot
A rough positive / neutral / negative split (counts or percentages from the reviews pulled), the total number of reviews analyzed, and the time span they cover. One or two sentences on the headline takeaway.

### 2. Recurring Themes (ranked by frequency)
For each theme, most frequent first:
- **Theme name** — how many reviews touch it.
- 1–2 **representative verbatim quotes** (short, real, from the corpus).
- **Which listing(s) it clusters on** (titles + IDs), or "shop-wide" if diffuse.

### 3. Praise Themes (what's working)
The recurring positives — worded so the user can lift them straight into marketing/listing copy ("buyers repeatedly call the files 'ready to use in Cricut instantly'"). Note which listings earn the most love.

### 4. Suggested Fix List (tied to listings)
A prioritized, concrete action list. Each item: the problem, the listing(s) affected, and the specific remediation (e.g. "add a sizing chart image and a 'runs small, size up' note to listing 1234567890"). Order by impact = frequency × severity.

## Handoff

The fix list is a diagnosis, not the surgery. After presenting it, offer to hand each item to the remediation skills: **etsy-audit-listing** to run a full audit on an affected listing, or **etsy-optimize-listing** to rewrite the copy/tags/attributes. Do not start editing listings from inside this skill — surface the findings, then let the user choose what to fix.
