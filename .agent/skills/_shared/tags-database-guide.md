# Tags Database — shared save/reuse workflow

Referenced by every audit/research skill that surfaces tags from competitor or
best-seller research (`etsy-keyword-research`, `etsy-optimize-listing`,
`etsy-new-listing-copywriter`, `etsy-audit-listing`, `etsy-niche-scanner`),
and by every create/optimize skill that drafts new tags
(`etsy-new-listing-copywriter`, `etsy-optimize-listing`). This is a **local
data file**, not an Etsy API resource — read/write it with the ordinary
Read/Write/Edit file tools, never through an `etsy` MCP tool.

## File location

`../../../etsy-mcp-server/data/tags-database.json`, relative to any skill's
own folder (`.claude/skills/<name>/` or `.agent/skills/<name>/` — both are
siblings of the project root, so this same relative path resolves to the
exact same physical file from either location; there is only ever one
database, nothing to keep in sync). It's gitignored (shop-specific runtime
state, like `accounts.json`) — if the file doesn't exist yet, create it with
the skeleton below rather than treating a missing file as an error.

## Schema

```json
{
  "version": 1,
  "last_updated": "<ISO date of the most recent write>",
  "categories": {
    "<category-slug>": {
      "label": "<human-readable category, e.g. \"Boho Wall Decor\">",
      "tags": {
        "<tag text — lowercase, per the shop's tag lowercase rule>": {
          "status": "common | unique",
          "times_seen": 0,
          "sample_size": 0,
          "sources": [
            {"skill": "<skill name>", "context": "<keyword searched or listing id>", "date": "<date>"}
          ],
          "first_saved": "<date>",
          "last_seen": "<date>"
        }
      }
    }
  }
}
```

`times_seen` and `sample_size` are **cumulative across every run that has
touched this tag**, not reset per run — they answer "across everything we've
ever researched, how often has this tag shown up." `status` is `common` if
`times_seen / sample_size >= 0.5` (same "at least half the sample" threshold
already used across every audit/optimize skill for pattern-detection),
otherwise `unique`.

## When to offer to save (research/audit skills)

Any skill that produces a tag frequency table, tag frequency analysis, or a
keyword/tag cluster from competitor or best-seller research — right after
presenting that finding to the user, ask: **"Save these tags to the tags
database for future reuse? (yes/no)"** Don't ask again later in the same run
if they already answered.

If yes:

1. Read the database file (create it with the skeleton above if it doesn't
   exist).
2. **Decide the category yourself — don't ask the user to name one.** Base it
   on the product/niche the research targeted (e.g. research on "boho wall
   decor" → slug `boho-wall-decor`, label "Boho Wall Decor"). **Reuse an
   existing category if the new tags clearly belong to a niche already in the
   database** — match by product-type/keyword similarity, not exact string
   equality (e.g. "personalized dog tag" and "custom pet id tag" research
   both belong under one `personalized-pet-tags` category, not two
   near-identical ones). Only create a new category when the product type
   genuinely doesn't fit an existing one. State which category (new or
   existing) you filed it under so the user can correct you if it's wrong.
3. For each tag from this run: if new to that category, add it with this
   run's `times_seen`/`sample_size` and compute `status`. If it already
   exists in that category, **increment** `times_seen`/`sample_size`
   cumulatively (never overwrite), append an entry to `sources`, update
   `last_seen`, and recompute `status` off the new cumulative totals.
4. Write the file back, update `last_updated`. Confirm briefly what happened,
   e.g. "Saved 9 tags to `boho-wall-decor` — 6 new, 3 updated counts on
   existing tags."

If no: skip silently and move on.

## When to offer reuse (create/optimize skills)

Before starting fresh keyword/tag research, check the database for a
category matching the target product/niche. If a match exists with saved
tags, show the user the saved tags for that category (with their
`status`/`times_seen`) and ask: **"Use these existing saved tags as a
starting point, or should I do fresh research?"**

- **Use saved tags:** treat them as this run's tag findings — skip the live
  competitor tag-frequency pull, but still re-validate every tag against the
  *current* field/style rules (length, lowercase, no duplicates — see
  `etsy-seo-standards.md`) before drafting, since entries may have been saved
  before a rule existed or changed.
- **Fresh research:** proceed with the skill's normal research step. At the
  end, still run the save-prompt above so the database stays current — fresh
  research is a chance to refresh a stale category, not a reason to skip
  saving.

If no matching category exists, say so plainly and proceed with fresh
research — don't turn a database check into a bottleneck when there's
nothing to reuse yet.

## Blind spots — state plainly

This database only ever contains what a user chose to save from past runs —
it is not automatically comprehensive and can go stale as a niche's ranking
patterns shift over time. Use `last_seen` to flag an old category (e.g.
"these tags were last saved 4 months ago — consider a fresh research pass")
rather than silently treating old saved tags as current market truth.
