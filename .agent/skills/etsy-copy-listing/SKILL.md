---
name: etsy-copy-listing
description: >-
  Clones an existing Etsy listing (yours or any other shop's — a "winning
  listing") into a brand-new draft on a connected account: variation
  structure and every image are copied 100% as-is (images are a deliberate
  placeholder — the user swaps in their own photos later, before/while
  making it public; a clothing/apparel clone additionally requires a
  size-chart image in the gallery). Price is never inherited — the user is
  always asked what to charge. Shipping/processing is always standardized
  to this shop's 3-5 day default, confirmed with the user, not copied from
  the source. Category (`taxonomy_id`) is always confirmed too — the
  source's existing category is shown and the user picks reuse-it or a
  different one, never silently carried over. Whether the listing is
  personalized at all is always explicitly confirmed based on what the
  product actually looks like, independent of whatever personalization
  state the source listing happens to have. Title, tags, and description
  are NOT cloned verbatim — research runs first, seeded from the source
  listing's own tags, with the best-performing researched keywords woven
  into a well-optimized meta title and description, and the draft is
  created once with that research-backed, QA-gated copy from the start
  rather than a placeholder that gets rewritten after the fact. Trigger
  this whenever the user gives a listing ID or URL and says things like
  "copy this listing", "clone this listing", "copy [url] to my shop", "copy
  is listing ko [account] pe copy karo", "duplicate this Etsy listing",
  "yeh winning listing copy karo", or names a specific listing and asks to
  replicate it as a starting point for a new draft. Use this — not
  etsy-create-listing directly — whenever the source of truth is an
  EXISTING Etsy listing rather than a supplier/dropship URL or a
  from-scratch product brief; this skill reuses etsy-create-listing's
  operational steps (shipping/processing profile, update_listing_inventory,
  personalization, image upload, listings-record sync) but sources
  variations/images from the cloned listing and
  title/tags/description/price/shipping/category/personalization from
  fresh research or explicit user confirmation instead.
---

# Etsy Copy Listing — Clone the Structure, Research the Copy, Build Once

This skill exists for a specific, explicit strategy: take a proven/"winning"
listing (yours or anyone else's), clone its variation structure and every
image as-is (100% unedited), but research and write an original
title/tags/description **before** the draft is created, so the draft
exists exactly once with its real, optimized copy already in place — never
a placeholder that needs a follow-up rewrite. Price is never inherited from
the source — the user is always asked what to charge — and
shipping/processing is always standardized to this shop's 3-5 day default
rather than copied. **Category and personalization are always explicitly
confirmed too**, never silently carried over from the source: the source's
current category is shown and the user picks reuse-it-or-change-it, and
whether the listing is personalized at all is decided fresh each run based
on what the product looks like, not just whatever state the source
happened to be in. Images stay as the source listing's own photos for now
(a clothing/apparel clone additionally requires a size-chart image in the
gallery); the user swaps the product photos in on their own timeline,
separately from this skill's job. It reuses
`../etsy-create-listing/SKILL.md`'s operational machinery (shipping,
variations, personalization, images, listings-record sync) rather than
reimplementing any of it — read that file's Steps 3-8 for the exact
mechanics referenced below.

## Standing rule — variation structure clones verbatim; price, shipping, category, and personalization never do; images clone 100% as-is; copy is always researched

Don't confuse "copy the listing" with "copy the words," "copy the price,"
"copy the shipping time," "copy the category," or "copy the
personalization." What gets cloned byte-for-byte from the source listing:

- Quantity, materials, styles, type.
- The full variation/inventory *structure* (property names, values,
  per-SKU SKU) — **except price**, which is always asked (see Step 3).
- Personalization questions, **if confirmed** — cloned as a draft, but
  always **shown to the user as a readable list and explicitly confirmed**
  before the write (see Step 4.3), never silently reused just because the
  source has them. The decision to personalize at all is always confirmed
  too, not just the field list — see the personalization bullet below.
- **Every image (and video, if present) in the source listing's gallery, in
  the same order, 100% as-is** — no cropping, no watermark removal, no
  picking a subset. If the source has 10 images, all 10 get uploaded, not a
  curated handful. This is a deliberate, disclosed placeholder (see the
  standing rule below), not because the images are exempt from any quality
  bar.
- **Clothing/apparel exception — a size-chart image is mandatory in the
  gallery.** If the product being cloned is a clothing/apparel item
  (taxonomy indicates apparel, or the source title/description clearly
  describes a wearable garment), the new listing's image gallery must
  include a size-chart image — in *addition* to the cloned photos, never as
  a substitute for any of them. If one of the source listing's own photos
  is already a size chart, that satisfies the requirement (it's still
  "cloned as-is"). If the source has no size-chart image, **ask the user
  for one** (the supplier's own chart, or one they provide) before treating
  Step 4's image upload as complete — don't publish a clothing listing
  without a size chart in the gallery.

What is **never** cloned verbatim:
- **Title, tags, description** — always go through Step 2's tag-seeded
  research and the full Copy QA Gate (`../_shared/etsy-seo-standards.md`)
  before they're written anywhere — same requirement as every other
  copy-drafting skill in this project, no exception carved out for this
  one.
- **Price** — the source listing's price is shown as a reference point
  only; the user is always asked what price to set, every run, even though
  everything else is being cloned (see Step 3).
- **Shipping/processing time** — always standardized to this shop's 3-5 day
  default and confirmed with the user, regardless of whatever
  processing/shipping window the source listing actually uses (see Step
  3).
- **Category (`taxonomy_id`)** — the source listing's existing category is
  always shown to the user, never silently reused. Ask explicitly: keep
  the same category the source listing uses, or pick a different one? (see
  Step 3).
- **Whether the listing is personalized at all** — even when the source
  listing already has `personalization_questions` configured, or clearly
  has none, always confirm directly with the user based on what the
  product actually looks like (title, description, images) — don't just
  mirror whatever state the source happened to be in (see Step 3).

The point of researching copy *before* creating the draft (rather than
cloning placeholder text and rewriting later) is that the draft only ever
needs to be written once with its real copy — there is no separate "no-QA
placeholder" phase for text at all in this skill's flow.

## Standing rule — flag the image-copyright reality once, plainly, every run

Cloned images are the **source listing's own product photos** — a
different, more direct risk than a supplier's mockup gallery (which a
supplier like Merchize *wants* sellers to reuse): if the source is another
seller's listing, these are that seller's own copyrighted photos. State
plainly in the final summary of every run that the images are a temporary
placeholder copied from the source listing and should be replaced with the
user's own photos before/while making the listing public — this is the
user's own explicit stated plan for this workflow, so it's a disclosure,
not a blocking question, but it must appear every time, not just be assumed
understood after the first run.

## Workflow

### Step 0 — Resolve the source listing and target account

- Get a `listing_id` or a listing URL from the user; if a URL, extract the
  numeric ID from it (Etsy listing URLs are `etsy.com/listing/<id>/<slug>`).
- Confirm the **target account** to clone into — use the session's already
  active account if one is set (per this project's session-account-context
  rule in `CLAUDE.md`), otherwise ask. The source listing can belong to
  *any* shop, including the target account's own shop — all the reads in
  Step 1 are public/read-only and work regardless of who owns the source.

### Step 1 — Read the entire source listing (read-only, no confirmation needed)

Pull everything before researching or building anything:

- `get_listing_details` with `includes: [Images, Videos, Inventory]` — full
  field set: title, description, tags, materials, styles, price, quantity,
  who_made, when_made, taxonomy_id, type, processing_min/max,
  shipping_profile_id (the ID only — see the shipping caveat below).
- `get_listing_inventory` (or `get_listings_inventory_by_ids` for a batch) —
  full variation structure: `products` array, `property_values`
  (`property_id`/`property_name`/`values`), `offerings`
  (`price`/`quantity`), and the `*_on_property` arrays.
- `get_listing_personalization` — full `personalization_questions` if the
  source listing has any (public endpoint, no OAuth needed, works on any
  listing_id).
- `get_listing_images` / `get_listing_videos` — the full ordered
  image/video URL list.

**Known gap — shipping cost isn't actually clonable.** `shipping_profile_id`
on the source listing is visible, but the actual per-destination costs
behind it are only readable via `get_shop_shipping_profile`, scoped to the
*caller's own* shop — you cannot read another shop's real shipping profile
numbers through this API. Reuse one of the *target* account's own existing
shipping profiles (present a pick-list like `etsy-create-listing` Step 3
does) rather than pretending to clone the source's exact costs.
`processing_min`/`processing_max` from the source listing itself, however,
*is* public and can be matched against the target account's processing
profiles directly.

### Step 2 — Tag-seeded research, BEFORE the draft exists

Do this before any write, using the source listing's own tags as the seed:

1. Take the source listing's own tags (all of them, or the most specific
   5-6 if there are near-duplicates) as the seed keyword set — **do not**
   start from a generic/user-picked keyword the way
   `etsy-new-listing-copywriter` normally does, and skip that skill's own
   Step 1 benchmark-sourcing question (the seed is already decided here).
   Check `../_shared/tags-database-guide.md` first for a matching saved
   category before researching fresh.
2. **Execute `etsy-new-listing-copywriter`'s Phase 1 Steps 2, 2b, and (if
   the target account has qualifying winners) 3 exactly as written there —
   don't paraphrase or re-summarize that logic locally.** This means: the
   full Step 2 extraction (relevance-screened, favorer-weighted benchmark
   sample; title anatomy; tag-frequency table; price *and* shipping with a
   concrete price recommendation; description openers; the personalization
   tally, which this skill needs for its own Step 3 personalization
   question below; gaps; seasonal check), then **Step 2b's tag-priority
   conversation with the user** (common vs unique, which the user must
   weigh in on — never let this skill auto-pick the 13 tags from the
   frequency table alone, same rule as the copywriter itself), then Step
   3's internal-benchmark pass against the target account's own winners if
   it qualifies. This can be delegated to a subagent for the heavy
   aggregation work, same as the copywriter's own flow.
3. Generate an original title (front-loaded, distinct comma-separated
   angles, 130-139 chars) and 13 new tags, following
   `../_shared/etsy-seo-standards.md`'s field rules — driven by the
   keyword research from step 2 (what's actually working across
   top-ranking competitor listings for the seed tags), not just the
   source's own tags reworded. **Carry the best researched keywords into
   the description too**: whenever the research turns up strong,
   well-performing tags, weave the corresponding phrasing into both the
   meta title and the description's opening hook, well-optimized — this is
   the actual point of tag-seeded research, not just filling the tags
   field. The description still doesn't need the same word-for-word
   competitor-frequency treatment as title/tags, but it should reflect the
   same researched keywords, not be an independent rewrite of the source's
   own description text.
4. **Run the full Copy QA Gate** on title/tags/description before moving
   on — this is the listing's real, permanent copy, not a placeholder.
   Present it to the user for confirmation before Step 4 builds the draft.

### Step 3 — Category, price, shipping/processing (3-5 days), personalization — all always confirmed

**Batch these four into one decision message** — category, price, shipping,
and personalization are independent decisions with no ordering dependency
on each other, so ask all four together ("1. Category: source uses X — keep
it or change? 2. Price: source charges Y — what should this one charge?
3. Shipping: profile Z at 3-5 days — ok to use? 4. Personalize: source
has/hasn't got personalization set up — should this clone?") rather than
four separate round trips. Accept the answers in any combination; only
proceed to Step 4 once all four are explicitly settled.

- **Category (`taxonomy_id`) is always confirmed, never silently reused.**
  State the source listing's current category plainly (id and name — look
  the name up via `etsy-docs`/`get_taxonomy_properties` if `get_listing_details`
  didn't already return it readably) and ask the user directly: **use this
  same category, or pick a different one?** If they want a different
  category, resolve the new one the same way `etsy-create-listing` Step 3
  does (look it up, don't guess a raw id) and confirm that instead. Don't
  proceed to Step 4 until the category is explicitly settled either way.
- **Price is always asked, never inherited.** Show the source listing's
  price (and, if the source has multiple variants at different prices, the
  per-variant spread) purely as a reference point, then ask the user what
  price to set on the new draft — a single price, or per-variant prices if
  the source has priced variants differently. Don't proceed to Step 4 until
  they've given an explicit number (or numbers).
- `type` — taken directly from the source listing's `listing_type`.
- **Shipping/processing is always standardized to 3-5 days, and always
  confirmed before use** — this shop's standing default, independent of
  whatever processing/shipping window the source listing itself actually
  uses. Look for an existing target-account shipping profile whose
  processing time is 3-5 days; if none fits, create one
  (`create_shop_shipping_profile`, confirmed write, per the base-profile
  gotchas in `CLAUDE.md`) with `min_processing_time: 3`,
  `max_processing_time: 5`. Show the user which profile (existing or
  newly-created) will be used and get an explicit yes before Step 4 uses
  it — never silently reuse whatever profile happens to be the account
  default.
- `readiness_state_id` — pick or create a processing profile on the target
  account matching the same 3-5 day window (via `get_processing_profiles`),
  not the source listing's own `processing_min`/`max`.
- **Personalization — whether to include it at all is always confirmed,
  independent of what the source listing has.** Look at the source
  listing's title/description/images for any personalization signal (a
  name, initials, text, photo, size customization, "add your own X," etc.),
  then explicitly ask the user to confirm: should this clone be a
  personalized/customizable listing? Don't just infer it from whether
  `get_listing_personalization` happened to return questions on the
  source — a source listing can have stale/misconfigured personalization,
  or can look personalized in its copy without actually having the
  question set up. If confirmed yes, the source's own
  `personalization_questions` (if any) are the starting proposal shown to
  the user in Step 4.3 — not auto-applied. If confirmed no, skip Step 4.3
  entirely even if the source had questions configured.

### Step 4 — Build the draft (one shot, real copy from the start)

Follow `../etsy-create-listing/SKILL.md` Steps 4 through 7, with
title/tags/description from Step 2, category/price/shipping/processing
(3-5 days) all confirmed in Step 3, and quantity/materials/styles plus the
variation/image *structure* cloned from the source (personalization only
if Step 3 confirmed it):

1. `create_draft_listing` — confirmed write. Payload = Step 2's researched
   title/tags/description + the user-confirmed category (`taxonomy_id`)
   from Step 3 + the user-confirmed price from Step 3 + materials/styles
   cloned from the source + type/shipping/processing (3-5 days) from
   Step 3.
2. `update_listing_inventory` — confirmed write, rebuilding the source's
   `property_values`/`offerings` *structure* (property names, values,
   per-SKU quantity/SKU) against the *new* listing_id and the target shop's
   own `readiness_state_id` — but with the **user-confirmed price(s) from
   Step 3**, not the source's own per-SKU prices. Standard-property
   `value_id`s from the source can usually be reused as-is (they're
   taxonomy-wide, not shop-specific); custom-property slots (513/514/516)
   just need the same `property_name` and freeform `values` text
   recreated — new `value_id`s get auto-assigned.
3. `update_listing_personalization` — **skip entirely if Step 3's
   personalization confirmation came back no.** If it came back yes, show
   the user the exact list of personalization questions proposed (starting
   from the source's own questions if it had any, or built from scratch
   with the user if it didn't) — question text, type, required/optional,
   character/file limits — and get an explicit confirmation on that list
   specifically before writing. Once confirmed, submit
   `personalization_questions` (dropping each source `question_id`, since
   those are fresh on the new listing).
4. Images — download **every** source image URL (all of them, 100% as-is,
   no subset) to a local temp file, then `upload_listing_image` one at a
   time in the same order, each its own confirmation (same "one
   confirmation per image" rule as `etsy-create-listing`). The separate
   image-copyright disclosure above (about the photos being the source
   listing's own, not this shop's) still applies.
   **If the product is clothing/apparel**, confirm a size-chart image is
   included in this upload sequence (from the source's own gallery if it
   has one, otherwise ask the user for one) before treating this step as
   complete — see the Standing rule above.
5. Sync the listings-record file per `../_shared/listings-record-guide.md`
   after each successful write, same as always. Add a `cloned_from` field
   to the record (source `listing_id` and URL) so the lineage is
   traceable later.

### Step 5 — Final summary

Report, in the same shape as `etsy-create-listing`'s final summary:

- `listing_id`, URL, state (draft), source listing it was cloned from.
- What was cloned as-is (quantity, materials, styles, variation structure,
  images — confirmed with the user along the way) vs. what was freshly
  researched and QA-passed (title, tags, description) vs. what the user
  explicitly decided rather than the source (category/`taxonomy_id`, price,
  shipping/processing — always 3-5 days, and whether the listing is
  personalized at all).
- State plainly which category was used (same as the source, or a
  different one the user picked) and whether personalization was included
  and why (matched the source's own questions, built fresh, or turned off
  even though the source had it).
- **Repeat the image disclosure plainly**: images are the source listing's
  own photos, copied 100% as-is as a placeholder — replace them with the
  user's own photos before/while making the listing public.
- If the product is clothing/apparel, confirm in the summary that a
  size-chart image is present in the gallery (and note whether it came from
  the source or was supplied by the user).
- Offer `etsy-listing-qa-check` on the listing, and offer to save a product
  template per `../_shared/product-templates-guide.md` if this clone is
  likely to get republished to other accounts too.
