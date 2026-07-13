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

### Step 0 — Check for a reusable product template

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

### Step 2 — Research first? Then get the copy

Ask whether the user wants **research done first**.

- **Yes:** ask the same benchmark-sourcing question used across this skill
  set: "Will you give me shop/listing links to research against, or should I
  do it myself?" Then execute `etsy-new-listing-copywriter`'s **Phase 1
  (Research)** and **Phase 2 (Generation)** exactly as documented in that
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

Show both answers plainly in the write-confirmation payload (Step 4/Step 5's
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

- `quantity` (int) — ask plainly. For digital listings a high number like 999
  is common; suggest it, don't assume it.
- `title`, `description`, `price` — from Step 2's approved copy.
- `who_made` — enum `i_did` | `someone_else` | `collective`.
- `when_made` — enum: `made_to_order`, `2020_2026`, `2010_2019`, `2007_2009`,
  `before_2007`, `2000_2006`, `1990s` … `1700s`, `before_1700`.
- `taxonomy_id` (int) — the category. Resolve it from the product brief; if
  the right ID isn't obvious, look it up via the `etsy-docs` MCP
  (`search_etsy_api`/`get_endpoint`) — **never guess a taxonomy number**.
- `type` — set it **explicitly on the create call** from Step 1's answer
  (`physical` | `download` | `both`). Never leave it to the API default.

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
- Optional but worth asking in one batch: `item_weight` / `item_length` /
  `item_width` / `item_height` with `item_weight_unit` (`oz`,`lb`,`g`,`kg`)
  and `item_dimensions_unit` (`in`,`ft`,`mm`,`cm`,`m`,`yd`,`inches`);
  `materials` (array, letters/numbers/whitespace only — see the shared
  standards file); `processing_min`/`processing_max`; `styles` (array, up to
  2, each ≤45 chars, letters/numbers/whitespace only). **`styles` can only be
  set on this `create_draft_listing` call** — `update_listing` has no
  `style`/`styles` field at all, so if it's skipped now it cannot be added
  later through this API (only by deleting and recreating the draft, or
  editing manually in Etsy's own UI). Ask for it here, don't defer it.
- **Variants:** ask now — before creating anything — whether the product has
  variations (sizes, colors, etc.), what the exact option sets are (e.g.
  "Small / Medium / Large" or "Red / Blue / Green"), and whether price,
  quantity, or SKU differs per option. The answers feed Step 5; asking
  upfront avoids re-interrogating the user mid-flow.

**Digital branch:**

- No shipping profile needed — don't ask for one.
- Ask for the **exact absolute local file path** of the digital deliverable
  (the file the buyer downloads) — never guess or construct a path. This
  feeds Step 7.

**Images and video (both types) — a first-class step, not an afterthought:**

- Ask for the **absolute local path(s)** of the image file(s) to attach, and
  the order they should appear in (rank 1 = first/leftmost, the thumbnail).
  Ask if they want `alt_text` per image (max 500 chars — good for
  accessibility and SEO).
- Ask whether they have a listing video (Etsy allows one) and its local path.
- If the user has no images ready, proceed — but say plainly, now and again
  in the final summary, that **a draft listing needs at least one image
  before it can ever be set active/published**. A photo-less draft is not
  launch-ready.

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
   controlling `property_id`(s).
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
- Images: <n> uploaded, in order <...> / "none yet"
- Video: <uploaded / none>
- Digital file: <filename attached / n-a for physical>

## Still needs manual action
- <e.g. "At least one image before it can be set active — required">
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
