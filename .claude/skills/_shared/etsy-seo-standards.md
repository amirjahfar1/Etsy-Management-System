# Shared Etsy standards — referenced by all etsy-* audit/optimize/create skills

Read this once per run if any of the field limits or blind spots below are unclear. Keeping this in one place means a fix here (e.g. a tag-length rule) doesn't require editing every skill that touches listing copy. Facts below are confirmed straight from the live Etsy Open API schema (`etsy-docs` MCP, `createDraftListing`/`updateListing`) and Etsy's own seller-handbook guidance — not guessed.

## Listing Completeness Gate — mandatory, no exceptions

**A listing is never created, and a draft is never handed off as "done," until every
field in this checklist is actually collected/set — not just planned or promised for
later.** This is the single source of truth for "what does a complete listing need";
`etsy-create-listing` enforces it as a hard block before `create_draft_listing`, and
`etsy-listing-qa-check` re-checks it against every existing draft/active listing (drafts
built before this gate existed, or edited outside this system, are exactly the gap that
re-check covers). If any required item below is missing, **do not call
`create_draft_listing`** — stop and get the missing item from the user first. "The user
can add it later" is not an exception; get it now or don't create the listing yet.

**Required on every listing, physical or digital:**
- `title` — non-empty, ≤140 chars.
- `description` — non-empty.
- `price` — a real number > 0 (the exact price the user confirmed, not a placeholder).
- `quantity` — set (999 by the shop's own default rule, but must be explicitly sent).
- `who_made`, `when_made` — both set, never left to default.
- `taxonomy_id` — set to a real, looked-up category, never guessed-and-skipped.
- `type` — explicitly `physical` / `download` / `both`, never left to the API default.
- **Exactly 13 tags** — every slot filled, none empty, none uppercase, none duplicate
  (see the Tags rules below).
- **At least 1 image uploaded.** A listing with zero images is incomplete — full stop.
  Do not create the draft first and "add images later" as the plan; collect at least
  one real image path from the user *before* the `create_draft_listing` confirmation.
  If the user genuinely has no image ready yet, pause the whole creation flow and come
  back once they do — don't create a photo-less draft "to hold the spot." This applies
  to every skill offering a draft-creation path, not just `etsy-create-listing` —
  `etsy-new-listing-copywriter`'s own create offer is bound by it too.
- **Image count/order — soft standard, not a hard block.** Target **8-10 images**;
  below 5, say so plainly in the final summary as a real conversion risk (buyers
  expect a full gallery, not a floor-only listing). Recommended order: hero/
  product-alone shot first (the thumbnail), lifestyle/context shots second, detail/
  scale shots next, the size chart (apparel — itself mandatory, see below) ideally
  ranked 2nd-3rd rather than last, and a personalization example last for
  personalized items. This is a quality flag, not a `create_draft_listing` blocker —
  don't hold up a listing over image count the way a missing image entirely blocks
  it.

**Required additionally for physical listings (`type: physical` or `both`):**
- `shipping_profile_id` — a real profile id from `get_shop_shipping_profiles` (or a
  freshly created one), never omitted.
- `readiness_state_id` — from `get_processing_profiles`; required by the API itself
  (`"A readiness_state_id is required for physical listings."` if omitted) and required
  on every `offerings` entry in the inventory record too.
- If the listing has real variants (size/color/etc.), the `update_listing_inventory`
  call must actually have been made — a variant product left on Etsy's auto-generated
  single-product default when the copy/title clearly describes multiple options is an
  incomplete listing, not a finished simple one.
- **Any clothing/apparel listing requires a size chart image uploaded to the
  gallery** before the listing is considered complete — regardless of supplier or
  source (AliExpress, Merchize, Printify, hand-made, or any other origin). Ask the
  user for it (the supplier's own chart, a screenshot, or an image link) and upload
  it like any other listing image; don't let a clothing listing reach
  `create_draft_listing` — or, for `etsy-copy-listing`, finish its image step —
  without one. If a size chart already exists among the product's own source images,
  that satisfies the requirement.

**Required additionally for digital listings (`type: download` or `both`):**
- At least **1 file attached** via `upload_listing_file` — the actual buyer download.
  A digital listing with no file is not sellable; `get_all_listing_files` must return a
  non-empty result before the listing is considered complete.

**Required additionally when the product is personalizable** (a name, text, photo, or
size the buyer enters at checkout — anything the title/description implies as
"custom"/"personalized"/"add your name" etc.):
- `personalization_questions` set via `update_listing_personalization` — a listing that
  reads as customizable but has no personalization question configured means the buyer
  has no way to actually tell the shop what they want. `get_listing_personalization`
  must return at least one question.

**Must get an explicit answer (yes, a value, or an explicit skip) — never silently
omitted, even though these aren't hard `create_draft_listing` blockers:**
- `materials` — get at least 1 real material for every physical listing (a genuine
  filtered-search field; a listing that skips it is quietly less discoverable).
- `styles` (physical, **create-time only** — `update_listing` has no `style`/`styles`
  field at all, so a skipped-now styles field is permanently lost, not deferred).
- `shop_section_id` — pick from `get_shop_sections`, or an explicit "no section."
- `return_policy_id` — pick from `get_shop_return_policies` (physical and digital
  alike).
- `item_weight`/`item_length`/`item_width`/`item_height` with units,
  `processing_min`/`processing_max`, a listing video — genuinely optional, but still
  worth asking about once rather than never raising them.

## Image alt text — standing default, set automatically, no need to ask

**Updated 2026-07-23 (explicit user instruction, supersedes the old
"all 13 tags comma-joined on every image" rule below):** each uploaded
image gets **exactly one tag** as its `alt_text`, not the full tag list.
Assign the listing's 13 tags to images **in tag order, one tag per image**
(image 1 → tag 1, image 2 → tag 2, ...); if there are fewer images than
tags, only the first N tags get used (one per image) and the rest go
unused for alt-text purposes — don't reuse a tag on a second image just to
cover every tag. If there are ever more images than tags (13), wrap back
to tag 1 rather than leaving later images with no alt_text. State the
image→tag mapping plainly in the write-confirmation payload so it's
visible before upload, same as any other field.

This is a standing default per explicit user instruction, not something to
ask about per listing — apply it automatically on every `upload_listing_image`
call across every skill. Set it at upload time (`alt_text` param) when
possible; for images already uploaded without it, `upload_listing_image`
can update an existing image's `alt_text`/`rank` in place by passing its
`listing_image_id` (no `image_path`) — confirmed live, this does **not**
require deleting the image first, despite the tool description mentioning
`listing_image_id` mainly in the context of re-assigning a *deleted* image.

## Final-report verification — mandatory before telling the user a draft is done

Any time a skill reports the result of building/cloning a draft listing
(the Step 5 / final-summary style report), verify — don't just recite what
was *intended* — against the listing's actual current state:

- **Images**: re-check `get_listing_images` (or the upload responses
  already in hand) actually shows every image that was supposed to be
  uploaded. Don't report "N images uploaded" from memory of the plan;
  confirm the count matches what's live.
- **Variants**: if variants were supposed to be created, confirm
  `update_listing_inventory`'s response (or a fresh `get_listing_inventory`)
  actually contains every combination that was promised — count them
  against the expected size × color (or whatever axes) matrix, not just
  "the call returned 200."

If anything expected is missing from the live result, **mark it plainly
with an emoji** (e.g. ⚠️ or ❌) in the report rather than a plain-text aside
that's easy to skim past — this is a deliberate, explicit user instruction
for how gaps must be surfaced, not just a style preference. If everything
checks out, a short explicit confirmation (e.g. "✅ all 5 images present,
all 15 variants added") is expected too, not just silence implying success.

## Title — confirmed field rules
- **Max 140 characters.** Applies to physical, digital, and vintage listings alike.
- **Target 130-139 characters, not just "under 140."** Per shop instruction: a short title (e.g. 90-100 chars) leaves real keyword-coverage on the table — every additional distinct buyer-search angle (material, occasion, recipient, use-case, style) that fits is another way the listing can match a search. Write toward the top of the range by adding genuine, distinct angles, not by padding with repeated words or filler — see the no-repetition rule below, which still applies at 135 chars same as at 100.
- **Allowed characters**: letters, numbers, punctuation, mathematical symbols, whitespace, and ™ © ®. The characters **`% : & +` may each be used at most once** in a title — the API rejects a title using any of them twice.
- **Etsy's own suggested-title feature exists**: `get_listing_details`/`getListing` can return a `suggested_title` field (English-language shops, existing listings only) — worth checking as a sanity comparison when one is available, but never assume it's present.
- **Search weighting**: Etsy's algorithm weights the **first ~40 characters** most heavily — front-load the primary keyword, don't bury it after descriptive filler.
- **No keyword repetition (2026 guidance).** Repeating the same word/phrase 2-3 times in a title (e.g. "Dad Shirt Father Shirt Personalized Father's Day Dad Gift") no longer helps ranking and actively hurts click-through — it reads as spammy to buyers and Etsy's algorithm has moved past rewarding raw repetition. Use **distinct keyword phrases covering different buyer angles** (what it is → who it's for / occasion → material or style modifier) instead of rephrasing one keyword repeatedly. A good structural pattern: `[Primary Keyword] | [Secondary Keyword + Modifier] | [Occasion or Recipient]`.

## Tags — confirmed field rules
- **Exactly 13 tag slots.** Each tag **≤20 characters**.
- **Allowed characters**: letters, numbers, whitespace, `-` and `'` (a tag cannot *start* with `-` or `'`), and ™ © ®. No other punctuation is valid — the API rejects it.
- Etsy rejects a tag that **exactly duplicates another tag on the same listing** or duplicates the title verbatim. Near-duplicate tags (rephrasing the same word instead of covering a new buyer intent) waste a slot even if the API allows them — same "variety over repetition" principle as titles applies here: spread the 13 slots across material, occasion, recipient, use-case, style, and format angles rather than 13 minor variations of one phrase.
- **Lowercase only — no uppercase letters.** The API itself permits mixed case, but this shop's own style rule is all-lowercase tags (matches how buyers actually type search queries and keeps the 13 slots visually consistent). Flag or fix any tag containing an uppercase character before presenting or writing it — this is a shop-style rule, not an Etsy API rule, so it won't cause a rejection, but it should still be treated as a hard check by every skill that drafts or audits tags.
- A rewrite/new-listing draft that proposes a >20-char tag, an invalid character, or an uppercase letter is a wasted round-trip once the user has already confirmed it — always check length, character set, and case before presenting or writing a tag list.

## Description — confirmed field rules
- **No hard character limit surfaced by the API schema** (practically Etsy allows roughly 10,000 characters), but the **first ~160 characters are what actually show as the meta-description-style snippet** in Etsy search results and Google — write those like an ad headline, not a scene-setting intro.
- Ideal working length for conversion: **150-400 words** (roughly under ~2,000 characters) — buyers skim, they don't read a novel; a tight scannable 200-word description usually outperforms a rambling 600-word one. Structure over length: open strong, then cover what it is / size or format / materials or delivery / how to use, in short scannable chunks (not a wall of prose).

## "Meta title" clarification
Etsy has **no separate meta-title field** distinct from the listing title — the `title` field itself is what renders as the page title / browser tab / Google search result headline. When a user asks for a "meta title," that request is answered by the title field above, not a second field.

## Materials & Styles — confirmed field rules
- **`materials`**: array of strings, letters/numbers/whitespace only — no punctuation, no hyphens.
- **`styles`**: up to **2** style strings, each **≤45 characters**, letters/numbers/whitespace only.

## Copy QA Gate — mandatory before presenting or writing

Every skill that drafts listing title/tags/description text (`etsy-new-listing-copywriter`,
`etsy-optimize-listing`, `etsy-seasonal-keywords`) must run this checklist against the
drafted copy **before** showing it to the user and again **immediately before** any
`create_draft_listing`/`update_listing` call. If a check fails, fix the copy and re-run
the checklist — never present or write copy that hasn't passed. This is a hard gate, not
a suggestion: no title/tag/description text reaches the user's screen or Etsy's API
without clearing every item below.

1. **No em dashes (—).** Rewrite with a period (new sentence), a comma, or a plain word
   like "and"/"but" instead. Em dashes are one of the most obvious AI-writing tells to
   buyers and a listing that reads as AI-generated loses trust before the sale.
2. **Grade 5-7 reading level.** Short sentences (aim under ~18 words each), everyday
   words a 10-13 year old would know, no marketing-fluff adjectives ("meticulously",
   "exquisite", "elevate", "seamless", "unparalleled", "curated"). If a sentence needs
   two commas to parse, split it into two sentences.
3. **No other AI-tell patterns.** Avoid "Whether you're X or Y", "Look no further",
   "In today's world/fast-paced life", rhetorical-question openers, and rule-of-three
   adjective stacks ("beautiful, elegant, timeless"). These read as templated, not
   written by a real shop owner.
4. **Field limits re-verified, not assumed.** Title ≤140 chars (and the `% : & +`
   once-each rule); exactly 13 tags, each ≤20 chars, valid characters only, all
   lowercase, no exact duplicates; description hook ≤~160 chars. Re-count after any
   QA-driven rewrite — fixing one check can silently break another (e.g. splitting a
   long sentence to fix reading level can push the title over 140 chars).
5. **No misleading or unverifiable claims** — no fake urgency ("only 1 left!" unless
   true), no unverifiable safety/medical claims (relevant for kids' products), no
   "as seen on TV" or similar unearned authority claims.
6. **Not copied verbatim from a competitor listing.** Research (Phase 1 / step 2 in
   the copywriter and optimizer skills) reads competitor titles/tags/descriptions to
   find patterns — the draft must be original phrasing inspired by those patterns,
   never a lifted sentence or near-identical paragraph.
7. **No leftover placeholders or template artifacts** — no "[insert X]", no stray
   brackets, no double spaces or dangling punctuation from an edit pass.
8. **Tone matches the shop's chosen voice** (see the shop's `announcement`/`get_shop`
   bio, or whatever tone the user has explicitly set) — don't let one listing read
   playful and another read corporate if the shop has settled on a voice.
9. **No country-of-manufacture / origin wording anywhere in title or description** —
    never write "China", "Made in China", "CN", "Mainland China", "Jiangxi" (or any
    other supplier-country/province name), or similar origin phrasing pulled straight
    from a supplier's (AliExpress/Merchize/etc.) own spec sheet. Supplier spec blocks
    routinely include a `Place Of Origin` / `CN` field — when reusing a supplier's raw
    title/description as a starting point, strip every origin/location line before it
    ever reaches the draft the user sees. This is a shop-style rule (buyers reading
    "China" in the copy hurts perceived quality/handmade positioning), not an Etsy API
    rule, so it won't cause a rejection — but it's a hard check same as the others above.

State in the report that this checklist was run (a one-line "QA: passed" note is
enough) — don't just apply it silently.

## Landed price, not bare price
A $18 listing with $7 shipping and a $25 free-shipping listing cost the buyer the same $25. When comparing prices (outlier detection, benchmarking, positioning), compute `price + shipping profile's primary domestic rate` rather than comparing bare `price` fields — otherwise "free shipping" listings look artificially cheap and get miscompared.

## Active discounts/sale pricing are invisible
The read tools used here don't reliably distinguish a sale price from list price. If a competitor or benchmark listing's price looks like an outlier, consider that it may be temporarily discounted rather than mispriced — say so as a caveat rather than asserting a fixed price point.

## Merchandising fields worth checking (often skipped, all cheap to check via `get_listing_details` / `get_listing_properties`)
- **`state` and `quantity`**: if a listing isn't `active` or has `quantity` of 0, it isn't sellable at all — check this *before* critiquing SEO/copy, since no amount of title polish fixes a listing that's out of stock or inactive.
- **Variations & personalization** (`has_variations`, `is_personalizable`): if comparable listings in the same niche commonly offer size/color/material variants or personalization and this one doesn't, that's a real gap, not cosmetic.
- **Taxonomy / category** (`taxonomy_id`): the wrong category quietly kills filtered-search visibility even with a perfect title. If unsure whether a listing's category is right for its product type, check via the `etsy-docs` MCP rather than guessing.
- **`should_auto_renew`**: Etsy charges a small fee (~$0.20) every time a listing auto-renews. A listing that's effectively dead (no sales, no views signal available, clearly neglected) left on auto-renew is a silent recurring fee leak — worth flagging in financial or catalog-health checks, not just SEO ones.
- **Video**: Etsy allows one listing video. Flag if a listing has none and comparable top performers do — you can only confirm presence/absence, not judge video quality.
- **Image alt text**: if exposed on the endpoint, empty alt text is a real accessibility/SEO gap — confirm the exact field via `etsy-docs` if uncertain rather than assuming it's absent.
- **`materials` / `who_made` / `when_made`**: category-relevant completeness on these affects filtered-search matching, same logic as other attributes.

## Blind spots — state these plainly, never paper over them
- No analytics/*trend* data exists via this API: no historical views-over-time, no
  visitor funnel, no click-through, no conversion data. `getListing` **does** return
  each listing's current cumulative `num_favorers` and, for active listings, a
  daily-tabulated `views` count (can read 0 for reasons unrelated to actual traffic —
  treat as directional, not exact) — `etsy-new-listing-copywriter`'s Step 2 uses these
  to weight the competitor-research sample toward listings with real proof of demand.
  It's a snapshot, not a trend, and still says nothing about a *new* listing's own
  future performance.
- No Etsy Ads API — ad performance can't be measured directly.
- `upload_listing_image`/`upload_listing_video`/`upload_listing_file` tools exist (multipart upload from a local file path) — recommending and actually uploading a new/better photo or video is possible. What's still a real gap: **judging photo quality, lighting, or composition programmatically** — that's a human-judgment call every time, and there's still no shop-banner/logo upload tool (listing-level media only).
- Discounts/sale pricing aren't reliably exposed (see above).

## When a field name is uncertain
Don't guess. Use the read-only `etsy-docs` MCP: `get_endpoint(operationId)` or `search_etsy_api` to confirm the exact field before relying on it in a report or a write payload.

## Research constants — single source of truth, don't restate a different number elsewhere

These numbers are used by `etsy-new-listing-copywriter`, `etsy-optimize-listing`,
`etsy-copy-listing`, and `etsy-listing-qa-check`. If a value needs to change, change
it here — a skill file should reference this section, not hardcode its own copy of
the number:

- **External benchmark sample size:** top **10-15** `search_listings` results per
  candidate phrase, relevance-screened first (drop anything not genuinely the same
  product type before tallying).
- **"Common" tag/pattern threshold:** appears in **at least half the sample**
  (e.g. 8+ of 15) — this is also the tags database's `common` vs `unique` cutoff.
- **Internal benchmark window:** trailing **90 days**, listings with **≥5 sales**
  count as winners, need **≥3 qualifying winners** to run the benchmark at all; if
  fewer than 3 at 90 days, widen once to **180 days** before skipping it entirely.
- **Shipping/processing default (this shop's standing rule, not an Etsy default):**
  **3-5 days**, used by `etsy-copy-listing` for every clone regardless of the
  source's own processing time.
- **Tags database staleness:** saved tags older than **~90 days** should be offered
  as "refresh recommended" rather than a neutral reuse-or-research choice — see
  `../_shared/tags-database-guide.md`.

## Seasonality awareness
Before flagging a listing's tags/title as a problem, check whether it currently carries deliberately-inserted seasonal keywords (see `etsy-seasonal-keywords`) that are mid-window — don't recommend stripping those out just because they look like a temporary oddity. Also, when prioritizing fixes, weigh whether a gift-buying window (e.g. Christmas, Valentine's, Mother's Day) is approaching — seasonal readiness can outrank a generic fix if the timing is close.
