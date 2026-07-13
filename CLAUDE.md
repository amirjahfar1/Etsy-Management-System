# Etsy Management System

This project is a local MCP-based system for managing Etsy shop(s) through Claude. The architecture supports multiple connected Etsy accounts; only one is connected today, but adding another is just running the OAuth helper again with a new name — no code changes needed.

## Safety rule — ALWAYS CONFIRM BEFORE WRITE/DELETE

Any tool call that **creates, updates, or deletes** data on Etsy (listings, shop settings, sections, shipping profiles, orders, etc.) must be confirmed with the user **before** it is executed. Show what will change (which item, which fields, old → new values) and wait for an explicit "yes/haan/confirm" before calling the tool. This applies to every `create_*`, `update_*`, and `delete_*` tool below — never call them straight off a single ambiguous request. Read-only tools (`get_*`, `find_*`, `search_*`, `list_*`) do not need confirmation.

Reason: these actions are live and mostly irreversible against a real, active shop — an accidental delete or edit cannot be undone through the API.

## Standing rule — when a live API call errors, fix it AND document it

Whenever a `create_*`/`update_*` call to the Etsy API fails with an error this project didn't already know about (a missing required field, a field-name mismatch, an unexpected format rule, an API limit) — don't just patch it in the moment for that one call and move on:

1. **Diagnose the real cause** — check the exact field/requirement via the `etsy-docs` MCP (`get_endpoint` for the operationId), don't guess from the error text alone.
2. **If it's a bug in this server's code** (`etsy-mcp-server/src/index.ts`) — fix it, rebuild (`npm run build`), and tell the user the running MCP server needs a session restart to pick up the new build (it won't reload itself mid-session).
3. **If it's a genuine Etsy API requirement a skill's field-gathering step didn't ask for** — update that skill's `SKILL.md` so the next run asks for/handles it upfront instead of discovering it live again. Name the **exact error message** the API returned next to the fix, not just a vague "handle this correctly" — that's what makes the note findable next time a similar error shows up. Keep `.claude/skills/<name>/SKILL.md` and `.agent/skills/<name>/SKILL.md` in sync (see "Deploying to Google Antigravity" below) — a fix in only one copy means the other AI tool hits the same error again.
4. **If it's project-wide knowledge** (not specific to one skill's flow, e.g. a generic-dispatcher fix or a field quirk that affects multiple tools) — add it to this file's "Which tool to call" section instead of a single skill.

The goal: this system gets more reliable with use — the same live-API error should never happen twice.

## Project layout

- `etsy-mcp-server/` — the MCP server (Node.js/TypeScript). `src/index.ts` is the source; `npm run build` compiles to `build/index.js`, which is what `.mcp.json` actually launches.
- `etsy-mcp-server/.env` — default app-level credentials (gitignored). Just `ETSY_API_KEY` / `ETSY_SHARED_SECRET`, required on every request. Used by any account that doesn't carry its own `api_key`/`shared_secret` in `accounts.json` (see below) — i.e. the default app, not necessarily the only one.
- `etsy-mcp-server/accounts.json` — **multi-account store** (gitignored). Shape:
  ```json
  { "default_account": "svgpngkingdom",
    "accounts": {
      "svgpngkingdom": { "shop_id": "52245094", "shop_name": "SVGPNGKINGDOM", "access_token": "...", "refresh_token": "..." },
      "abbas_etsy": { "shop_id": "...", "shop_name": "...", "access_token": "...", "refresh_token": "...", "api_key": "nwn9g575t16qwhg2fmjoiffy", "shared_secret": "lfdixxbl1a" }
    } }
  ```
  Every OAuth-authenticated tool takes an optional `account` argument (falls back to `default_account` when omitted). Access tokens auto-refresh on a 401 and get rewritten here — nothing to do manually. `api_key`/`shared_secret` are **optional per account** — present only when that account was connected through its own separate Etsy Developer App (different keystring/shared secret than `.env`); when absent, the account falls back to the default `.env` credentials. `index.ts`'s `getOauthClient`/`refreshAccessToken` already read this fallback — no code changes needed to add more accounts, whether they share the default app or bring their own.
- `etsy-mcp-server/data/tags-database.json` — **accumulated tag research store** (gitignored, like `accounts.json`). Not an Etsy API resource — plain local JSON that skills read/write directly with the Read/Write/Edit file tools. Holds tags saved from past competitor/best-seller research, organized into skill-decided categories (e.g. `boho-wall-decor`) with a `common` vs `unique` classification and a cumulative `times_seen`/`sample_size` count per tag. Full schema and the save/reuse workflow live in `.claude/skills/_shared/tags-database-guide.md`. Research skills (`etsy-keyword-research`, `etsy-optimize-listing`, `etsy-new-listing-copywriter`, `etsy-audit-listing`, `etsy-niche-scanner`) offer to save tags they surface here; create/optimize skills (`etsy-new-listing-copywriter`, `etsy-optimize-listing`) check it first and offer to reuse a matching category instead of researching from scratch.
- `etsy-mcp-server/data/products/<Supplier Name> products/<product-slug>.json` — **saved product templates, organized by supplier** (gitignored, like `accounts.json`/`tags-database.json`). One JSON file per product built by `etsy-create-listing` from a source URL (e.g. a Merchize/dropship product page), grouped into a per-supplier subfolder (`Merchize products/`, `Printify products/`, etc. — this shop sources from multiple suppliers, so templates are never mixed into one flat folder): the full copy (title/tags/description), taxonomy, materials/styles, variant structure with per-SKU pricing, the image source list (including the original `source_url`), and a reusable shipping-profile shape, plus a `published_listings` history of every account/listing_id it's already been published to. The point: publishing the *same* product to a *different* (or the same) Etsy account later reuses everything account-agnostic and only redoes the genuinely account-specific parts (shipping/processing profile, the actual `create_draft_listing`/`update_listing_inventory`/image-upload calls — every write still gets its own confirmation, reuse only speeds up research). Full schema and the save/reuse workflow live in `.claude/skills/_shared/product-templates-guide.md`.
- `etsy-mcp-server/data/listings/<account>/<listing_id>.json` — **as-built, kept-current record of every listing this system has created**, one subfolder per connected account (gitignored, like the stores above). Unlike the product-templates store (a reusable *recipe*, opt-in), this one is **mandatory and stays current for the listing's whole life, not just at creation** — `etsy-create-listing`/`etsy-new-listing-copywriter` write it incrementally on creation (right after each successful `create_draft_listing`, `update_listing_inventory`, image upload), and **any later successful `update_listing`/`update_listing_inventory`/image call from any skill** (`etsy-optimize-listing` rewriting copy, `etsy-seasonal-keywords` rotating tags, or an ad-hoc edit) must sync the changed fields back into that listing's record too — no user prompt needed for any of this, it's local bookkeeping alongside the confirmed Etsy write. Holds the full field payload, variants, and image list as they currently stand, plus a `product_template_ref` cross-link back to the product template if the listing came from one. Full schema and the sync-on-every-update rule live in `.claude/skills/_shared/listings-record-guide.md`.

### Connecting a new account

When the user gives you an account name plus Etsy keys (keystring + shared secret) to connect, or just an account name if it's meant to reuse the default app:

1. **Always use the remote OAuth flow, never the localhost one** — the localhost flow (`node oauth-setup.js <name>`, no flags) opens a local port-3945 listener that only works if Claude and the user's browser are on the same machine/session; the **remote flow uses the already-configured `aamirali.com/etsy-callback.php` catcher**, which works regardless. Use the two-step split (`--init` then `--complete=`) since Claude runs the commands non-interactively:
   ```
   node oauth-setup.js <account-name> --init                        # if reusing the default .env app
   ETSY_API_KEY=<keystring> ETSY_SHARED_SECRET=<shared_secret> node oauth-setup.js <account-name> --init   # if given separate keys
   ```
   This prints an authorize URL — give it to the user and ask them to open it, log in as that shop's owner, approve, and paste back the `<state> <code>` line the catcher page shows.
2. Before sending the URL, remind the user (once) to confirm `https://aamirali.com/etsy-callback.php` is registered as a Callback URL on that Etsy app's dashboard (alongside the localhost one Etsy apps support multiple registered callback URLs).
3. Once they paste back the line, complete it with the same env vars used in step 1:
   ```
   node oauth-setup.js <account-name> --complete="<pasted state> <pasted code>"
   ```
   This writes `shop_id`/`shop_name`/`access_token`/`refresh_token` into `accounts.json` — and `api_key`/`shared_secret` too, whenever they were passed via env override, so future refreshes automatically use the right app.
4. Confirm the connection works with a cheap read call (e.g. `get_shop` or `get_me` with that `account`) before telling the user it's done.

### Session account context

Once the user tells you which account to work on (by name, or by giving you keys to connect one), **treat that as the active account for the rest of the session** — pass it as the `account` argument on every subsequent tool call without asking again. Only re-confirm if the user names a different account or the request is ambiguous about which shop it targets. Don't make the user repeat "on account X" for every message.
- `etsy-mcp-server/oauth-setup.js` — authorization helper, **one run per account**. **Default to the remote flow, not the localhost one** — see "Connecting a new account" below for the exact steps and why.
- `list_accounts` / `set_default_account` tools — see which accounts are connected and switch the default without re-running OAuth.
- `.mcp.json` — registers two MCP servers: `etsy` (this project's own server) and `etsy-docs` (Etsy's hosted, read-only spec-knowledge server at `https://mcp.api.etsycloud.com/mcp` — has no write access, just documentation).

## Which tool to call — quick map

The `etsy` MCP server exposes ~50 tools. Full parameter-level detail lives in the tool descriptions themselves, and exact field names for any endpoint can always be looked up live via the **`etsy-docs` MCP's `get_endpoint`** tool (pass the Etsy `operationId`) — don't hand-maintain a duplicate field reference here, it will drift from the real API.

**Array-typed fields are auto-coerced.** Every write tool that goes through the generic dispatcher (`callWriteEndpoint` in `index.ts`) runs `coerceJsonLikeStrings` on the arguments before building the request: any argument that arrives as a *string* shaped like a JSON array/object (e.g. `tags` arriving as the literal text `["a","b"]` instead of a real array — this happened in practice and produced either an opaque `400`/`"Request failed with status code 400"` or, once the array shape did get through, Etsy's own `"contains invalid characters"` on `/tags` from the literal `[`/`"`/`,` characters) gets `JSON.parse`d back into its real type first. This is a permanent server-side fix, not a per-call workaround — no skill needs to special-case array fields because of it. If a future write call still 400s on an array-shaped field, check this function still runs before assuming the field name or value is wrong.

**Public / read-only (no OAuth, any shop or listing):**
`search_listings`, `get_listing_details`, `search_shops`, `get_shop_by_name`, `get_shop_listings`, `get_shop_reviews`, `get_trending_listings` — browsing/market-research on any shop, not just your own.

**Listings — your own shop (OAuth):**
`get_listings_by_shop`, `find_all_active_listings_by_shop`, `get_listing`, `get_listings_by_ids`, `get_featured_listings_by_shop`, `get_listing_properties`, `get_listing_property` — read.
`create_draft_listing`, `update_listing`, `delete_listing`, `update_listing_property`, `delete_listing_property` — **write, confirm first**. These go through the generic dispatcher (`additionalProperties: true`), so every field `createDraftListing`/`updateListing` accepts (title, description, price, quantity, who_made, when_made, taxonomy_id, shipping_profile_id, return_policy_id, materials, shop_section_id, processing_min/max, tags, styles, item_weight/length/width/height + units, is_supply, is_customizable, should_auto_renew, is_taxable, type, image_ids, state, etc.) already works — pass them as extra arguments, no code changes needed. Exact field list: `etsy-docs`'s `get_endpoint` for `createDraftListing`/`updateListing`. Two field-level gotchas confirmed against the live API (not obvious from field names alone):
  - **`readiness_state_id` is required on `create_draft_listing` for physical listings** (Etsy added this on top of the older `processing_min`/`processing_max` pair) — call `get_processing_profiles` first (same pattern as `get_shop_shipping_profiles`) and pass an existing `readiness_state_id`, or `create_processing_profile` if none fit. Omitting it fails with `"A readiness_state_id is required for physical listings."`.
  - **`styles` is create-only** — `createDraftListing` accepts a `styles` field, but `updateListing` has no `style`/`styles` field in its request body at all (confirmed via `etsy-docs`), so it silently can't be set after the draft exists. Set it at `create_draft_listing` time or not at all through this API — it isn't fixable with a later `update_listing` call.

**Listing variations / inventory (OAuth):** `get_listing_inventory`, `get_listings_inventory_by_ids`, `get_listing_product`, `get_listing_variation_images` — read.
`update_listing_inventory` (per-variation SKU/price/quantity — needs a `products` array; see `getListingInventory`'s response shape for the exact structure), `update_variation_images` (assign images to variation values) — **write, confirm first**. Two more requirements the response shape alone doesn't make obvious:
  - Each `property_values` entry that uses one of taxonomy's freeform **"Custom Property"** slots (no fixed `possible_values` list — check `getPropertiesByTaxonomyId`) must include an explicit `property_name` string (e.g. `"Type"`, `"Size"`) alongside `property_id`/`values`, or the call fails with `"Expected string value for 'property_name' (got NULL)"`.
  - Every entry in each product's `offerings` array needs its own `readiness_state_id` (same value as the listing's, from `get_processing_profiles`) — omitting it fails with `"All offerings need readiness state"`.

**Listing images/videos (OAuth):** `get_listing_images`, `get_listing_videos` — read (public, no OAuth needed but routed through the authenticated client).
`upload_listing_image` (from a local `image_path`, or re-assign a deleted one via `listing_image_id`), `delete_listing_image`, `upload_listing_video` (from a local `video_path`, or re-associate via `video_id`), `delete_listing_video` — **write, confirm first**. These bypass the generic dispatcher (multipart/form-data, via the `form-data` package) since Etsy requires a binary file part — see `uploadListingImage`/`uploadListingVideo` handlers in `index.ts`.

**Digital listing files — the actual buyer download (OAuth):** `get_all_listing_files`, `get_listing_file` — read (empty result for physical listings).
`upload_listing_file` (from a local `file_path`, or re-associate via `listing_file_id`), `delete_listing_file` — **write, confirm first**. `upload_listing_file` bypasses the generic dispatcher (multipart, same as image/video). **Built-in safety check**: attaching a file to a listing that isn't already `type: "download"`/`"both"` silently converts it into a digital listing and strips shipping/variations — the tool fetches the listing first and refuses unless it's already digital, or `force: true` is explicitly passed. Symmetric risk on delete: removing a digital listing's *last* remaining file converts it back to physical — the tool description flags this, but there's no automatic guard on delete, so confirm with the user before deleting a listing's only file.

**Shop return policies (OAuth):** `get_shop_return_policies`, `get_shop_return_policy` — read.
`create_shop_return_policy` (needs `accepts_returns`, `accepts_exchanges`, and `return_deadline` — one of 7/14/21/30/45/60/90 days — if either is true), `update_shop_return_policy`, `delete_shop_return_policy`, `consolidate_shop_return_policies` — **write, confirm first**. `create_draft_listing`'s optional `return_policy_id` references these.

**Shop settings (OAuth):**
`get_shop`, `get_shop_by_owner_user_id`, `find_shops`, `get_shop_production_partners`, `get_shop_sections`, `get_shop_section` — read.
`update_shop`, `create_shop_section`, `update_shop_section`, `delete_shop_section` — **write, confirm first**. **`update_shop` only writes `title`, `announcement`, `sale_message`, `digital_sale_message`, and `policy_additional`** (and `policy_additional` only for EU-based shops — passing it for a non-EU shop errors). The other policy text seen in `get_shop`'s response (`policy_payment`, `policy_shipping`, `policy_refunds`, `policy_privacy`, `policy_welcome`, `policy_seller_info`) belongs to Etsy's "structured policies" system and is **read-only via the API** — it can only be edited through Shop Manager on etsy.com (Settings → Policies). When a skill needs to change shop policy wording, draft the text and hand it to the user to paste in manually; don't assume `update_shop` can write it.

**Shipping (OAuth):**
`get_shipping_carriers`, `get_shop_shipping_profiles`, `get_shop_shipping_profile`, `get_shipping_profile_destinations`, `get_shipping_profile_upgrades`, `get_holiday_preferences`, `get_processing_profiles`, `get_processing_profile` — read.
`create_shop_shipping_profile`, `update_shop_shipping_profile`, `delete_shop_shipping_profile`, `create_shipping_profile_destination`, `update_shipping_profile_destination`, `delete_shipping_profile_destination`, `create_shipping_profile_upgrade`, `update_shipping_profile_upgrade`, `delete_shipping_profile_upgrade`, `update_holiday_preferences`, `create_processing_profile`, `update_processing_profile`, `delete_processing_profile` — **write, confirm first**.

**Orders / Receipts (OAuth):**
`get_shop_receipts`, `get_shop_receipt`, `get_receipt_transactions_by_listing`, `get_receipt_transactions_by_receipt`, `get_receipt_transaction`, `get_receipt_transactions_by_shop` — read.
`update_shop_receipt` (mark paid/shipped), `create_receipt_shipment` (submit tracking, emails the buyer) — **write, confirm first**.

**Payments (OAuth, read-only):**
`get_payment_ledger_entry`, `get_payment_ledger_entries`, `get_payment_ledger_entry_payments`, `get_payment_by_receipt`, `get_payments` — reconciliation/financial data, no write operations exist on this API.

**Reviews:**
`get_reviews_by_listing` (per-listing reviews) — public, no OAuth needed. (Shop-level reviews are already covered by `get_shop_reviews`.)

**User Management (OAuth) — mixed scope status:**
`get_me` — works now (needs `shops_r`, already granted): returns your own user_id/shop_id.
`get_user`, `get_user_address`, `get_user_addresses`, `delete_user_address` — **NOT usable yet**. They need `email_r`/`address_r`/`address_w`, which aren't in the currently authorized token. Calling them returns a clear `"Access token lacks scope..."` error rather than failing silently. To enable them: re-run `node oauth-setup.js svgpngkingdom` (same account name re-authorizes with the updated scope list already in `oauth-setup.js`) and approve again in the browser.

**Not yet implemented** (endpoints exist on Etsy but no tool here yet): private review detail beyond ratings/text. Ask before assuming these work — check `etsy-docs`'s `list_endpoints` if unsure whether something is possible at all versus just not wired up yet.

## Agency skills — `.claude/skills/`

22 project skills turn the raw tool map above into repeatable, agency-style playbooks. Each is a `SKILL.md` under `.claude/skills/<name>/` with pushy trigger phrasing in its `description` (so it auto-invokes on natural requests, not just exact skill names) and a fixed output template. All of them inherit the confirm-before-write rule above — any skill whose workflow reaches a `create_*`/`update_*`/`delete_*` call stops at an OLD → NEW diff and waits for explicit confirmation before calling it. Shared field-limit facts (title/tag/description rules, landed-price logic, merchandising checklist) live in `.claude/skills/_shared/etsy-seo-standards.md`, confirmed straight from the live Etsy API schema — referenced by the skills below rather than duplicated.

That shared file also holds the **Copy QA Gate** — a mandatory checklist (no em dashes, grade 5-7 reading level, no AI-tell phrasing, no trademarked/copyrighted names, no misleading claims, not copied verbatim from competitor research, tone matches the shop's voice) that `etsy-new-listing-copywriter`, `etsy-optimize-listing`, and `etsy-seasonal-keywords` must run against any drafted title/tags/description **before** showing it to the user and **again immediately before** the `create_draft_listing`/`update_listing` call. No listing copy reaches the user's screen or Etsy's API without clearing it first.

- **Core audit/optimize**: `etsy-audit-account` (whole-shop health scorecard), `etsy-audit-listings` (bulk scan of every listing), `etsy-audit-listing` (deep single-listing critique), `etsy-optimize-listing` (rewrites an *existing* listing by benchmarking it against the shop's own best-sellers + top-ranking competitors, then diffs and waits for confirm), `etsy-listing-qa-check` (fast mechanical rules-compliance pass — title/tag/description field rules and shop style rules from `etsy-seo-standards.md` only, no competitor research or strategy judgment; works on one listing or the whole catalog)
- **New listing creation**: `etsy-new-listing-copywriter` — for a product that has **no listing yet**: runs the same keyword/competitor/internal-benchmark research as `etsy-optimize-listing`, then generates a copy-paste-ready title/13-tags/description (140-char title, 13×≤20-char tags, 160-char description hook), offering to call `create_draft_listing` only after explicit confirmation of the exact payload; `etsy-create-listing` — the fuller guided end-to-end creation flow: explicit physical/digital branching (sets `type` correctly), reuses the copywriter's research/copy phases, then handles variations via `update_listing_inventory`, image/video uploads, and attaching the digital deliverable file — each write individually confirmed. Use it when the new listing needs variants, images, or a digital file; the copywriter alone covers copy-only or simple no-variant drafts
- **Market intelligence**: `etsy-competitor-research`, `etsy-niche-scanner`, `etsy-product-ideation`
- **SEO & keywords**: `etsy-keyword-research`, `etsy-seasonal-keywords`
- **Pricing & finance** (read-only diagnostics): `etsy-financial-report`, `etsy-pricing-audit`, `etsy-fee-watchdog`
- **Reviews & customers**: `etsy-review-insights`, `etsy-review-responder` (drafts only — no reply-to-review endpoint exists), `etsy-repeat-buyer-radar`
- **Operations**: `etsy-morning-briefing` (pairs well with `/schedule`), `etsy-ship-assistant` (per-order confirmation, never batched — `create_receipt_shipment` emails the buyer), `etsy-sales-forensics`
- **Storefront**: `etsy-storefront-audit`

Known blind spots baked into these skills' honesty about limits: no Etsy analytics/traffic/views/favorites API, no Ads API, and no COGS data (profit margin needs the user to supply product costs once). Don't let a skill imply it has data it doesn't. (Image/video/digital-file upload used to be a gap — it's now wired up, see the tool map above; skills referencing "no image-upload tool" are stale and should be corrected if noticed.)

## Deploying to Google Antigravity

This project also runs on Google Antigravity, not just Claude Code. Two independent things are set up for it — they don't share storage, so both matter:

1. **Skills** — `.agent/skills/` at the project root is a full copy of `.claude/skills/` (identical `SKILL.md` format; Antigravity just reads a different folder name). It's part of the project folder, so copying/cloning the whole project carries it over automatically — nothing to redo. Keep it in sync with `.claude/skills/` any time a skill changes (re-copy the folder, or symlink).
2. **MCP server registration** — Antigravity has a known bug where project-local MCP config (`.agent/mcp_config.json`, `.antigravitycli/mcp_config.json`) is silently discovered but ignored; only the **global, per-machine** config actually spawns servers: `~/.gemini/antigravity/mcp_config.json` (Settings → Customizations → Open MCP Config in the Antigravity UI edits this same file). This file lives **outside** the project folder, so it is *not* carried over when the project is copied/cloned — every machine that runs Antigravity against this project needs the `etsy` and `etsy-docs` entries added there by hand:
   ```json
   "etsy": {
     "type": "stdio",
     "command": "node",
     "args": ["<absolute-path-to>/etsy-mcp-server/build/index.js"],
     "env": { "ETSY_API_KEY": "...", "ETSY_SHARED_SECRET": "..." }
   },
   "etsy-docs": { "type": "http", "url": "https://mcp.api.etsycloud.com/mcp" }
   ```
   (Entry shape uses `"type"`, not `$typeName` — verified against this machine's actual working config; some blog posts describe an older/different schema.) After editing, restart Antigravity (or reopen the project) for the new server to load.

## Handing this project to someone else

Someone getting a copy of this project for **their own** Etsy shop (not svgpngkingdom) needs to:

1. **Copy the whole project folder**, including `.claude/skills/` and `.agent/skills/` — the skill playbooks are shop-agnostic and work unchanged for any shop.
2. **Get their own Etsy Developer app** ([etsy.com/developers/register](https://www.etsy.com/developers/register)) for their own `ETSY_API_KEY` / `ETSY_SHARED_SECRET`.
3. **Build the server**: `cd etsy-mcp-server && npm install && npm run build`.
4. **Set their own credentials**: copy `etsy-mcp-server/.env.example` → `.env`, fill in their key/secret.
5. **Connect their shop**: `node oauth-setup.js <their-shop-name>` — opens a browser, writes their own `accounts.json`. This is what makes every tool (`get_shop`, `update_listing`, etc.) operate on *their* shop instead of svgpngkingdom.
6. **Wire up their AI tool**:
   - *Claude Code*: `.mcp.json` itself is gitignored (it holds this machine's real API key/secret) — copy the committed `.mcp.json.example` to `.mcp.json` and fill in your own path/credentials (or delete the `env` block entirely — the server already falls back to reading its own `.env` file if the host doesn't inject these vars).
   - *Antigravity*: add the same `etsy`/`etsy-docs` entries to **their own** `~/.gemini/antigravity/mcp_config.json` per the section above — this is per-machine and can't be skipped by copying the project.

Nothing inside the skills needs editing — they call tools by name, not by a hardcoded shop ID, so once steps 1–6 are done, every skill (`etsy-audit-account`, `etsy-optimize-listing`, etc.) works against the new shop unchanged.

## Rate limits

Per API key: **5 requests/second, 5,000/day**. Be careful with loops over many listings/orders — batch where a tool supports it (e.g. `get_listings_by_ids`) instead of one call per item.

## Roadmap

1. ✅ **Multi-account credential store** — `accounts.json` holds `{ default_account, accounts: { <name>: { shop_id, shop_name, access_token, refresh_token, api_key?, shared_secret? } } }`. Every OAuth tool has an optional `account` arg; `list_accounts`/`set_default_account` manage it. `api_key`/`shared_secret` are optional per-account overrides for accounts connected through their own separate Etsy Developer App (falls back to `.env` when absent). Done.
2. ✅ **Per-account OAuth/refresh** — `oauth-setup.js <account-name>` writes into `accounts.json`; `index.ts` keeps one axios client + 401-refresh-interceptor per account (`Map`-based cache in `getOauthClient`). Done.
3. **Fill functional gaps**: Receipts/Orders (mark shipped, tracking) ✅ → listing image/video/digital-file upload (multipart, via the `form-data` package — file upload has a built-in listing-type safety check, see above) ✅ → Shop Return Policies ✅ → listing inventory/variations (SKU, per-variation price/quantity) ✅ → Payments/Ledger (read-only) ✅ → User/UserAddress + private Reviews (blocked on scopes, see above).
4. **Safeguards** (not started) — server-side `confirm: true` required param on delete/high-risk-update tools (so a missed confirmation errors instead of silently executing), optional `ETSY_DRY_RUN` mode, an append-only `logs/writes.jsonl` audit log of every mutating call, and a shared rate-limit queue since all accounts draw from one app's 5 QPS / 5,000-per-day budget.
5. **Polish** (not started) — proactive token refresh before expiry (not just on 401), a `ping_account` smoke-test tool.

Nothing in this roadmap requires restructuring the existing 47-spec generic dispatcher in `index.ts`.
