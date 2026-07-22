# Product Templates — shared save/reuse workflow

Referenced by `etsy-create-listing` (and any future skill that assembles a
full listing from an external source, e.g. a supplier/dropship product page).
This is a **local data store**, not an Etsy API resource — read/write it with
the ordinary Read/Write/Edit file tools, never through an `etsy` MCP tool.

## Why this exists

Building a listing from a supplier page (Merchize, Printify, etc.) means
research that doesn't change per shop: the copy (title/tags/description), the
taxonomy category, materials/styles, the variant structure (which axes, which
values, which SKUs, the pricing formula), and the image set. What genuinely
differs per Etsy account is only the **shipping profile** and **processing
profile** (both are account/shop-scoped numeric IDs, never portable) and the
final `listing_id`/URL. Once a listing has been built and the user confirms
it's good, save everything reusable so that publishing the *same* product to
a *different* (or the same) Etsy account later is "give me the URL again, or
just say the product name" — not a full re-run of research, pricing, and
image sourcing.

## File location — organized by supplier

One JSON file per product at
`../../../etsy-mcp-server/data/products/<Supplier Name> products/<product-slug>.json`,
relative to any skill's own folder (`.claude/skills/<name>/` or
`.agent/skills/<name>/` — both resolve to the same physical file, nothing to
keep in sync). Products are grouped into a **per-supplier subfolder** (e.g.
`data/products/Merchize products/`, later `data/products/Printify products/`)
because this shop sources from multiple different suppliers — keeping them
separate avoids naming collisions and makes it obvious at a glance which
supplier catalog a saved template came from. Derive the subfolder name from
the `supplier` field (title-case the supplier name + literal " products",
e.g. `supplier: "Merchize"` → `Merchize products/`). If a listing wasn't
built from any supplier page, use a `Custom products/` subfolder instead of
leaving `supplier` ambiguous.

The whole `data/products/` directory (all supplier subfolders under it) is
gitignored (shop-specific runtime state, like `accounts.json` and
`tags-database.json`) — create the supplier subfolder if it doesn't exist
yet. Slug the filename from the product name (e.g. "Welcome Sign" →
`welcome-sign.json`).

**`source_url` is a required field, always** — it's both the durable record
of where the product came from and the primary match key for the reuse-check
in `etsy-create-listing`'s Step 0. Never save a template without it when a
source page exists.

## Schema

```json
{
  "product_name": "<human name, e.g. \"Welcome Sign\">",
  "source_url": "<the supplier/product page this was built from>",
  "supplier": "<e.g. \"Merchize\", or null if not sourced from one>",
  "product_type": "physical | download | both",
  "first_created": "<ISO date>",
  "last_updated": "<ISO date>",
  "listing_data": {
    "taxonomy_id": 0,
    "taxonomy_path": "<e.g. \"Home & Living > Home Decor > Wall Decor > Wall Hangings > Signs\">",
    "who_made": "i_did | someone_else | collective",
    "when_made": "made_to_order | ...",
    "materials": ["..."],
    "styles": ["..."],
    "title": "<exact copy-paste title>",
    "tags": ["<13 tags>"],
    "description": "<exact copy-paste description>"
  },
  "images": {
    "source_urls": ["<original supplier image URLs, for re-downloading if the local cache is gone>"],
    "local_files": ["<absolute local paths used at upload time, if still present>"],
    "alt_texts": ["<matching alt_text per image, same order>"],
    "video_source_url": null,
    "video_local_file": null
  },
  "variants": {
    "axes": [
      {"name": "<e.g. \"Type\">", "property_type": "standard | custom", "property_id": 0, "values": ["..."]}
    ],
    "price_on_property": true,
    "sku_on_property": true,
    "combinations": [
      {"sku": "<sku>", "values": {"<axis name>": "<value>"}, "base_cost": 0, "price": 0, "quantity": 999}
    ],
    "pricing_formula": "<plain-language note, e.g. \"base_cost + $10 flat markup, user-specified\">",
    "pricing_markup": {
      "base_markup_type": "flat | percent",
      "base_markup_value": 0,
      "shipping_markup_applied": false,
      "notes": "<e.g. \"Tier 1 base cost + $8 flat, shipping passed through with no markup\" — see etsy-create-listing Step 3's mandatory supplier-sheet + markup-question workflow>"
    }
  },
  "shipping_template": {
    "profile_title": "<always name it after the product, e.g. \"Welcome Sign Shipping\" — never a generic name like \"Standard Shipping\", so a same-name lookup on a new account can identify a match at a glance>",
    "origin_country_iso": "US",
    "origin_postal_code": "<if applicable>",
    "processing_days": {"min": 0, "max": 0},
    "destinations": [
      {"destination_country_iso": "<or omit>", "destination_region": "<or omit>", "primary_cost": 0, "secondary_cost": 0, "min_delivery_days": 0, "max_delivery_days": 0}
    ],
    "note": "shipping_profile_id and readiness_state_id are account-specific — never reuse the numeric IDs across accounts, only this template's shape. This shape is self-sufficient: every country/region/cost/delivery-day field a fresh create_shop_shipping_profile call needs is already here, so reusing it on a new account never requires re-asking the user for rates."
  },
  "supplier_sku_sheet_path": "<absolute local path to a supplier cost/SKU spreadsheet — REQUIRED (not null) whenever supplier is \"Merchize\", since every Merchize product ships one; see etsy-create-listing Step 3 for the mandatory read-before-pricing workflow. Null only for suppliers/products that genuinely have no such sheet.>",
  "personalization_research": {
    "common_fields": ["<e.g. \"name/text input\", \"color choice\", \"font choice\" — from etsy-new-listing-copywriter Step 2's competitor tally, fields in at least half the benchmark sample>"],
    "optional_fields": ["<e.g. \"hardware/attachment type\", \"multiple names\" — 1-2 listings only>"],
    "supplier_capability_notes": "<what the supplier's own product page said about how a buyer's personalization reaches production (auto per-order vs. shop hand-builds from a template) per etsy-create-listing Step 3, or \"unconfirmed — verify with supplier\" if the page didn't say>"
  },
  "published_listings": [
    {
      "account": "<connected account name>",
      "shop_id": 0,
      "listing_id": 0,
      "url": "<etsy listing URL>",
      "shipping_profile_id": 0,
      "readiness_state_id": 0,
      "published_date": "<ISO date>"
    }
  ]
}
```

## When to save (after `etsy-create-listing` finishes)

Once the listing is created, images are uploaded, and the user has given
final confirmation that it looks good (a plain "good"/"OK"/"looks right", not
just approval of one individual write step) — offer once: **"Save this as a
reusable product template? Next time you want to publish the same product to
another account, I can skip the research/pricing/image work."**

If yes:

1. Determine the supplier subfolder from the `supplier` field (e.g.
   `Merchize products/`) and read/create it under `data/products/` if it
   doesn't exist.
2. Build the filename from the product name slug. If a file for this
   `source_url` already exists anywhere under `data/products/` (check across
   supplier subfolders, not just the one you'd otherwise write to — a
   product's supplier shouldn't change, but don't assume), this is an
   **update**, not a new file — overwrite
   `listing_data`/`images`/`variants`/`shipping_template` with the current
   run's values (the copy may have been tweaked since last time) and
   **append** to `published_listings` rather than replacing it, so every
   account this product has ever been published to stays on record.
3. Write the file, set `last_updated`. Confirm briefly: "Saved as
   `data/products/Merchize products/welcome-sign.json` — reusable for future
   publishes."

If no: skip silently, nothing is lost — the listing itself is still live,
this is only about *future* reuse.

## When to offer reuse (start of `etsy-create-listing`)

Before Step 1, if the user's request includes a URL (a supplier/product page)
or names a product that sounds like something built before, check every
supplier subfolder under `data/products/` for a file whose `source_url`
matches (or, absent a URL, a `product_name` that's an obvious match) — search
across all subfolders, don't assume which supplier it's under. Matching is
exact-URL-first; only fall back to name-similarity if no URL was given.

If a match exists, show a short summary — product name, when it was last
published, which accounts it's already live on — and ask: **"Found a saved
template for this product (last published to <account> on <date>). Reuse it,
or do fresh research?"**

- **Reuse:** skip Step 2 (research/copy) and the copy/taxonomy/materials/
  styles/variant-structure/pricing-formula parts of Step 3 entirely — pull
  them straight from the template. **Still go through every other
  step normally**: Step 3's shipping-profile and processing-profile lookups
  are account-specific and must be redone for *this* account —
  1. Call `get_shop_shipping_profiles`/`get_processing_profiles` on the
     target account and check for a profile whose **name matches the
     template's `shipping_template.profile_title`** (shipping profiles are
     always named after the product — e.g. "Welcome Sign Shipping", never a
     generic name — precisely so this lookup can identify a match at a
     glance, across products and across accounts).
  2. **If a matching profile exists, ask the user explicitly: reuse the
     existing profile, or create a fresh one from the template's
     `shipping_template` shape?** Never decide this silently, even though
     the existing one "fits" — the same product can legitimately need
     different rates on different runs (a rate change, a different
     fulfillment location, testing), and that's the user's call each time,
     not an inferred default.
  3. **If creating fresh, the template's `shipping_template` already has
     every field needed** (title, origin, all destinations with their
     costs/delivery days, processing days) — build and show that payload for
     the normal write confirmation **without asking the user to re-supply
     any of the countries/prices/days again**; those questions were only
     ever needed the first time a product's shipping was designed, not on
     every reuse. The confirmation is "here's the payload from the saved
     template, confirm to create it" — not a fresh round of shipping
     questions.
  4. **Confirmed live: Etsy rejects a shipping profile title that already
     exists on the shop** (`create_shop_shipping_profile` fails with
     `"Shipping profile '<title>' already exists"`). This means "create
     fresh" while a same-titled profile already exists (step 2, if the user
     picks fresh anyway on the *same* account rather than a different one)
     will fail on the exact `profile_title` from the template — **flag this
     to the user before attempting** ("this account already has a profile
     named X, a fresh one needs a distinct title, e.g. 'X 2' — proceed with
     that name, or reuse the existing one after all?") rather than
     discovering the API rejection mid-flow. This scenario is normal on a
     *different* account (no name collision there) — it only bites when
     "create fresh" is chosen on an account that already has that exact
     title.
  Either way (reused or freshly created), this is still its own confirmed
  write same as any other account. Step 4's `create_draft_listing`
  confirmation, Step 5's `update_listing_inventory` confirmation, and Step
  6's per-image `upload_listing_image` confirmations **all still happen** —
  reusing a template speeds up *research*, it never skips the project's
  confirm-before-write rule. Re-download images from `images.source_urls` if
  the `local_files` paths no longer exist (e.g. a new session's scratchpad).
  After publishing, update the template's `published_listings` per the save
  workflow above.
- **Fresh research:** proceed with the skill's normal flow from Step 1. At
  the end, still run the save-prompt above — even a fresh run on a
  previously-templated product is a chance to refresh a stale template, not
  a reason to skip saving.

If no match exists, say so plainly and proceed with the skill's normal flow —
don't turn the check into a bottleneck when there's nothing to reuse yet.

## Blind spots — state plainly

- A template can go stale: supplier pricing changes, a shop's shipping needs
  change, competitor research ages. Use `last_updated` to flag an old
  template (e.g. "this template is from 3 months ago — supplier costs may
  have moved, worth double-checking before reusing the price formula as-is")
  rather than silently treating a saved template as current truth.
- Local image file paths are session-scoped (scratchpad directories get
  cleaned up) — always keep `source_urls` as the durable fallback, and expect
  to re-download rather than assume `local_files` still exist.
- Numeric IDs (`shipping_profile_id`, `readiness_state_id`, `taxonomy_id` is
  the one exception — taxonomy IDs are global and portable) are never
  portable across accounts — the guide above calls this out at the one place
  it matters (shipping) but it's worth restating: never copy a
  `shipping_profile_id`/`readiness_state_id` from `published_listings` into a
  *different* account's create call.
