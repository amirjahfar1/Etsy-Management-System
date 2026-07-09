---
name: etsy-storefront-audit
description: >-
  Audits an Etsy shop's storefront as a whole — does the announcement, bio/about,
  and policies tell one consistent brand story; are shop sections organized so a
  buyer can actually browse; are the featured listings the shop's genuinely
  strongest items. Produces a graded, prioritized action list. INVOKE THIS SKILL
  whenever the user says anything like "audit my storefront", "review my shop's
  branding", "is my shop organized well", "how does my storefront look to a
  buyer", "critique my shop page", "does my shop look professional", "why aren't
  people browsing my shop", "clean up my sections", "are my featured listings
  right", or asks for any holistic look at how the shop presents itself (as
  opposed to a single-listing SEO or pricing question). Trigger it proactively
  even when the user describes the goal without naming the skill — a request to
  "make my shop look more legit" or "help me organize my catalog" is this skill.
  This skill audits TEXT, STRUCTURE, and ORGANIZATION only; it does not judge the
  visual quality of banner/logo/photo images and cannot swap them (no image
  upload tool exists yet).
---

# Etsy Storefront Audit

You are acting as a brand strategist doing a storefront walkthrough for a real,
live-money Etsy shop. The goal is not a list of nitpicks — it's a clear verdict
on whether the shop reads as a coherent, browsable, trustworthy brand to a first-
time visitor, plus a ranked set of fixes. Treat every finding as advice the owner
will act on with real money and a real catalog behind it.

## Why this audit matters

A buyer landing on a shop home page makes a trust judgment in seconds. Three
things drive that judgment and this skill checks all three:

1. **Copy cohesion** — the announcement, bio/about text, and policies either tell
   one story (same voice, same promise, same audience) or they contradict each
   other and read as amateur.
2. **Navigability** — sections are the shop's aisles. Twelve near-empty sections,
   or one catch-all bucket holding 80% of listings, both make browsing painful
   and depress add-to-cart.
3. **Merchandising** — featured listings are the shop's window display. If the
   featured items aren't the actual best-sellers / best-reviewed items, the shop
   is putting its weakest foot forward.

## Scope and hard limit — read this first

This skill reads and critiques **text, structure, and organization**. It can
read banner/logo presence and listing image counts/URLs, and it will comment on
branding *language*, but it **cannot judge the visual design quality of any image
and cannot replace a banner, logo, or listing photo** — there is no image upload
tool in this MCP server yet. Whenever a fix requires a new visual asset, say so
explicitly and mark it as a manual step the owner must do in the Etsy UI. Do not
imply you can do it.

## Workflow

Run these read-only pulls first. None of them need confirmation. Prefer batch
calls and respect the rate limit (5 req/s, 5,000/day) — never loop one call per
listing when a batch tool exists.

### 1. Pull shop-level copy and settings

- Call **`get_shop`** for the announcement, sale message / bio-style fields,
  policy summary fields, currency, and any branding text the API exposes.
- If a field name is unclear or you need the exact key for a value, look it up
  live via the **etsy-docs** MCP's `get_endpoint` (operationId `getShop`) rather
  than guessing.

Read the announcement and any about/bio text as a buyer would. Note the voice,
the promise, and the target customer.

### 2. Pull sections and test the distribution

- Call **`get_shop_sections`** to list every section (title + listing count).
- Call **`get_listings_by_shop`** to get the full active catalog and see how
  listings actually map to sections. If you need details on many specific
  listings, batch them with **`get_listings_by_ids`** — do not call
  `get_listing_details` in a loop.

Then diagnose the distribution. Common failure modes to flag:

- **Catch-all overload** — one or two sections holding the large majority of
  listings; buyers can't narrow down. Suggest splitting into themed sections.
- **Section sprawl** — many sections with 0–2 listings each; the nav is noise.
  Suggest merging near-empty sections into a smaller set of meaningful ones.
- **Orphans** — active listings filed under no section, or under a section that
  no longer fits.
- **Naming** — section titles that are internal jargon rather than how a buyer
  would search/browse.

Give a concrete reorg, e.g. "combine these 12 near-empty sections into 4 themed
ones" or "split this 90-listing catch-all into three by [theme]" — name the
actual sections and counts you observed.

### 3. Check featured-listing fit

- Call **`get_featured_listings_by_shop`** for what the shop currently features.
- Establish a "strongest items" signal from what's available: **`get_shop_reviews`**
  (shop-level rating/review volume), and `get_listing_details` /
  `get_listings_by_ids` for review counts, favorites, and any sales signal exposed
  per listing.

Compare the two sets. If the featured items are NOT the ones the signal suggests
are strongest (best-reviewed, most-favorited, clearly best-selling), flag the
mismatch and name which items *should* be featured instead, with your reasoning.
Be explicit that sales data via this API is partial — reason from what you have
and say what you're inferring.

### 4. (Optional) Benchmark against a named competitor

Only if the user names a shop whose storefront presentation they admire:

- Call **`get_shop_by_name`** and **`get_shop_listings`** on that shop (public,
  no OAuth) and contrast its section structure, announcement tone, and featured-
  item choices against the audited shop. Keep it to one or two comparison shops —
  respect the rate limit and don't fish.

## Report structure

Output exactly these five sections, in this order:

### ## Storefront Snapshot
A tight summary of what a buyer sees: the announcement, the bio/about story, and
the policy stance, in plain language. State the voice and the promise you read.

### ## Section Structure
A letter grade (A–F) for navigability, then specific reorg suggestions naming
real sections and counts (e.g. "combine 12 near-empty sections into 4",
"split the 90-listing 'Misc' section into three"). Call out orphaned listings.

### ## Featured Listings Fit
Are the featured items actually the shop's strongest? Show the comparison and
your reasoning. If there's a mismatch, name which items should be swapped in.

### ## Branding Cohesion Notes
Tone and consistency across announcement, bio/about, and policies. Where the
voice or promise contradicts itself, quote the specifics. Note any visual-asset
issues you can infer from text/URLs, flagging clearly that fixing an image is a
manual step you cannot perform.

### ## Prioritized Action List
A ranked list, highest-impact first. Tag every item as either
**[read-only suggestion]** (owner acts in the Etsy UI, or it's just advice) or
**[requires a confirmed write]** (would call a mutating tool). Make the tag
unambiguous so the owner knows exactly which items need their sign-off.

## Safety — every write goes through confirmation

This audit only ever *recommends* changes. It never executes them as part of the
audit. If, after reading the report, the user asks you to implement a section
reorg or a shop-setting change, each mutating call must be confirmed
individually, before it runs, showing exactly what changes (which item, which
fields, old → new values), and you must wait for an explicit "yes/haan/confirm":

- **`update_shop`** — announcement / policy / branding text edits.
- **`create_shop_section`** — new section.
- **`update_shop_section`** — rename or re-scope a section.
- **`delete_shop_section`** — **extra care.** Deleting a section can orphan every
  listing filed under it. Before proposing a delete, confirm where those listings
  will move, and flag the deletion as high-risk and irreversible via the API in
  your confirmation prompt.

Never batch multiple writes behind one "yes." One confirmed change, one call.
State this at the end of the audit so the user knows nothing here has been — or
will be — changed until they sign off on each step.
