---
name: etsy-new-listing-copywriter
description: >-
  Writes launch-ready title, 13 tags, and description for a BRAND-NEW Etsy
  product that doesn't have a listing yet — copy-paste-ready text, produced
  through a mandatory research-first flow (read what's actually ranking for
  the target keyword, and the shop's own best-sellers if this extends an
  existing line) before any copy is generated. Trigger this whenever the user
  says things like "I'm about to list a new product, write the title/tags/description",
  "help me create a new Etsy listing", "give me a meta title and description for
  my new [product]", "write tags for this new item", "I'm launching a new
  product, what should the listing copy be", or describes a new product and
  wants the SEO copy for it. Use this — not etsy-optimize-listing — when the
  product does NOT already have a listing on Etsy; use etsy-optimize-listing
  instead when a listing already exists and needs rewriting. Never skip
  straight to generating copy on a bare one-line request — this skill's whole
  value is doing the keyword/competitor research first.
---

# Etsy New Listing Copywriter — Research First, Then Write

This skill produces launch-ready copy — title, 13 tags, and description — for a
product that **does not exist on Etsy yet**. That's what separates it from
`etsy-audit-listing` and `etsy-optimize-listing`, which work on live listings:
here there is no existing listing to critique, so the deliverable is
copy-paste-ready text the seller drops into the listing form (or, only on
explicit request and after confirmation, a draft created via
`create_draft_listing`).

The non-negotiable shape of this skill is **research → generate, in that
order**. A seller's instinct is to ask "give me a title for my new mug" and get
one back in five seconds. Resist that instinct, even when the user pushes for
speed. Copy written without research is written against *general SEO theory*,
and general theory produces the same title every AI tool on the internet
produces — which means it competes head-on with thousands of identically
generic listings and ranks behind all of the established ones. Copy written
*after* research is grounded in two things theory can't give you: the exact
keyword phrases Etsy's search is rewarding **in this niche, right now** (read
off the listings actually ranking), and — when the product extends an existing
line — the phrasing and voice that **this shop's own buyers already respond
to**. Ten minutes of research is the difference between copy that sounds
plausible and copy that has a reason to exist.

Every tool below accepts an optional `account` argument; pass it if the user
names a specific shop, otherwise the default account is used.

**Field rules live in `../_shared/etsy-seo-standards.md`.** Read it if any
limit below feels uncertain — it is the single source of truth shared across
all etsy-* skills, so a correction there propagates everywhere. The hard
constraints are also restated inline in Phase 2 at the exact point each field
is drafted, because a constraint mentioned once at the top and forgotten by
the time the tags are written is how invalid drafts happen. If a field name or
limit is still unclear, confirm it via the read-only `etsy-docs` MCP
(`get_endpoint`, `search_etsy_api`) — never guess in a payload.

## Safety — this skill's default output is text, not a write

This project manages a real, live-money shop. Per the project-wide rule, any
`create_*` tool call requires explicit user confirmation first.

- The **default deliverable is the copy-paste report** at the end of this
  skill. Producing it requires only read-only tools (`search_*`, `get_*`) —
  no confirmation needed for any research step.
- Do **not** call `create_draft_listing` unprompted. Offer it once, at the end
  of the report, as an option.
- If the user *does* want the draft created: show the **exact payload**
  (title, tags, description, price, quantity, who_made, when_made,
  taxonomy_id, shipping profile — every field that will be sent), then stop
  and wait for an explicit "yes / haan / confirm". An enthusiastic "love it!"
  about the copy is approval of the *copy*, not authorization to *write* —
  ask the write question separately and unambiguously.
- If the user tweaks any field after seeing the payload, re-show the full
  updated payload and confirm again.
- After a confirmed create succeeds, fetch the new listing back
  (`get_listing`) and echo the created listing_id and its actual field values,
  so the user sees what landed — not just that the call returned success.
- Note the listing is created as a **draft** (inactive) — publishing it, and
  adding photos, happens in Etsy's UI. There is no image-upload tool in this
  server; say so rather than letting the user assume the listing is
  buyer-visible.

---

## Phase 1 — RESEARCH

### Step 0 — Get the product brief (ask, don't assume)

If the user hasn't already provided these, ask before touching any tool.
Ask them together in one message, not as an interrogation drip:

1. **What is the product?** One or two sentences — enough to know what a buyer
   would type to find it.
2. **Format and materials** — physical or digital? What's it made of / what
   files does the buyer get? (This feeds tags, the `materials` field, and the
   description's practical section.)
3. **Intended price range** — even a rough band. Research will show the
   market band; knowing where the seller wants to sit shapes positioning
   language ("premium hand-finished" vs "budget-friendly bundle").
4. **Does this extend an existing product line in the shop?** If yes, the
   shop's own winners become a second research source. If it's a brand-new
   direction, skip the internal benchmark and say so — don't force it.
5. **Who is it for / what occasion**, if the user knows. If they don't,
   research will propose answers — that's fine, note it as a hypothesis.

If the user gives a thin brief and wants to skip questions, proceed with what
exists but label every assumption in the final report.

### Step 1 — Form the keyword hypothesis

From the brief, write down 2-4 candidate search phrases a buyer would
actually type — not marketing language, buyer language ("boho wall decor",
not "artisanal bohemian-inspired living accent"). These are hypotheses;
Step 2 tests them.

### Step 2 — External benchmark: read what's actually ranking

For the strongest 1-2 candidate phrases, call `search_listings` and take the
**top 10-15 results** — not 2-3; two listings sharing a pattern is
coincidence, half the sample sharing it is a signal. Pull full details with
`get_listing_details` (batch thinking: respect the 5 req/s, 5,000/day
rate limit — don't fan out across five keyword variants at full depth).

Extract, concretely:

- **Title anatomy** — what do the first ~40 characters of ranking titles
  contain? What separator convention dominates (pipes, commas, dashes)?
  What modifier types appear (material, size, occasion, recipient)?
- **Tag frequency table** — tally every tag across the sample. Tags appearing
  on 5+ of 15 ranking listings are the niche's table-stakes vocabulary;
  tags appearing on 1-2 high-ranking listings may be underexploited angles.
  Both matter: the first group gets the new listing into the right searches,
  the second is where a new listing can actually win.
- **Price band** — compare **landed price** (price + primary domestic
  shipping) where shipping data is visible, per the shared standards file.
  Note that visible prices may be temporary sale prices the API can't
  distinguish — caveat, don't assert.
- **Description openers** — read the first ~160 characters of the top 3-5.
  What claim do they lead with? That's the snippet game the new listing has
  to play.
- **Gaps** — angles (occasion, recipient, use-case) the ranking set is *not*
  covering. A new listing can't out-age incumbents, but it can own a phrase
  they're all ignoring.

Optionally sanity-check demand direction with `get_trending_listings` — if
the niche is adjacent to something currently trending, that's a phrasing
opportunity worth one tag; if not, skip it, trending data is broad-brush.

### Step 3 — Internal benchmark: the shop's own voice and winners
*(only if Step 0 said this extends an existing line)*

- Pull `get_receipt_transactions_by_shop` over a trailing 90-day window,
  count sales per listing_id, and treat listings with **≥5 sales** as
  winners. Fetch their details in one `get_listings_by_ids` batch call.
  Prefer winners from the **same product type** as the new product — a
  best-selling item from an unrelated line has the wrong cadence to imitate.
- From those winners, extract: title cadence, which tag *types* they lean on,
  price positioning, and description formatting habits (bullets vs prose,
  emoji or none, how sizing/files/shipping info is presented).
- Call `get_shop` and read the announcement/bio for brand voice.
- **If fewer than 3 listings qualify as winners, skip this benchmark and say
  so in the report** — the copy then leans on the external benchmark alone
  and that's a stated confidence downgrade, not something to hide.

The point of this step: the new listing should read like *this shop wrote
it*, not like an SEO tool wrote it. Voice consistency across a shop is a
conversion asset; twenty listings that all sound like the same generic
optimizer dilute the brand.

### Step 4 — Synthesize before writing anything

One short paragraph, stated to the user in the report: "Here's what's ranking
for X, here's the vocabulary the niche uses, here's the gap this listing will
aim at, here's the voice it will be written in." Every generation decision in
Phase 2 must trace back to a line in this synthesis. If a decision can't be
traced to research, it's theory — flag it as such.

---

## Phase 2 — GENERATION

Everything here is drafted against Phase 1's findings, with the field rules
enforced *at the point of writing*, not remembered from the top of the file.

### Title

Constraints (hard, from the API — see `../_shared/etsy-seo-standards.md`):
**max 140 characters**; letters, numbers, punctuation, math symbols,
whitespace, ™ © ® allowed; the characters **`%` `:` `&` `+` may each appear
at most ONCE** — a second use is an API rejection, so if the draft needs
"Mix & Match" and "Salt & Pepper", one of them gets rewritten.

Structure: `[Primary Keyword] | [Secondary Keyword + Modifier] | [Occasion
or Recipient]`

- The **first ~40 characters** carry the most search weight — they must
  contain the primary keyword phrase from Step 2, verbatim as buyers type
  it, not a prettier paraphrase of it.
- **No keyword repetition.** Do not use the same word/phrase 2-3 times
  ("Dad Shirt Father Shirt Dad Gift") — per 2026 guidance it no longer helps
  ranking and it costs clicks because it reads as spam. Each segment covers
  a *different* buyer angle: what it is → who it's for or the occasion →
  material/style/format modifier. If two segments share a word, rewrite one.
- Use most of the 140 characters, but never pad — a tight 110-character
  title with three distinct angles beats a stuffed 140.
- If the user asks for a "meta title": Etsy has no separate meta-title
  field — the title IS the Google/page headline. Answer with the title.

Before presenting, **count the characters and state the count.**

### Tags — all 13, no exceptions, no near-duplicates

Constraints (hard): exactly **13 slots**, each **≤20 characters**; letters,
numbers, whitespace, `-`, `'` (cannot *start* with `-` or `'`), ™ © ® — no
other punctuation, the API rejects it. No tag may exactly duplicate another
tag or the title verbatim.

Fill the 13 slots by **buyer intent**, not by rephrasing one keyword
thirteen ways — a near-duplicate is technically valid and strategically
worthless, since it wastes a slot on a search the listing already matches.
A default allocation to adapt (not a straitjacket — reallocate based on what
Step 2's frequency table showed matters in this niche):

| Slots | Intent | Sourced from |
|---|---|---|
| 2-3 | What it is (primary + one long-tail variant) | Step 2 table-stakes tags |
| 2 | Material / format | Product brief |
| 2 | Occasion (holiday, event, season) | Step 2 + calendar proximity |
| 2 | Recipient ("gift for her", "teacher gift") | Step 2 gaps |
| 2 | Use-case / placement ("nursery decor", "cricut project") | Step 2 |
| 1-2 | Style / aesthetic ("boho", "minimalist") | Shop voice + niche vocabulary |
| 1 | Underexploited angle from Step 2's gap analysis | The "win" tag |

Multi-word tags matching real long-tail searches beat single broad words —
"personalized dog mom" works harder than "dog". Before presenting, **check
every tag's length and uniqueness** and show the character count next to
each; a confirmed draft the API bounces is a wasted round-trip.

### Description

Constraints: no hard API limit (~10,000 chars practically), but the **first
~160 characters are the search-result / Google snippet** — and the working
target for conversion is **150-400 words**, scannable, not a wall of prose.

Structure:

1. **The hook (first 160 characters).** Written like an ad headline:
   outcome + product + differentiator. Never "Welcome to my shop!", never
   scene-setting ("There's nothing quite like..."), never a materials
   recitation. It should survive being read *alone* in a Google result and
   still earn the click. Draft it separately, count its characters, then
   weld it to the top of the body.
2. **What it is / what you get** — 2-4 short lines or bullets. For digital
   products: exact file formats, dimensions, what's included, "no physical
   item shipped" stated plainly (it preempts the most common 1-star review).
3. **Details** — materials, sizes, variations, personalization options.
   Bullets, not paragraphs.
4. **How to use / how it arrives** — download instructions or
   processing/shipping expectations.
5. **One closing line** in the shop's voice — care note, invitation to the
   rest of the line, whatever the shop's winners do (Step 3). Skip it if
   there's no internal benchmark rather than inventing a personality.

Formatting follows the shop's established habits from Step 3 (bullets vs
prose, emoji or none). No keyword-stuffing — the description sells to the
human who already clicked; the title and tags did the search work.

### Materials & Styles (bonus fields, cheap to include)

- `materials`: array of strings, **letters/numbers/whitespace only** — no
  punctuation, no hyphens ("100% cotton" is invalid; "cotton" is valid).
- `styles`: up to **2**, each **≤45 characters**, letters/numbers/whitespace
  only. Pull from Step 2's niche vocabulary.

### Pre-flight validation (run before presenting, every time)

- [ ] Title ≤140 chars; primary keyword inside the first ~40; `% : & +`
      each used at most once; no repeated keyword phrase
- [ ] Exactly 13 tags; every tag ≤20 chars; valid characters only; no exact
      duplicates of each other or the title; intents spread, not rephrased
- [ ] Hook ≤~160 chars and reads as an ad headline standing alone
- [ ] Description 150-400 words, scannable structure
- [ ] Materials/styles character rules met
- [ ] Every major copy choice traceable to a Phase 1 finding

---

## Report structure

Always output in exactly this format:

```
# New Listing Copy — <product name>

## Research summary
**Target keyword(s):** <phrases, and why — from Step 2>
**What's ranking now:** <title/tag patterns observed in the top 10-15>
**Market price band (landed):** <range, with sale-price caveat>
**The gap this listing aims at:** <underexploited angle>
**Shop voice basis:** <internal winners used, or "skipped — fewer than 3
qualifying winners / new product direction; external benchmark only">

## Copy rationale
<3-5 bullets tracing the title/tag/description choices to research findings>

---
COPY-PASTE BLOCKS
---

## TITLE  (<n>/140 chars)
```
<title text>
```

## TAGS  (13/13 — paste into the tag field one at a time)
```
<tag 1>
<tag 2>
...
<tag 13>
```
(each shown with its character count in the rationale above if any is near 20)

## DESCRIPTION  (<n> words — first 160 chars are the search snippet)
```
<full description text>
```

## MATERIALS / STYLES (optional fields)
```
materials: <...>
styles: <...>
```

## Want me to create this as a draft listing?
I can create this directly as an (unpublished, photo-less) draft via
create_draft_listing. If you want that, I'll first show you the complete
payload — every field exactly as it will be sent — and wait for your
explicit confirmation before calling anything. Otherwise, the blocks above
are ready to paste into Etsy's listing form.

## Honest limits
<the blind-spots paragraph below, adapted to this run>
```

## Blind spots — state these plainly, never paper over them

- The Etsy API exposes **no search-volume, views, favorites, click-through,
  or conversion data**. Phase 1 reads what's *ranking*, which is a strong
  proxy for what's *working*, but this copy is a **well-grounded hypothesis,
  not a ranking guarantee** — new listings also compete on factors no copy
  can control (listing age, review history, conversion track record, photo
  quality).
- Photos are likely the single biggest conversion lever and this system
  can't upload or evaluate them — that's entirely on the seller, and worth
  saying out loud rather than letting great copy imply a finished listing.
- Competitor prices observed in research may be temporary sale prices the
  API can't distinguish from list price.
- The honest instruction to leave the user with: **treat the first 30 days
  as the experiment.** Watch sales and favorites; if the listing isn't
  moving, come back and run `etsy-optimize-listing` against it — by then it
  will be a live listing with its own data, which is exactly what that
  sibling skill is for.
