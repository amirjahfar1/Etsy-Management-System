---
name: etsy-repeat-buyer-radar
description: Detects repeat purchasers from order history and surfaces cross-sell and bundle opportunities based on what buyers actually buy together. Trigger this whenever the user asks "find my repeat customers", "who are my best/most loyal customers", "what should I bundle together", "find cross-sell opportunities from my order history", "which products get bought together", "who's ordered from me more than once", "what bundles should I create", or any request to analyze buyer loyalty, purchase patterns, co-occurrence, or bundle/cross-sell potential from sales data. Reach for this on any "repeat buyer" or "what to bundle" intent even without the skill name.
---

# Etsy Repeat Buyer Radar

This skill answers two linked questions: *who buys more than once*, and *what gets bought together* — because both point at the same lever, bundling. A buyer who came back three times is telling you what your loyal cohort values, and items that co-occur in carts are pre-validated bundle candidates. The output is a ranked list of bundle ideas grounded in real order data, not guesses.

All tools here are read-only — no confirmation needed. This skill never creates or edits anything on Etsy.

## Privacy discipline (read before pulling anything)

You will be handling real buyer order data. Stick to **product and order facts** — what was bought, when, in what combination. Do **not** surface or repeat personal identifying chatter: no emails, no street addresses, no gift-message contents, no more of a buyer's name than needed to say "this buyer ordered X twice." Refer to repeat buyers by first name/initial or a neutral label. The analysis is about products and patterns, not about profiling individuals.

## Workflow

1. **Pull the order history.** Call `get_shop_receipts` across a meaningful lookback window — wide enough that repeat purchases have had time to happen (a few months to a year, depending on volume). Page through the results; don't judge repeat behavior off one page. Mind the rate budget (5 req/s, 5,000/day) — page deliberately, don't hammer.

2. **Group by buyer to find repeats.** Group receipts by buyer to find anyone with **more than one receipt**. Those are your repeat purchasers. Note how many there are relative to total distinct buyers — that ratio is your repeat-purchase rate.

3. **See what each repeat buyer actually bought.** For each repeat buyer's receipts, call `get_receipt_transactions_by_receipt` to get the line items per order. Now you can see what a returning buyer bought across visits — the sequence and combination is the cross-sell signal (they bought the wedding SVG, then came back for the anniversary one → a "milestone occasions" bundle).

4. **Find frequently-bought-together pairs.** Look for co-occurrence two ways:
   - **Within a single multi-item order**, across many different buyers — items that keep landing in the same cart together.
   - **Across visits by the same repeat buyer** — items the same person gravitated to over time.
   To scan co-occurrence at the shop level efficiently rather than receipt-by-receipt, `get_receipt_transactions_by_shop` can give a broad transaction pull; use `get_receipt_transactions_by_listing` when probing a specific product's companions. Rank candidate pairs by how often they co-occur.

## Report structure

### 1. Repeat Buyer Summary
Count of repeat buyers, total distinct buyers analyzed, the lookback window, and a rough repeat-purchase rate if the pulled data supports computing one. One line on the headline takeaway.

### 2. Notable Repeat Buyers
A short list of the standout returning buyers — for each, **what they bought across visits** (product titles and order dates), kept strictly to product/order facts. Use a first name or neutral label only; no personal details beyond what's needed to tell the story.

### 3. Frequently-Bought-Together Pairs
The candidate bundles, **ranked by co-occurrence frequency**. For each pair (or cluster): the items, how often they appear together, and whether the signal comes from single-order carts, repeat-buyer sequences, or both.

### 4. Suggested Bundle Listings
Concrete bundle proposals built from the pairs above — a working title, what goes in it, and the rationale ("these two co-occur in 14 orders; sold together at a slight discount, likely lifts average order value").

## Handoff

This skill diagnoses opportunity; it does not create listings. If the user wants to turn a suggested bundle into an actual new draft listing, hand off to **etsy-product-ideation** to flesh out and draft it. Any listing creation is a write action and goes through that skill's own confirm-before-write gate — never spin up a draft listing from inside this radar.
