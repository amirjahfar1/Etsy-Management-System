# Etsy Management System — AI-Powered Etsy Shop Automation for Claude (MCP)

**An open-source Model Context Protocol (MCP) server + agent skill library that lets Claude manage a real Etsy shop end-to-end** — listings, inventory, images, shipping, orders, reviews, pricing, SEO, and finances — through natural conversation. Built for sellers who want an AI assistant that can actually *act* on their Etsy store, not just talk about it.

If you're searching for **"Etsy API MCP server"**, **"Claude Etsy integration"**, **"AI Etsy shop manager"**, **"Etsy listing automation with AI"**, or **"Etsy SEO agent for Claude Code"** — this is that project.

---

## What is this?

This repository turns Claude (via [Claude Code](https://claude.com/claude-code) or any [MCP](https://modelcontextprotocol.io/)-compatible client) into a full Etsy shop operator:

- A **custom-built Node.js/TypeScript MCP server** (`etsy-mcp-server/`) that wraps the entire Etsy Open API v3 — ~90 tools covering listings, variations, images, videos, digital files, shipping, returns, orders, payments, reviews, and shop settings.
- **22 ready-made "agency skills"** (`.claude/skills/`) — repeatable playbooks that turn raw API calls into real seller workflows: SEO audits, competitor research, listing copywriting, pricing checks, fee-anomaly detection, financial reports, review analysis, order fulfillment, and more.
- **Multi-account support** — manage more than one connected Etsy shop from the same install, switching between them by name.
- A hard **safety rule baked into every write path**: nothing is ever created, updated, or deleted on your live shop without first showing you an old → new diff and waiting for explicit confirmation.

Point Claude at your Etsy shop and ask things like *"audit my whole shop"*, *"why did sales drop this month"*, *"write SEO copy for a new listing"*, *"which orders need to ship today"*, or *"optimize this listing to compete with the top sellers in my niche"* — and it does the research, shows you the plan, and (with your go-ahead) executes it live.

---

## Key Features

- 🏪 **Full shop management** — create/update/delete listings, manage variations & inventory, upload images/videos/digital files, configure shipping and return policies, all through conversational requests
- 🔎 **Market intelligence** — competitor research, niche saturation scanning, keyword/tag mining from top-ranked listings, trending-product discovery
- ✍️ **SEO-driven copywriting** — research-first title/tags/description generation that mirrors what's actually ranking, gated behind a mandatory Copy QA checklist (no AI-tell phrasing, no em dashes, no placeholder text)
- 💰 **Financial visibility** — P&L reports, fee-anomaly ("did Etsy overcharge me") detection, pricing audits against live market rates — all from the read-only Payments/Ledger API
- ⭐ **Review intelligence** — theme-mining across all reviews, per-listing complaint clustering, and on-brand reply drafting
- 📦 **Operations** — daily shop briefings, ship-by deadline tracking, tracking submission — one confirmed action at a time
- 🔐 **Multi-account, OAuth-managed** — connect any number of Etsy shops; access tokens auto-refresh; each account can use its own Etsy Developer App credentials or share a default one
- 🛡️ **Confirm-before-write by design** — every mutating call is gated behind an explicit user confirmation showing exactly what will change
- 🧠 **Self-documenting** — when a live API call surfaces an undocumented Etsy requirement or a server bug, the project's own rules require it to be fixed *and* written down, so the same failure never happens twice

---

## Architecture

```
Etsy-Management-System/
├── etsy-mcp-server/           # The MCP server (Node.js / TypeScript)
│   ├── src/index.ts           # ~90 tools across listings, shipping, orders, payments, etc.
│   ├── oauth-setup.js         # Per-account OAuth 2.0 connection helper (local + remote flows)
│   ├── accounts.json          # Multi-account credential store (gitignored)
│   └── data/                  # Tag research DB, saved product templates, listing records (gitignored)
├── .claude/skills/            # 22 agency skills (Claude Code)
├── .agent/skills/             # Same 22 skills, mirrored for Google Antigravity
├── .mcp.json                  # Registers the `etsy` server + Etsy's hosted `etsy-docs` reference server
└── CLAUDE.md                  # The full technical reference: every tool, every field-level gotcha
```

Two MCP servers are wired in:

| Server | What it is |
|---|---|
| `etsy` | This project's own server — every read/write tool against your shop |
| `etsy-docs` | Etsy's official hosted, read-only API documentation server — used to look up exact field requirements straight from the live spec instead of guesswork |

---

## Tool Catalog

The `etsy` MCP server exposes tools across every major Etsy Open API v3 resource:

| Category | Tools | Examples |
|---|---|---|
| **Public / market research** (no OAuth) | 7 | `search_listings`, `get_shop_by_name`, `get_trending_listings`, `get_shop_reviews` |
| **Listings** (your shop) | 10 | `create_draft_listing`, `update_listing`, `delete_listing`, `get_listings_by_shop` |
| **Variations & inventory** | 4 | `update_listing_inventory`, `get_listing_inventory`, `update_variation_images` |
| **Images & video** | 6 | `upload_listing_image`, `upload_listing_video`, `delete_listing_image` |
| **Digital download files** | 4 | `upload_listing_file`, `get_all_listing_files`, `delete_listing_file` |
| **Return policies** | 5 | `create_shop_return_policy`, `update_shop_return_policy`, `consolidate_shop_return_policies` |
| **Shop settings** | 8 | `update_shop`, `create_shop_section`, `get_shop_production_partners` |
| **Shipping** | 13 | `create_shop_shipping_profile`, `create_shipping_profile_destination`, `create_processing_profile` |
| **Orders / receipts** | 8 | `get_shop_receipts`, `update_shop_receipt`, `create_receipt_shipment` (emails the buyer tracking) |
| **Payments (read-only)** | 5 | `get_payment_ledger_entries`, `get_payments`, `get_payment_by_receipt` |
| **Reviews** | 1 | `get_reviews_by_listing` |
| **User / account** | 4 | `get_me`, `list_accounts`, `set_default_account` |

**Every array-typed field is auto-coerced** (a permanent server-side fix for a real bug where JSON arrays arriving as strings caused opaque 400s), and every write tool goes through a generic dispatcher that already supports every field Etsy's API accepts — no code changes needed to pass new parameters.

For the exact parameter list, field-level requirements, and every live-API gotcha discovered so far (readiness states, custom-property naming, offering readiness requirements, etc.), see [CLAUDE.md](CLAUDE.md#which-tool-to-call--quick-map) and [etsy-mcp-server/README.md](etsy-mcp-server/README.md).

---

## Agent Skills

22 trigger-driven playbooks turn the raw tool catalog into real seller workflows. Each one auto-invokes on natural language — you don't need to remember exact names.

| Skill | What it does |
|---|---|
| `etsy-audit-account` | Whole-shop health scorecard — branding, catalog, shipping, reviews, finances |
| `etsy-audit-listing` | Deep-dive audit of one listing against SEO/conversion best practices |
| `etsy-audit-listings` | Bulk audit of every active listing, severity-sorted |
| `etsy-listing-qa-check` | Mechanical rules-compliance check against the shop's own field standards |
| `etsy-optimize-listing` | Rewrites a listing to compete with top sellers — full OLD→NEW diff |
| `etsy-new-listing-copywriter` | Research-backed title/tags/description for a brand-new product |
| `etsy-create-listing` | Full guided listing creation — variants, images, digital files, the works |
| `etsy-competitor-research` | Structured competitive dossier on rival shops |
| `etsy-niche-scanner` | Market saturation / go-no-go read before entering a new niche |
| `etsy-product-ideation` | New product concepts crossing trends, competitors, and your own bestsellers |
| `etsy-keyword-research` | Mines what's actually ranking, diffs against your tags, proposes swaps |
| `etsy-seasonal-keywords` | Rotates holiday keywords in — and back out — on a schedule |
| `etsy-financial-report` | Period P&L from the payment ledger |
| `etsy-pricing-audit` | Flags under/overpriced listings against live market rates |
| `etsy-fee-watchdog` | Scans the ledger for anomalous or duplicate fees |
| `etsy-review-insights` | Mines recurring complaint/praise themes across all reviews |
| `etsy-review-responder` | Drafts on-brand replies, prioritizing low-star reviews |
| `etsy-repeat-buyer-radar` | Finds repeat customers and cross-sell/bundle opportunities |
| `etsy-morning-briefing` | Daily digest — new orders, ship-by deadlines, new reviews, money movement |
| `etsy-ship-assistant` | Finds orders needing shipment, submits tracking, one confirmed order at a time |
| `etsy-sales-forensics` | Diagnoses *why* sales dropped, with concrete evidence |
| `etsy-storefront-audit` | Storefront presentation & branding review |

Full trigger phrasing and workflow detail for each lives in `.claude/skills/<name>/SKILL.md`.

---

## Safety Model

This is not a "read-only demo" — it's wired to write to a live, real Etsy shop. So it ships with a hard rule:

> **Any tool call that creates, updates, or deletes data on Etsy must be confirmed by the user before it executes.** The agent shows exactly what will change — which item, which fields, old value → new value — and waits for an explicit yes before calling the tool.

Read-only tools (`get_*`, `find_*`, `search_*`, `list_*`) run freely. Everything else stops for you first.

---

## Getting Started

1. **Get an Etsy Developer App** at [etsy.com/developers/register](https://www.etsy.com/developers/register) for your own API key/secret.
2. **Build the server:**
   ```bash
   cd etsy-mcp-server
   npm install
   npm run build
   ```
3. **Set credentials** — copy `.env.example` → `.env`, fill in `ETSY_API_KEY` / `ETSY_SHARED_SECRET`.
4. **Connect your shop:**
   ```bash
   node oauth-setup.js <your-shop-name>
   ```
5. **Wire it into your AI tool** — copy `.mcp.json.example` → `.mcp.json` for Claude Code, or see [CLAUDE.md](CLAUDE.md#deploying-to-google-antigravity) for Google Antigravity setup.

Full setup, multi-account instructions, and every tool's exact parameters are documented in [CLAUDE.md](CLAUDE.md) and [etsy-mcp-server/README.md](etsy-mcp-server/README.md).

---

## Rate Limits

Etsy enforces **5 requests/second and 5,000 requests/day per API key**. Tools that support batch lookups (`get_listings_by_ids`, etc.) are used in favor of per-item loops wherever a skill iterates over many listings or orders.

---

## Tech Stack

- **Node.js / TypeScript** MCP server (`@modelcontextprotocol/sdk`)
- **Etsy Open API v3** (OAuth 2.0 + PKCE)
- **Claude Code** agent skills (Markdown-based, trigger-phrase driven)
- Also deployable to **Google Antigravity** — see [CLAUDE.md](CLAUDE.md#deploying-to-google-antigravity)

---

## License

MIT — see [etsy-mcp-server/README.md](etsy-mcp-server/README.md) for server-specific details.

## Contributing

Issues and pull requests welcome. See [etsy-mcp-server/CONTRIBUTING.md](etsy-mcp-server/CONTRIBUTING.md).
