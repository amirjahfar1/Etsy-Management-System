# Etsy Management System

This project is a local MCP-based system for managing Etsy shop(s) through Claude. The architecture supports multiple connected Etsy accounts; only one is connected today, but adding another is just running the OAuth helper again with a new name — no code changes needed.

## Safety rule — ALWAYS CONFIRM BEFORE WRITE/DELETE

Any tool call that **creates, updates, or deletes** data on Etsy (listings, shop settings, sections, shipping profiles, orders, etc.) must be confirmed with the user **before** it is executed. Show what will change (which item, which fields, old → new values) and wait for an explicit "yes/haan/confirm" before calling the tool. This applies to every `create_*`, `update_*`, and `delete_*` tool below — never call them straight off a single ambiguous request. Read-only tools (`get_*`, `find_*`, `search_*`, `list_*`) do not need confirmation.

Reason: these actions are live and mostly irreversible against a real, active shop — an accidental delete or edit cannot be undone through the API.

## Project layout

- `etsy-mcp-server/` — the MCP server (Node.js/TypeScript). `src/index.ts` is the source; `npm run build` compiles to `build/index.js`, which is what `.mcp.json` actually launches.
- `etsy-mcp-server/.env` — app-level credentials (gitignored, shared by every account). Just `ETSY_API_KEY` / `ETSY_SHARED_SECRET` — required on every request, same for the whole Etsy app regardless of which shop is being managed.
- `etsy-mcp-server/accounts.json` — **multi-account store** (gitignored). Shape:
  ```json
  { "default_account": "svgpngkingdom",
    "accounts": {
      "svgpngkingdom": { "shop_id": "52245094", "shop_name": "SVGPNGKINGDOM", "access_token": "...", "refresh_token": "..." }
    } }
  ```
  Every OAuth-authenticated tool takes an optional `account` argument (falls back to `default_account` when omitted). Access tokens auto-refresh on a 401 and get rewritten here — nothing to do manually. Only one account is connected right now; connecting a second is just running the OAuth helper again with a new name (see below) — no code changes needed.
- `etsy-mcp-server/oauth-setup.js` — authorization helper, **one run per account**: `node oauth-setup.js <account-name>` (or `npm run oauth -- <account-name>`). Runs a local callback server on the **fixed port 3945** (`http://localhost:3945/oauth/redirect` — this is what's registered in the Etsy app's Callback URLs, so it never needs to change no matter how many accounts get added) and writes the new account into `accounts.json`. If it's the first account connected, it also becomes `default_account`.
- `list_accounts` / `set_default_account` tools — see which accounts are connected and switch the default without re-running OAuth.
- `.mcp.json` — registers two MCP servers: `etsy` (this project's own server) and `etsy-docs` (Etsy's hosted, read-only spec-knowledge server at `https://mcp.api.etsycloud.com/mcp` — has no write access, just documentation).

## Which tool to call — quick map

The `etsy` MCP server exposes ~50 tools. Full parameter-level detail lives in the tool descriptions themselves, and exact field names for any endpoint can always be looked up live via the **`etsy-docs` MCP's `get_endpoint`** tool (pass the Etsy `operationId`) — don't hand-maintain a duplicate field reference here, it will drift from the real API.

**Public / read-only (no OAuth, any shop or listing):**
`search_listings`, `get_listing_details`, `search_shops`, `get_shop_by_name`, `get_shop_listings`, `get_shop_reviews`, `get_trending_listings` — browsing/market-research on any shop, not just your own.

**Listings — your own shop (OAuth):**
`get_listings_by_shop`, `find_all_active_listings_by_shop`, `get_listing`, `get_listings_by_ids`, `get_featured_listings_by_shop`, `get_listing_properties`, `get_listing_property` — read.
`create_draft_listing`, `update_listing`, `delete_listing`, `update_listing_property`, `delete_listing_property` — **write, confirm first**.

**Shop settings (OAuth):**
`get_shop`, `get_shop_by_owner_user_id`, `find_shops`, `get_shop_production_partners`, `get_shop_sections`, `get_shop_section` — read.
`update_shop`, `create_shop_section`, `update_shop_section`, `delete_shop_section` — **write, confirm first**.

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

**Not yet implemented** (endpoints exist on Etsy but no tool here yet): Shop Return Policies, private review detail beyond ratings/text, file/image/video upload for listings (needs multipart, can't use the generic dispatcher). Ask before assuming these work — check `etsy-docs`'s `list_endpoints` if unsure whether something is possible at all versus just not wired up yet.

## Agency skills — `.claude/skills/`

20 project skills turn the raw tool map above into repeatable, agency-style playbooks. Each is a `SKILL.md` under `.claude/skills/<name>/` with pushy trigger phrasing in its `description` (so it auto-invokes on natural requests, not just exact skill names) and a fixed output template. All of them inherit the confirm-before-write rule above — any skill whose workflow reaches a `create_*`/`update_*`/`delete_*` call stops at an OLD → NEW diff and waits for explicit confirmation before calling it. Shared field-limit facts (title/tag/description rules, landed-price logic, merchandising checklist) live in `.claude/skills/_shared/etsy-seo-standards.md`, confirmed straight from the live Etsy API schema — referenced by the skills below rather than duplicated.

- **Core audit/optimize**: `etsy-audit-account` (whole-shop health scorecard), `etsy-audit-listings` (bulk scan of every listing), `etsy-audit-listing` (deep single-listing critique), `etsy-optimize-listing` (rewrites an *existing* listing by benchmarking it against the shop's own best-sellers + top-ranking competitors, then diffs and waits for confirm)
- **New listing creation**: `etsy-new-listing-copywriter` — for a product that has **no listing yet**: runs the same keyword/competitor/internal-benchmark research as `etsy-optimize-listing`, then generates a copy-paste-ready title/13-tags/description (140-char title, 13×≤20-char tags, 160-char description hook), offering to call `create_draft_listing` only after explicit confirmation of the exact payload
- **Market intelligence**: `etsy-competitor-research`, `etsy-niche-scanner`, `etsy-product-ideation`
- **SEO & keywords**: `etsy-keyword-research`, `etsy-seasonal-keywords`
- **Pricing & finance** (read-only diagnostics): `etsy-financial-report`, `etsy-pricing-audit`, `etsy-fee-watchdog`
- **Reviews & customers**: `etsy-review-insights`, `etsy-review-responder` (drafts only — no reply-to-review endpoint exists), `etsy-repeat-buyer-radar`
- **Operations**: `etsy-morning-briefing` (pairs well with `/schedule`), `etsy-ship-assistant` (per-order confirmation, never batched — `create_receipt_shipment` emails the buyer), `etsy-sales-forensics`
- **Storefront**: `etsy-storefront-audit`

Known blind spots baked into these skills' honesty about limits: no Etsy analytics/traffic/views/favorites API, no Ads API, no image/file upload tool yet, and no COGS data (profit margin needs the user to supply product costs once). Don't let a skill imply it has data it doesn't.

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

1. ✅ **Multi-account credential store** — `accounts.json` holds `{ default_account, accounts: { <name>: { shop_id, shop_name, access_token, refresh_token } } }`. Every OAuth tool has an optional `account` arg; `list_accounts`/`set_default_account` manage it. Done.
2. ✅ **Per-account OAuth/refresh** — `oauth-setup.js <account-name>` writes into `accounts.json`; `index.ts` keeps one axios client + 401-refresh-interceptor per account (`Map`-based cache in `getOauthClient`). Done.
3. **Fill functional gaps** (not started), priority order: Receipts/Orders (mark shipped, tracking) → listing image/file/video upload (needs multipart, can't use the generic dispatcher) → Shop Return Policies → Payments/Ledger (read-only) → User/UserAddress + private Reviews.
4. **Safeguards** (not started) — server-side `confirm: true` required param on delete/high-risk-update tools (so a missed confirmation errors instead of silently executing), optional `ETSY_DRY_RUN` mode, an append-only `logs/writes.jsonl` audit log of every mutating call, and a shared rate-limit queue since all accounts draw from one app's 5 QPS / 5,000-per-day budget.
5. **Polish** (not started) — proactive token refresh before expiry (not just on 401), a `ping_account` smoke-test tool.

Nothing in this roadmap requires restructuring the existing 47-spec generic dispatcher in `index.ts`.
