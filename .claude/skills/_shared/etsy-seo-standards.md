# Shared Etsy standards — referenced by all etsy-* audit/optimize/create skills

Read this once per run if any of the field limits or blind spots below are unclear. Keeping this in one place means a fix here (e.g. a tag-length rule) doesn't require editing every skill that touches listing copy. Facts below are confirmed straight from the live Etsy Open API schema (`etsy-docs` MCP, `createDraftListing`/`updateListing`) and Etsy's own seller-handbook guidance — not guessed.

## Title — confirmed field rules
- **Max 140 characters.** Applies to physical, digital, and vintage listings alike.
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
5. **No copyrighted/trademarked names in title, tags, or description** — character
   names, franchise names, brand logos ("Disney", "Bluey", "Pokemon", sports team
   names, etc.) unless the shop has stated it holds a license. This is a real Etsy
   takedown risk, not just a style note — flag it plainly if research copy or a
   product brief includes one, and ask the user before including it.
6. **No misleading or unverifiable claims** — no fake urgency ("only 1 left!" unless
   true), no unverifiable safety/medical claims (relevant for kids' products), no
   "as seen on TV" or similar unearned authority claims.
7. **Not copied verbatim from a competitor listing.** Research (Phase 1 / step 2 in
   the copywriter and optimizer skills) reads competitor titles/tags/descriptions to
   find patterns — the draft must be original phrasing inspired by those patterns,
   never a lifted sentence or near-identical paragraph.
8. **No leftover placeholders or template artifacts** — no "[insert X]", no stray
   brackets, no double spaces or dangling punctuation from an edit pass.
9. **Tone matches the shop's chosen voice** (see the shop's `announcement`/`get_shop`
   bio, or whatever tone the user has explicitly set) — don't let one listing read
   playful and another read corporate if the shop has settled on a voice.

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
- No analytics/traffic data exists via this API: no views, no favorites trend, no visitor funnel, no click-through data.
- No Etsy Ads API — ad performance can't be measured directly.
- `upload_listing_image`/`upload_listing_video`/`upload_listing_file` tools exist (multipart upload from a local file path) — recommending and actually uploading a new/better photo or video is possible. What's still a real gap: **judging photo quality, lighting, or composition programmatically** — that's a human-judgment call every time, and there's still no shop-banner/logo upload tool (listing-level media only).
- Discounts/sale pricing aren't reliably exposed (see above).

## When a field name is uncertain
Don't guess. Use the read-only `etsy-docs` MCP: `get_endpoint(operationId)` or `search_etsy_api` to confirm the exact field before relying on it in a report or a write payload.

## Seasonality awareness
Before flagging a listing's tags/title as a problem, check whether it currently carries deliberately-inserted seasonal keywords (see `etsy-seasonal-keywords`) that are mid-window — don't recommend stripping those out just because they look like a temporary oddity. Also, when prioritizing fixes, weigh whether a gift-buying window (e.g. Christmas, Valentine's, Mother's Day) is approaching — seasonal readiness can outrank a generic fix if the timing is close.
