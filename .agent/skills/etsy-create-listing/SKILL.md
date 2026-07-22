---
name: etsy-create-listing
description: >-
  The full guided, end-to-end creation of a BRAND-NEW Etsy listing — from
  "physical or digital?" through research-backed copy, the confirmed
  create_draft_listing call, variations (sizes/colors with per-variant
  price/quantity/sku via update_listing_inventory), image and video uploads,
  and attaching the actual digital deliverable file for download listings.
  Trigger this whenever the user says things like "I want to create a listing",
  "create a new listing", "list a new product", "help me add a physical
  product", "help me add a digital product", "list a new item on Etsy",
  "create a draft listing", "set up a listing with sizes/colors", "make a
  listing and upload the images", "create a digital download listing", "here's
  a product URL, publish it on my Etsy account", "publish this product to
  [account]", "list this on [account] too", or any request to actually build a
  complete new listing on Etsy rather than just write its text — including a
  bare URL plus a publish instruction with no further detail, since a saved
  product template (see product-templates-guide.md) may already cover it. Use
  this — not etsy-new-listing-copywriter alone — when the creation flow needs
  type handling (physical vs digital), variants, image attachment, or a
  digital-file upload; use etsy-new-listing-copywriter alone when the user
  just wants the research-backed copy text, or a simple draft with no
  variants/images/files needed. This skill reuses etsy-new-listing-copywriter's
  Phase 1 (research) and Phase 2 (generation, through its mandatory Copy QA
  Gate) for the copy itself — it never reimplements that research — and then
  owns everything operational that comes after the copy exists. Before
  starting fresh research, it also checks for a previously saved product
  template (by source URL) so republishing the same product to a different
  account skips straight to the account-specific steps.
---

# Etsy Create Listing — Full Guided Creation, End to End

This is the orchestrator skill for building a complete new listing, not just
its text. `etsy-new-listing-copywriter` produces launch-ready title/13-tags/
description and can create a bare draft; this skill wraps that and owns what
the copywriter skill deliberately doesn't: the explicit **physical vs digital**
branch (the `type` field), the operational required fields
(`quantity`/`who_made`/`when_made`/`taxonomy_id`/shipping profile),
**variations** (sizes, colors — a separate `update_listing_inventory` step
after the draft exists), **image/video uploads**, and — for digital products —
attaching the actual **deliverable file** the buyer downloads. When this skill
finishes, the listing is genuinely assembled, not a photo-less text shell.

Skills in this project are behavioral playbooks for the same agent, so
"reuse" here is literal: when this workflow reaches the copy step, execute
`../etsy-new-listing-copywriter/SKILL.md`'s Phase 1 and Phase 2 exactly as
written there (including its Copy QA Gate and pre-flight validation), then
return here and continue. Do not duplicate or paraphrase that research logic
in-session — read that file and follow it.

Every tool below accepts an optional `account` argument; pass it if the user
names a specific shop, otherwise the default account is used.

**Field rules live in `../_shared/etsy-seo-standards.md`** (title/tag/
description limits, materials/styles format, the Copy QA Gate). Field names
below are verified against the live Etsy API schema (`etsy-docs` MCP,
`createDraftListing`/`updateListingInventory`) — if anything is still
uncertain at payload-build time, confirm via `etsy-docs` (`get_endpoint`,
`search_etsy_api`), never guess.

## Workflow

**Batching note:** Steps 0a, 1, 1b, and 1c below are four separate
questions (core name, physical/digital, variants, personalization) with no
ordering dependency between them — ask them together in one intake message
rather than as four separate round trips, and collect at least one image
path in the same message too (see the batching note at the end of Step 1c
for the full reasoning). Each still needs its own explicit answer; batching
the *asking* is what's being optimized here, not the *confirming*.

### Step 0a — Get the product's core name first

**Standing rule: before anything else, always ask for (or confirm) the
product's plain core name** — a short, concrete phrase for what it actually
is (e.g. "embroidered pillow case", "engraved dog tag", "SVG bundle of
sunflowers"). Don't proceed to physical/digital branching, template lookup,
or research on a bare source URL or a vague description alone — a clear core
name is what makes the rest of the flow (template matching, keyword
research, taxonomy lookup) targeted instead of guesswork. If the user already
stated it plainly in their request, just restate it back in passing to
confirm rather than asking cold; only pause and ask outright when it's
genuinely unclear what the product is.

### Step 0b — Check for a reusable product template

Before anything else: if the user's request includes a source URL (a
supplier/dropship product page, e.g. Merchize) or names a product that sounds
like it may have been built before, check for a saved template per
`../_shared/product-templates-guide.md`. A match means Steps 1-3's
research/copy/taxonomy/materials/variant-structure/pricing work can be
skipped entirely and pulled straight from the template — **but every write
step (shipping/processing profile, `create_draft_listing`,
`update_listing_inventory`, each image upload) still happens fresh and still
needs its own confirmation**, since those are account-specific or otherwise
genuinely new for this run. Skip this step with no output if the request
clearly isn't sourced from a URL and doesn't name an existing product (a
plain "let's create a new mug listing" with no prior context needs no check).

### Step 1 — Physical or digital?

Ask whether the listing is **physical or digital**. If the user's description
already makes it obvious (e.g. "an SVG bundle" or "a ceramic mug"), state the
inference and confirm it in passing rather than asking cold — but if there is
any ambiguity, resolve it before anything else, because this answer drives the
`type` field, the shipping-profile requirement, and the digital-file step:

- **Physical** → `type: physical`, `shipping_profile_id` required, variations
  possible, no deliverable file.
- **Digital** → `type: download`, no shipping profile, a deliverable file must
  be uploaded after the draft exists.
- **Both** (sold physically AND as a download) → `type: both` — rare; needs
  the shipping profile AND the file.

### Step 1b — Single product, or does it have variants?

Right after settling physical/digital, ask whether this is a **single
product** or has **variants** (sizes, colors, styles, etc.) — before any
research starts, not later in Step 3. This early answer shapes what research
needs to cover (a variant product needs research on how competitors title/
tag *and price* across their own variants) and confirms up front whether
Step 5's `update_listing_inventory` step will run at all.

- **Single product** → no variant structure to plan; Step 5 is skipped
  later.
- **Has variants** → ask for the option sets now if the user already knows
  them (e.g. "Small / Medium / Large", "Red / Blue / Green") and whether
  price/quantity/SKU differs per option — a rough answer is fine here, it
  gets finalized against real API property/value IDs in Step 5. Flag Etsy's
  hard limit up front: **max 2 variation properties per listing**.

### Step 1c — Personalization: always confirm when the data suggests it

**Standing rule, universal — not just the Merchize/AliExpress-specific
checks in Step 3 below.** Look at whatever's actually in hand right now
(the product's core name from Step 0a, the user's own description, a
supplier source page if there is one) for any signal that a buyer
customizes this item at checkout — a name, initials, text, a photo, a
size/date, a monogram, "add your own X," etc. Whenever that signal is
present, **explicitly ask the user to confirm it's a personalized/
customizable product** — even when it seems obvious from the name (e.g.
"personalized dog tag," "custom name necklace") — and even when it seems
obviously *not* personalized. Never silently infer either way and carry
that guess forward unconfirmed. This confirmation is what:
- Decides whether Step 4b's `update_listing_personalization` runs at all.
- Feeds the `when_made: made_to_order` standing rule below for confirmed
  personalized items.
- Determines whether Step 3's supplier-capability check (can the artwork
  actually flow through to production, Merchize/AliExpress or otherwise)
  needs to happen at all.

If the user confirms it's personalized, ask what the buyer actually needs
to submit (name/text, photo, size, etc.) right here so Step 4b isn't
starting from scratch later — a rough answer is fine, it gets finalized
against research (if run) in Step 4b.

### Standing rule — batch the intake questions, and pull the image ask forward

Steps 0a, 1, 1b, and 1c ask four independent questions — core name,
physical/digital, variants, personalization — none of which depends on the
answer to another. Asking them one at a time across four separate messages
costs the user four round trips for no ordering reason. **Batch them into
one intake message** ("What's the product, is it physical or digital, does
it have variants, and is it personalized?") and accept the answers however
they come back, still confirming each explicitly rather than assuming.

**Also pull the image-path request forward into this same intake message**
("and have your image files ready — I'll need at least one local path
before the draft can be created") rather than waiting until Step 3's image
step, deep after the research/copy work is already done. Asking early means
a "no images yet" answer pauses the flow *before* time is spent on
research/copy that would otherwise sit finished and unusable — see Step 3's
hard block on this same requirement.

### Standing rule — reused templates across accounts

A saved product template (`../_shared/product-templates-guide.md`) may have
first been written for a *different* account. Before reusing its copy/images
on a new account, re-check that nothing in it references the account it was
originally written for either — copy should match whichever account it's
being published to now, never a prior one.

### Step 2 — Research first? Then get the copy

Ask whether the user wants **research done first**.

- **Yes:** ask the same benchmark-sourcing question used across this skill
  set: "Do you already have preferred keywords/tags you want used, do you
  want to give me 2-3 top-ranking listings so I can analyze their tags into
  common vs unique and we decide together, or should I search myself?" Then
  execute `etsy-new-listing-copywriter`'s **Phase 1 (Research)** and
  **Phase 2 (Generation)** exactly as documented in that
  file — its product brief, benchmark selection, tag frequency analysis,
  internal-benchmark check, pre-flight validation, and mandatory Copy QA Gate
  all apply unchanged. When that skill's copy-paste report exists (title,
  full 13 tags, description), return here to Step 3. Do not stop at that
  skill's "want me to create a draft?" offer — this skill owns the creation
  flow from here.
- **No:** collect a minimal brief directly (what the product is, materials/
  files included, intended price, who it's for) and draft the title, 13 tags,
  and description against `../_shared/etsy-seo-standards.md`'s field rules.
  **Still run the Copy QA Gate from that shared file before presenting any
  copy** — skipping research never means skipping the gate. Label the copy as
  un-researched so the user knows it's theory-grounded, not market-grounded.

Either way, nothing proceeds to Step 3 until the user is happy with the copy.
If they tweak it, re-run the Copy QA Gate against the tweaked text.

### Step 3 — Collect the operational fields (branch on Step 1)

**Supplier SKU/pricing sheet — mandatory first, when sourced from Merchize (or any supplier that ships one)**

Before asking anything else in this step: if the product came from Merchize
(or the user names another supplier that provides a per-product SKU/pricing
spreadsheet), **that sheet is a hard requirement, not optional** — never
build variants, a price, or a shipping profile from memory, estimation, or
a prior listing's numbers. Ask for the absolute local path to the file (or
the pasted data) and read it before continuing with anything else in this
step.

Merchize's sheet format (confirmed from the shop's real files):

- Columns: `SKU product`, `Printing method`, `SIZES`, `SKU variant` — one row
  per variant combination.
- **Tier-wise pricing** — Merchize prices vary by order-volume tier; **this
  shop always uses Tier 1** pricing. Confirm the sheet's Tier 1 column/section
  before reading any cost — never pull a different tier's numbers by mistake.
- Per-product, also unique and required reading: **base cost**, **shipping
  cost** (varies by destination country/region — read every row/column
  Merchize provides, don't assume one flat worldwide rate), **minimum/maximum
  production time**, and **extra item cost** (the marginal cost for each
  additional unit in the same order — this maps to the Etsy shipping
  profile's `secondary_cost`, distinct from the first-item `primary_cost`).

**Also check the supplier's own product page for what it needs to actually
personalize the item** — separate from pricing/shipping. Look for the
supplier's own "customizable"/"design template"/"mockup" instructions (e.g.
Merchize product pages link a "Download Mockup & Template" file and note
whether printing is DTF/DTG, and whether it's produced per-order or from a
design prepared once). This tells you whether a buyer's Etsy
personalization-box text (a name, initials, a date) actually flows through
to production automatically, or whether the shop has to manually build each
order's artwork from the template before sending it to the supplier — **don't
assume either way.** If the supplier's page doesn't say and it isn't
obvious, flag this as an open question for the user before promising a
personalization box the shop can't actually service unattended.

Once the sheet is read, **before building any price or shipping payload, ask
the user two required questions in one batch — never assume a markup:**

1. **Base price markup** — how much to add on top of Merchize's Tier 1 base
   cost per variant? Get an exact flat amount or percentage from the user;
   compute `price = base_cost + markup` (flat) or `base_cost * (1 + pct)`
   (percentage) per SKU/variant accordingly. State which formula was used
   in the confirmation payload.
2. **Shipping markup** — should that same markup also apply to the shipping
   cost, or should shipping be passed straight through unchanged?
   - **Yes** → apply the same markup rule to `primary_cost`/`secondary_cost`
     when building the shipping profile.
   - **No** → use Merchize's shipping cost and extra-item cost exactly as
     given (zero added margin) for `primary_cost`/`secondary_cost`.

**Standing rule — Everywhere Else / ROW shipping is always $10-15**, regardless
of what any individual product's markup answer above says. When building the
catch-all "everywhere else" destination (no `destination_country_iso`/
`destination_region` set — see Step 3's shipping-profile-destination
guidance): if the SKU sheet's own ROW/rest-of-world column gives a shipping
fee, use it as long as it falls in (or reasonably close to) the $10-15 band;
if the sheet gives no ROW figure at all, pick a value at random within
$10-15 rather than asking the user or defaulting to a fixed number every
time. Named-region destinations (US, CA, GB, EU) are unaffected — this only
governs the final "everywhere else" catch-all bucket.

**AliExpress — sourcing rules (parallel to the Merchize section above, but this supplier has no formal SKU/pricing sheet)**

When the product came from an AliExpress product page, there is no
spreadsheet to read — and unlike Merchize/other suppliers, **do not attempt
to scrape images, variations, pricing, or shipping/delivery time off the
AliExpress page.** The shop owner supplies all of that directly (confirmed
standing instruction, since automated scraping of AliExpress proved
unreliable in practice — heavy client-side rendering, geo-localized
pricing/currency, and this project's browser tooling repeatedly timing out
trying to screenshot/read the page). This narrows this skill's own job on
the AliExpress page down to one thing: **read the product description/
specifications text** (via a plain text fetch of the page, not screenshots)
to inform Step 2's research/copy — the same way any other research source
feeds the copywriter, nothing more.

Per-field split of responsibility for AliExpress-sourced listings:

- **Product core name** — the user states it directly (Step 0a still always
  asks/confirms it explicitly, per the standing rule above).
- **Variations** — the user provides the option sets directly (e.g. which
  color/design numbers or names, which sizes) — do not scrape swatches or
  dropdowns off the page. Still follows the normal Step 1b/Step 5 flow (max
  2 variation properties) once the user's option sets are in hand.
- **Media, including the size chart** — the user provides the image URLs or
  local paths directly, **including the size chart image for clothing/
  apparel items** — do not pull images from the AliExpress page
  automatically. Add the size chart to the listing's image set (a normal
  `upload_listing_image` call, its own confirmation) — treat "size chart
  provided and uploaded" as a required item on the Step 3b Completeness Gate
  check for any AliExpress-sourced clothing listing, don't let one reach
  Step 4 without it.
- **Pricing** — the user provides the actual base cost directly (never
  compute it from a geo-localized/converted page price). Base price markup
  still follows the universal standing rule below (always ask, every time).
- **Shipping cost — hard-coded flat rule, no markup question needed, and reuse one standing profile.**
  Every AliExpress-sourced listing uses these exact flat shipping rates
  regardless of what AliExpress itself charges or what markup would
  otherwise apply (updated 2026-07-22 per explicit user instruction,
  superseding an earlier USA/UK 4.99, Canada 5.99, Europe 6.99 table):
  **USA free, UK free, Europe 4.99 USD, Rest of World (catch-all, including
  Canada — folded in since the user's latest instruction only named 4
  tiers) 9.99 USD.** Before creating a new shipping profile, call
  `get_shop_shipping_profiles` and check for one already titled
  "AliExpress Shipping" on the target account — **reuse its
  `shipping_profile_id` rather than creating a duplicate profile every
  time.** Only create it once per account (confirmed write, same as any
  shipping profile creation) the first time this skill handles an
  AliExpress-sourced listing on that account; every AliExpress listing
  after that just reuses the same `shipping_profile_id`. Build it with
  `primary_cost` values of 0/0/499/999 (cents) for the US/GB/EU-region/
  catch-all destinations respectively — skip the Merchize-style
  base-cost+markup shipping calculation entirely for AliExpress products.
  Default `secondary_cost` to match `primary_cost` on each destination
  unless the user says otherwise. **This flat rate table is a standing
  default, not a one-time answer** — keep using it for every future
  AliExpress-sourced listing without asking again; only change it if the
  user explicitly says to change the shipping for a listing (their own
  stated condition for when this default should be revisited).
- **Processing time — reuse the shop's existing 3-5 day profile, don't
  create a new one.** Call `get_processing_profiles` and use whichever
  existing profile is already set to `processing_min: 3` / `processing_max: 5`
  for every AliExpress-sourced listing. Only fall back to
  `create_processing_profile` (its own confirmed write) if no such profile
  exists yet on this account.
- **Delivery/shipping time — the user provides it directly.** Do not try to
  read an estimated delivery date off the AliExpress page (it's
  geo-localized and unreliable without an order-date reference — confirmed
  in practice). Ask the user for the expected delivery-day range and use
  that as the shipping profile destination's `min_delivery_days`/
  `max_delivery_days`. Show the figures in the shipping-profile confirmation
  payload and get explicit confirmation before creating it.
- **Customization — always ask explicitly, never infer.** Confirm directly
  with the user whether this AliExpress product is a **customizable/
  personalized item** (buyer submits a name, photo, text, or size at
  checkout) or a **normal, non-personalized item** — AliExpress listings
  don't reliably state this the way a Merchize product page does. This
  answer decides whether Step 4b's `update_listing_personalization` step runs
  at all, and feeds the `when_made: made_to_order` standing rule below for
  personalized items.

**Standing rule — always ask for the exact price to set, every single
listing, no exceptions.** Never silently reuse a previous listing's markup
formula or assume "same as last time" even if the user gave one earlier in
the same session — always ask explicitly what price (or markup rule) to use
for *this* product before computing anything. A markup formula from an
earlier listing is a hint, not a standing default. **If Step 2's research
ran, restate its concrete price finding inline in the same question rather
than asking blind** — e.g. "research shows this niche averaging $X (landed
$Y with shipping), with a suggested price of $Z because <reason> — what
price should I set?" The user still decides every time; they just decide
with the number already in front of them instead of having to ask for it
back.

**Standing rule — `price` cannot be changed via `update_listing` once the
draft exists.** Confirmed via `etsy-docs`: `updateListing`'s request body has
no `price` field at all. Calling `update_listing` with a `price` argument
does not error — it returns 200 with the price silently unchanged, which
reads as success unless the returned value is checked. **Any price change
after `create_draft_listing` must go through `update_listing_inventory`**
(Step 5's endpoint), even for a listing with no real size/color variants —
call `get_listing_inventory` first to get the auto-generated single-product
record, then resend it with the updated `offerings[].price`. Always re-fetch
after any price-change call and confirm the number actually moved before
telling the user it's done.

Show both markup answers plainly in the write-confirmation payload (Step 4/Step 5's
report) so the markup is visible next to the numbers it produced, not hidden
inside a pre-computed price. Save the sheet's absolute path to
`supplier_sku_sheet_path` and the exact markup rule (e.g. "Tier 1 base cost +
$8 flat, shipping passed through with no markup") into the product
template's `variants.pricing_markup` per
`../_shared/product-templates-guide.md`, so a future republish of the same
product doesn't require re-reading the sheet from scratch — but always
re-confirm with the user that the saved markup numbers still apply before
reusing them, since markup strategy can change between runs.

**Universal (both types)** — all verified required fields of
`createDraftListing`:

- `quantity` (int) — **standing rule: always 999 for physical listings, no
  question asked.** For digital listings, 999 is also the shop default;
  still don't ask unless the user wants something else.
- `title`, `description`, `price` — from Step 2's approved copy.
- `who_made` — enum `i_did` | `someone_else` | `collective`. **Standing rule
  — never let this block the flow:** `who_made: "someone_else"` requires the
  target account to have at least one declared Production Partner on file, or
  `create_draft_listing` fails opaquely. Check with `get_shop_production_partners`
  (read-only, no confirmation) before building the Step 4 payload. If it
  returns a partner, use `who_made: "someone_else"` + `production_partner_ids`.
  **If it returns `count: 0`, do not stop and ask the user whether to add one
  — use `who_made: "i_did"` instead and continue the flow.** This is the
  shop's accepted standing practice (confirmed on `itrat_etsy`, which has zero
  production partners and where every existing supplier-sourced listing
  already uses `i_did`) — don't re-raise it as a blocker, just state which
  `who_made` value was used in the Step 4 confirmation payload so the user
  sees it.
- `when_made` — enum: `made_to_order`, `2020_2026`, `2010_2019`, `2007_2009`,
  `before_2007`, `2000_2006`, `1990s` … `1700s`, `before_1700`. **Standing
  rule: any custom/personalized product (buyer supplies a name, photo, text,
  size customization, etc. at purchase) always gets `made_to_order`** — don't
  ask, it's inherent to the product type.
- `taxonomy_id` (int) — the category. **Always confirmed with the user,
  never silently chosen.** Resolve a best-inferred candidate from the
  product brief (look it up via the `etsy-docs` MCP —
  `search_etsy_api`/`get_endpoint` — never guess a raw number with no
  lookup behind it), then **present the category name and id to the user
  and ask them to confirm it or name a different one** before it goes into
  the Step 4 payload. Don't treat "the live `create_draft_listing` call
  will reject a bad id anyway" as a substitute for asking — a wrong-but-valid
  category (e.g. a mug filed under "Home Decor > Wall Art" instead of
  "Kitchen & Dining > Drinkware") won't error at all, it'll just misfile
  the listing silently. If the user gives their own category instead,
  look that one up and confirm it resolves to a real taxonomy id the same
  way.
- `type` — set it **explicitly on the create call** from Step 1's answer
  (`physical` | `download` | `both`). Never leave it to the API default.
- `shop_section_id` — call `get_shop_sections` and offer a short pick-list
  (or "no section" as an explicit choice, not a silent default) — sections
  drive the shop's own storefront navigation, and a listing that never gets
  asked about one quietly skips a real merchandising field.
- `return_policy_id` — call `get_shop_return_policies` and offer a pick-list
  the same way. Applies to physical and digital listings alike; don't skip
  asking just because the product is a digital download.

**Physical branch:**

- `shipping_profile_id` — **required when `type` is `physical`**. Call
  `get_shop_shipping_profiles` and present a short pick-list of the shop's
  existing profiles (name, cost, processing time) — don't ask the user to
  know a raw ID. Only if none fit, offer to create one via
  `create_shop_shipping_profile` (needs `title`, `origin_country_iso`,
  `primary_cost`, `secondary_cost`, min/max processing days) — that is its
  own separately-confirmed write, with its own payload shown and its own
  explicit "yes" before calling.
- `readiness_state_id` — **also required when `type` is `physical`**
  (confirmed live: omitting it fails `create_draft_listing` with `"A
  readiness_state_id is required for physical listings."`). Call
  `get_processing_profiles` alongside the shipping-profile lookup above and
  present its existing profiles (processing days) the same way; only offer
  `create_processing_profile` if none fit, as its own separately-confirmed
  write.
- `materials` — **not optional in practice: get at least 1 real material for
  every physical listing**, even a one-word answer ("cotton", "ceramic").
  It's a genuine filtered-search field on Etsy, and a listing that skips it
  is quietly less discoverable. Array, letters/numbers/whitespace only —
  see the shared standards file.
- `styles` (array, up to 2, each ≤45 chars, letters/numbers/whitespace
  only) — **must get an explicit answer or an explicit "skip" before
  `create_draft_listing`, never silently omitted.** This field is
  **create-only**: `update_listing` has no `style`/`styles` field at all, so
  a skipped-now styles field is permanently lost, not deferred — the only
  way back is deleting and recreating the draft or editing manually in
  Etsy's own UI. Ask for it here, and make sure the user actually answers
  (yes or explicit no) rather than the question quietly going unanswered.
- Also worth asking in the same batch, genuinely optional: `item_weight` /
  `item_length` / `item_width` / `item_height` with `item_weight_unit`
  (`oz`,`lb`,`g`,`kg`) and `item_dimensions_unit`
  (`in`,`ft`,`mm`,`cm`,`m`,`yd`,`inches`); `processing_min`/`processing_max`.
- **Variants:** already asked in Step 1b — if the option sets or per-option
  price/quantity/SKU weren't fully pinned down there, finalize them here.
  The answers feed Step 5.

**Digital branch:**

- No shipping profile needed — don't ask for one.
- Ask for the **exact absolute local file path** of the digital deliverable
  (the file the buyer downloads) — never guess or construct a path. This
  feeds Step 7.

**Images and video (both types) — a first-class step, not an afterthought:**

- **Standing rule — try the source first:** when the product came from a
  source URL (Merchize or any supplier page), attempt to pull product images
  straight from that page/link before asking the user for anything. Only
  fall back to asking the user for an absolute local path or an image link
  when the source page has no usable images (none found or broken). Never
  skip straight to asking the user without trying the source link first
  when one exists.
- Ask for the **absolute local path(s)** of the image file(s) to attach, and
  the order they should appear in (rank 1 = first/leftmost, the thumbnail).
  `alt_text` defaults automatically to the listing's own 13 tags,
  comma-joined, per the standing rule in `../_shared/etsy-seo-standards.md`
  — don't ask about it; only depart from the default if the user
  proactively asks for custom alt text on a specific image.
- Ask whether they have a listing video (Etsy allows one) and its local path.
- **Hard block, no exceptions: do not call `create_draft_listing` until at
  least one real image path has been collected.** Per the Listing
  Completeness Gate in `../_shared/etsy-seo-standards.md`, a photo-less draft
  is an incomplete listing, not a placeholder to fill in "later." If the user
  has no image ready yet, pause the entire creation flow here — do not
  proceed to Step 4 — and resume once at least one image is provided. Never
  create the draft first on the promise that images will follow.

### Step 3b — Completeness Gate check (mandatory, before any write)

Before showing the Step 4 confirmation payload, walk the full **Listing
Completeness Gate** checklist in `../_shared/etsy-seo-standards.md` against
everything collected so far and confirm every required item for this
listing's type (physical/digital/personalizable) is actually in hand — not
merely discussed or planned. If anything required is still missing (an
image, `taxonomy_id`, `shipping_profile_id`/`readiness_state_id` for a
physical listing, a deliverable file path for a digital one, etc.), **stop
here and go get it from the user** — do not proceed to Step 4 with a gap and
a plan to patch it in afterward. State plainly which items were checked and
confirmed present before moving on.

### Step 4 — Create the draft (confirmed write #1)

Show the **complete `create_draft_listing` payload** — every field exactly as
it will be sent (see Report structure) — re-run the Copy QA Gate one final
time against the title/tags/description going into it, then stop and wait for
an explicit "yes / haan / confirm". After the call succeeds, fetch the new
listing back with `get_listing` and echo the created `listing_id`, its URL,
and the actual field values that landed — not just "success". **Then write
the listings-record file** (`data/listings/<account>/<listing_id>.json`) per
`../_shared/listings-record-guide.md` — this is mandatory, not an ask, for
every listing this skill creates.

### Step 4b — Personalization (only if the product takes buyer customization)

**Ground the field set in research, not guesswork.** If Phase 1's research
ran (`etsy-new-listing-copywriter`'s Step 2), it already tallied what
competitor listings actually ask buyers to submit for this product type
(name/text, font, color, initials, photo upload, number of lines, etc.) —
use that tally as the starting proposal for this listing's
`personalization_questions`. Cross-check it against Step 3's supplier
capability check (can the supplier actually take that field through to
production, or does the shop have to hand-build the artwork from a
template?) before finalizing. Present the proposed field list to the user
for confirm/adjust — never invent fields from scratch when live competitor
data and the supplier's own product page already show what's expected. If
research was skipped for this listing, ask the user directly what a buyer
needs to submit for the item to be made correctly.

If the product needs a buyer-facing customization box (a name, initials, text,
photo, or similar entered at checkout — common for any "custom"/"personalized"
listing), this is **not** part of `create_draft_listing` — Etsy deprecated the
old `is_personalizable`/`personalization_is_required`/
`personalization_char_count_max`/`personalization_instructions` fields on
`createDraftListing`/`updateListing` (removal date April 9, 2026, confirmed
via `etsy-docs`). Use the dedicated **`update_listing_personalization`** tool
instead, as its own separately-confirmed write right after the draft exists.

**The real request body is NOT a flat `is_personalizable`/`personalization_*`
shape** — `etsy-docs`'s `get_endpoint` misleadingly describes it that way, but
calling it with those fields fails live with `"Error: Missing input
parameter: [personalization_questions]"`. Confirmed correct shape (via
`etsy-docs`'s `get_schema` for `...ListingPersonalization` and the
`tutorials/personalization/multiple-and-new-question-type-support-examples`
guide):

- Body is `personalization_questions`: an array of question objects, each
  `{question_text, instructions, question_type, required,
  max_allowed_characters, max_allowed_files, options}`.
  - `question_type` — `text_input` for a name/text box (the common case for
    "custom"/"personalized" products), `dropdown` (needs `options: [{label}]`),
    `unlabeled_upload`/`labeled_upload` for photo uploads. **`labeled_upload`
    requires an `options` array** — one `{label}` per upload slot (e.g.
    "Front"/"Back", or "Dad"/"Mom"/"Children"), and `max_allowed_files` must
    equal the number of labels — confirmed live via `"Request failed with
    status code 400"` when `labeled_upload` was sent with no `options`. For a
    single generic photo/file field (the common case — "upload your photo"),
    use **`unlabeled_upload`** instead, which needs no `options` at all.
  - `required` — ask the user whether the buyer must fill it in to check out.
    `required: false` works fine (an earlier note in this project's docs
    claiming otherwise was wrong and has been corrected).
  - `instructions` — the prompt text shown to the buyer (e.g. "Enter the name
    or text you want embroidered").
  - `max_allowed_characters` — a reasonable limit for `text_input` (e.g.
    30-50 for a name/short phrase); ask if unsure.
- This call **fully replaces** all personalization on the listing — when
  adding to or editing existing questions, first call `get_listing_personalization`
  and include each existing question's `question_id` in the array, or that
  question is deleted.
- The endpoint also requires the query param
  `?supports_multiple_personalization_questions=true` — already baked into
  the `update_listing_personalization` tool's path in `index.ts`, nothing to
  add manually; omitting it on a raw call 409s.
- **A fresh listing's first-ever multi-question submission can 400 opaquely.**
  Confirmed live: posting 2-3 brand-new questions at once (none carrying a
  `question_id` yet) failed with `"Request failed with status code 400"` and
  no error detail, while the identical questions succeeded when added one at
  a time. The `update_listing_personalization` tool now **handles this
  automatically** (tries the full batch first, falls back to incremental
  one-at-a-time submission on failure) — build and show the full intended
  question list as normal, no need to manually split the call.

Show the constructed `personalization_questions` payload, get explicit
confirmation, then call it. Skip this step entirely for a non-personalizable
product.

### Step 5 — Variations (physical listings with variants only)

Variations are **not** set via `create_draft_listing` at all — this is a
separate step against the now-existing listing, via `update_listing_inventory`
(`PUT /listings/{listing_id}/inventory`). Every requirement below is
confirmed against the live API (`etsy-docs`'s `get_endpoint` for
`updateListingInventory`/`getListingInventory`, plus errors hit in practice)
— treat this as the authoritative checklist, not just a rough shape.

**Hard limits, confirmed from the endpoint spec:**

- **Maximum 2 variation properties per listing** (e.g. Size + Color, or here
  Type + Size). The API has a `max_variations_supported` param that mentions
  a 3rd property, but it's explicitly marked "Coming soon" in Etsy's own
  docs — do not plan for 3 today. If the product brief has more than 2
  independent variant axes, tell the user this is an Etsy platform limit and
  ask which 2 matter most (or whether some axes should collapse into one
  property's values, e.g. "Small Red" / "Large Blue" as combined values).
- **No parenthesis characters `(` or `)`** in any `property_values.values`
  string — Etsy's schema explicitly disallows them. Reword instead of using
  them (e.g. "12x18 inch" not "12x18 (inches)").

**Building the payload:**

1. Call `get_listing_inventory` on the new `listing_id`. Read the
   auto-generated default single-product inventory record and the taxonomy's
   available property/value structure — the `property_id`s and `value_id`s
   you may use come from here, not from guessing.
2. Decide **standard vs custom property** for each variant axis:
   - **Standard property** (e.g. the taxonomy's built-in "Size" or "Color",
     which ships with a fixed `possible_values` list): reference it by
     `property_id` + `value_ids` from that list. No `property_name` needed —
     Etsy already knows the property's name.
   - **Custom property** (the variant axis doesn't match anything in the
     taxonomy — e.g. "Type: 1-side Printed / 2-side Printed" isn't a
     standard Etsy property): look up the taxonomy's freeform **"Custom
     Property"** slots via the `etsy-docs` MCP (`getPropertiesByTaxonomyId`
     for the listing's `taxonomy_id` — they show up with `display_name:
     "Custom Property"` and an empty `possible_values`). Reference one by
     `property_id`, supply your own values as free text in `values` (leave
     `value_ids` empty — Etsy assigns IDs on save), **and you must also send
     `property_name`** (e.g. `"Type"`) — Etsy has no name of its own for a
     custom slot. Omitting `property_name` on a custom property fails with
     `"Expected string value for 'property_name' (got NULL)"`.
3. Build the `products` array — one entry per variant combination, each with:
   - `sku` — a unique SKU string per combination if the product has real SKUs
     (e.g. from a supplier's own SKU sheet); otherwise leave blank.
   - `offerings: [{quantity, is_enabled, price, readiness_state_id}]` —
     **every offering needs its own `readiness_state_id`** (same value as the
     listing's own, from Step 3's `get_processing_profiles` lookup), even
     though it looks like listing-level data — omitting it fails with
     `"All offerings need readiness state"`.
   - `property_values` — **every product must carry the same set of
     property_ids** (e.g. if product A has Type+Size, product B can't have
     only Size) — one entry per variant axis, each combination of values
     across axes appearing exactly once across the whole `products` array.
4. If price, quantity, SKU, or processing time varies by a specific property
   (e.g. price differs by size), set the matching top-level array so Etsy
   knows which axis controls it: `price_on_property`, `quantity_on_property`,
   `sku_on_property`, `readiness_state_on_property` — each an array of the
   controlling `property_id`(s). **This is required, not optional, whenever
   that field actually differs across products** — confirmed live: 4 products
   with different `sku` values but no `sku_on_property` failed with
   `"Error: sku must be consistent across all products"`. If ANY field
   differs per product, its `*_on_property` array must list the controlling
   property_id, or the call rejects.

**Standard properties accept freeform values, not just their listed
`possible_values`** — confirmed live: sending a standard property (e.g.
`property_id: 513` for "Size" on taxonomy 2869, found via the
`get_taxonomy_properties` tool or by checking a same-taxonomy competitor's
`get_listing_inventory`) with a real-world value not in its suggested list
(`values: ["3 inch"]`, empty `value_ids`) succeeded — Etsy auto-assigned a
new `value_id`. Don't assume a standard property is a closed enum; a
sensible custom value is usually accepted, though checking
`get_taxonomy_properties`'s list first is still the safer starting point
when the exact value already exists there.
5. This is real complexity — walk through it carefully. Show the user the
   full constructed `products` payload in plain terms ("4 products: 2 types ×
   2 sizes, price varies by both, quantity uniform at 999"), alongside the
   raw payload, and **wait for its own explicit confirmation before calling
   `update_listing_inventory`**.
6. After the call, re-fetch with `get_listing_inventory` and echo the
   resulting variant table so the user sees what actually landed. **Update
   the listings-record file's `variants`** per
   `../_shared/listings-record-guide.md`.

Skip this step entirely for digital listings and no-variant physical ones.

### Step 6 — Upload images and video (one confirmed write each)

For each image, in the user's chosen order: show what will be sent
(`listing_id`, `image_path`, `rank`, `alt_text` if any), get an individual
confirmation, then call `upload_listing_image`. **One confirmation per
image — never batch several uploads behind one "yes".** Optional flags
`overwrite`/`is_watermarked` only if the user asks for them. **After each
successful upload, append it to the listings-record file's `images`** per
`../_shared/listings-record-guide.md`.

If there's a video: same pattern with `upload_listing_video` (`listing_id`,
`video_path`, optional `name`) — its own confirmation.

### Step 7 — Attach the digital deliverable (digital listings only)

Call `upload_listing_file` with the `listing_id` and the absolute
`file_path` the user gave in Step 3 — after showing exactly that and getting
its own confirmation. Note for the user: this tool has a **built-in safety
check** — it refuses to attach a file to a listing that isn't already
`type: download`/`both`, because attaching a file to a physical listing
silently converts it to digital and strips its shipping/variations. Since
this skill set `type: download` on the original create call, the check should
pass cleanly — but it exists, and if it ever trips here, something went wrong
with the `type` field in Step 4: stop and investigate rather than passing
`force: true`.

### Step 8 — Final summary

Re-fetch the listing one last time (`get_listing`, plus `get_listing_images`
/ `get_all_listing_files` as relevant) and present the completion summary
(see Report structure): listing_id, URL, state (it's a **draft** — not
buyer-visible until published), what was attached, and what still needs
manual action (e.g. "no images yet — required before it can go active", or
"publish when ready: that's an `update_listing` setting `state: active`, its
own confirmed write whenever you ask"). Confirm the listings-record file
(`data/listings/<account>/<listing_id>.json`) is current — it should already be, from
the incremental writes in Steps 4-6, but this is the last checkpoint before
handing off to the user. If a later `update_listing` sets `state: active`,
update that file's `state` too at that point.

## Safety — every write confirmed individually, no bundling

This project manages a real, live-money shop. Per the project-wide rule,
every `create_*`/`update_*`/`upload_*` call requires the user's explicit
"yes / haan / confirm" **before** it is made, shown against the exact fields
and values that will be sent. This skill makes **several separate write
calls in sequence** — treat each as its own gate:

- `create_draft_listing` — one confirmation (Step 4).
- `update_listing_personalization` — its own confirmation, if the product is personalizable (Step 4b).
- `create_shop_shipping_profile` — its own confirmation, if needed (Step 3).
- `create_processing_profile` — its own confirmation, if needed (Step 3).
- `update_listing_inventory` — its own confirmation (Step 5).
- `upload_listing_image` — **one confirmation per image** (Step 6).
- `upload_listing_video` — its own confirmation (Step 6).
- `upload_listing_file` — its own confirmation (Step 7).

Never bundle multiple writes behind one "yes". A confirmation of the draft
payload authorizes exactly the `create_draft_listing` call and nothing after
it. An enthusiastic "love it!" about the copy is approval of the *copy*, not
authorization to write — ask each write question separately and
unambiguously.

- After `create_draft_listing` succeeds, **re-fetch the listing
  (`get_listing`) before and between subsequent calls** where relevant, so
  every later confirmation is shown against current state, not stale
  assumptions.
- If the user tweaks any field after seeing a payload, re-show the full
  updated payload and confirm again; if the tweak touches
  title/tags/description text, re-run the Copy QA Gate on the edited text
  first.
- A partial confirmation ("yes but change the price to $20") is not a
  blanket yes — rebuild the payload, re-show it, confirm again.
- All research and lookup steps (`get_*`, `search_*`, `etsy-docs`) are
  read-only and need no confirmation.
- Respect the rate limit (5 req/s, 5,000/day) — the re-fetches here are few
  and cheap, but don't add gratuitous polling between steps.

## Report structure

**Before each write**, show the payload in exactly this shape and stop:

```
## Confirm write <n>: <tool name>
Listing: <listing_id or "new draft">
| Field | Value |
|---|---|
| title | <exact text> (<n>/140 chars) |
| tags | <13 tags, comma-separated> |
| price | <value> |
| quantity | <value> |
| who_made / when_made | <values> |
| taxonomy_id | <id — category name> |
| type | physical / download / both |
| shipping_profile_id | <id — profile name> (physical only) |
| readiness_state_id | <id — processing profile label> (physical only) |
| <any other field being sent> | <value> |

QA: passed (Copy QA Gate, ../_shared/etsy-seo-standards.md) — for writes carrying copy
Nothing is written until you reply "yes / confirm" to THIS call. Later steps
(images, variants, files) will each get their own confirmation.
```

(For `update_listing_inventory`, replace the field table with the variant
table + raw `products` payload; for uploads, show `listing_id`, the local
file path, and rank/alt_text/name.)

**After everything is created**, close with:

```
# Listing created — <title> (id <listing_id>)
URL: <listing url>
State: draft (not buyer-visible until published)
Type: physical / download / both

## What was set up
- Draft created: <fields summary>
- Variations: <n products across <properties>, or "none">
- Images: <n> uploaded, in order <...> (always ≥1 — required by the Completeness Gate before creation)
- Video: <uploaded / none>
- Digital file: <filename attached / n-a for physical>

## Still needs manual action
- <e.g. "Publish when ready — say the word and I'll show the update_listing
  state:active payload for confirmation">
- <e.g. "Photos can't be quality-judged by this system — check them in
  Etsy's preview yourself">
```

## Next step

- **The listings-record file already exists** — `data/listings/<account>/<listing_id>.json`
  was written incrementally through Steps 4-6 per
  `../_shared/listings-record-guide.md`; no extra action needed here, it's
  automatic for every listing this skill creates.
- **Save a reusable product template** — once the user gives final
  confirmation the finished listing looks good, offer to save everything
  reusable (copy, taxonomy, materials/styles, variant structure and pricing
  formula, image source list, shipping profile shape) per
  `../_shared/product-templates-guide.md`, so publishing the same product to
  another account later skips the research/pricing/image work. Offer this
  every time a listing was built from a source URL or supplier page, right
  after the final summary. If saved, set that template's
  `published_listings` entry and this listing-record's
  `product_template_ref` to point at each other.
- **etsy-listing-qa-check** — run it against the finished listing as an
  independent post-write confirmation that what landed on Etsy actually
  complies with the shop's field/style rules (title length, 13 lowercase
  tags, hook, Copy QA items). Offer this every time, right after the final
  summary.
- **etsy-optimize-listing** — later, once the listing is live and has its own
  sales history, that skill rewrites its copy/tags/price against live
  competitor data. The first 30 days are the experiment; if it isn't moving,
  that's the skill to come back with.
