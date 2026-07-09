# Etsy MCP Server

A Model Context Protocol (MCP) server that provides integration with the Etsy API v3. This server enables AI assistants to search for products, get shop information, retrieve listing details, and more on Etsy.

## Features

- 🔍 **Search Listings**: Search for active products on Etsy with filters
- 🏪 **Shop Information**: Get detailed shop data and reviews
- 📦 **Listing Details**: Retrieve comprehensive product information with images
- 🔥 **Trending Products**: Discover what's currently popular on Etsy
- ⭐ **Reviews**: Access shop reviews and ratings
- 📊 **Pagination Support**: Handle large result sets efficiently

## Prerequisites

- Node.js 18 or higher
- An Etsy API key (from Etsy Developer Portal)

## Getting an Etsy API Key

1. Go to [Etsy Developers](https://www.etsy.com/developers)
2. Sign in with your Etsy account
3. Create a new app in the [Developer Console](https://www.etsy.com/developers/your-apps)
4. Copy your API Key (also called "Keystring")

**Note**: For read-only operations (searching, viewing public data), you only need an API key. For operations that access private data or modify data (managing your own shop, orders, listings), you also need an OAuth 2.0 access token — see [OAuth Setup](#oauth-setup-shop-management) below. This server currently ships 7 public-data tools (below); OAuth-backed shop-management tools (orders, listing create/edit, inventory) are not yet implemented in `src/index.ts`, but the token needed to add them is already wired up via `oauth-setup.js`.

## Installation

### From npm (when published)

```bash
npm install -g etsy-mcp-server
```

### From Source

```bash
git clone <repository-url>
cd etsy-mcp-server
npm install
npm run build
```

## Configuration

### Claude Desktop Configuration

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "etsy": {
      "command": "npx",
      "args": ["-y", "etsy-mcp-server"],
      "env": {
        "ETSY_API_KEY": "your_etsy_api_key_here"
      }
    }
  }
}
```

Or if installed from source:

```json
{
  "mcpServers": {
    "etsy": {
      "command": "node",
      "args": ["/path/to/etsy-mcp-server/build/index.js"],
      "env": {
        "ETSY_API_KEY": "your_etsy_api_key_here"
      }
    }
  }
}
```

### Environment Variable

Alternatively, you can set the API key as an environment variable:

```bash
export ETSY_API_KEY=your_etsy_api_key_here
```

## OAuth Setup (Shop Management)

Only needed if you want to manage your **own** shop (orders, listings, inventory) instead of just browsing public data.

1. Add your keystring/secret to `etsy-mcp-server/.env`:
   ```
   ETSY_API_KEY=your_keystring
   ETSY_SHARED_SECRET=your_shared_secret
   ```
2. Register this exact callback URL in your Etsy app's **Edit callback URLs** page (it's fixed — you only ever set it once):
   ```
   http://localhost:3945/oauth/redirect
   ```
3. Run the one-time authorization helper:
   ```bash
   npm run oauth
   ```
   This starts a local server on port 3945, prints an authorization link in the console — open it in your browser and approve access. The script captures the authorization code, exchanges it for tokens, and appends `ETSY_ACCESS_TOKEN` / `ETSY_REFRESH_TOKEN` to `.env` automatically.
4. `ETSY_ACCESS_TOKEN` expires after 1 hour; `ETSY_REFRESH_TOKEN` is valid ~90 days and can be used to mint new access tokens without repeating the browser step.

### Connecting an account from a different machine/IP

Etsy can flag logging into multiple different seller accounts from the same IP. If you need to complete the Etsy login/consent step from a different network than the machine running this script, use remote mode instead:

```bash
node oauth-setup.js <account-name> --remote
```

This skips the local `localhost:3945` listener and instead prints the authorize URL — open it on ANY machine/browser, approve access there, and you'll land on a small catcher page (hosted separately, e.g. `https://aamirali.com/etsy-callback.php`) that shows a `<state> <code>` line. Paste that line back into the prompt on the machine running the script to finish the connection. Requires that public URL to also be registered as a Callback URL in the Etsy app (in addition to the localhost one — Etsy apps support multiple registered callback URLs). Override the default public URL with `OAUTH_PUBLIC_REDIRECT_URI=...` if you host the catcher page elsewhere.

For a two-step version of the same flow (e.g. when Claude is driving it across separate chat turns instead of a human sitting at one continuous terminal prompt), split `--remote` into:

```bash
node oauth-setup.js <account-name> --init                       # step 1: prints the authorize URL, saves the pending PKCE verifier
node oauth-setup.js <account-name> --complete="<state> <code>"  # step 2: run once you have the pasted line from the catcher page
```

`--init` saves the verifier to `.oauth-pending/<account-name>.json` (gitignored) so it survives between the two runs; `--complete` reads it, finishes the token exchange, and deletes it on success (left in place on failure so you can retry the paste without re-running `--init`).

Scopes requested by default: `shops_r shops_w listings_r listings_w listings_d transactions_r transactions_w profile_r profile_w`.

## Available Tools

All 7 tools below only need the API key (`x-api-key` header) — none of them touch private data, so OAuth is not required for any of them yet.

| Tool | Etsy endpoint it calls | Use it when you want to... |
|---|---|---|
| `search_listings` | `GET /application/listings/active` | Find public products by keyword, with price/sort filters — e.g. "search handmade leather wallets under $50" |
| `get_listing_details` | `GET /application/listings/{listing_id}` | Pull full detail (images, shop, inventory) for one specific listing you already have the ID for |
| `get_shop_by_name` | `GET /application/shops/{shop_name}` | Look up a shop's public profile (title, currency, listing count) by its shop slug |
| `get_shop_listings` | `GET /application/shops/{shop_id}/listings` | List all active products from one specific shop, once you know its numeric shop ID |
| `search_shops` | `GET /application/shops` | Find shops by name/keyword when you don't already know the shop ID |
| `get_trending_listings` | `GET /application/listings/trending` | Discover currently popular items across all of Etsy (market research, inspiration) |
| `get_shop_reviews` | `GET /application/shops/{shop_id}/reviews` | Read a shop's customer reviews/ratings, optionally filtered by date range |

Typical lookup chain: `search_shops` → get a `shop_id` → `get_shop_listings` / `get_shop_reviews`. Or: `search_listings` → get a `listing_id` → `get_listing_details` for the full picture.

### search_listings

Search for active listings on Etsy.

**Parameters:**
- `keywords` (required): Search terms
- `limit` (optional): Number of results (1-100, default: 25)
- `offset` (optional): Pagination offset (default: 0)
- `min_price` (optional): Minimum price filter
- `max_price` (optional): Maximum price filter
- `sort_on` (optional): Sort by created, price, updated, or score
- `sort_order` (optional): asc, desc, ascending, or descending

**Example:**
```
Search Etsy for handmade leather wallets under $50
```

### get_listing_details

Get detailed information about a specific listing.

**Parameters:**
- `listing_id` (required): Numeric listing ID
- `includes` (optional): Array of additional data (Shop, Images, User, Videos, Inventory)

**Example:**
```
Get details for Etsy listing ID 1234567890
```

### get_shop_by_name

Retrieve information about a shop by its name.

**Parameters:**
- `shop_name` (required): Shop name/slug

**Example:**
```
Get information about the Etsy shop "ArtisanLeatherCo"
```

### get_shop_listings

Get all active listings from a specific shop.

**Parameters:**
- `shop_id` (required): Numeric shop ID
- `limit` (optional): Number of results (1-100, default: 25)
- `offset` (optional): Pagination offset
- `sort_on` (optional): Sort field
- `sort_order` (optional): Sort direction

**Example:**
```
Show me all listings from Etsy shop ID 12345678
```

### search_shops

Search for shops by name.

**Parameters:**
- `shop_name` (required): Shop name to search
- `limit` (optional): Number of results (1-100, default: 25)
- `offset` (optional): Pagination offset

**Example:**
```
Search for Etsy shops with "pottery" in their name
```

### get_trending_listings

Get currently trending listings on Etsy.

**Parameters:**
- `limit` (optional): Number of results (1-100, default: 25)
- `offset` (optional): Pagination offset

**Example:**
```
Show me trending items on Etsy
```

### get_shop_reviews

Get reviews for a specific shop.

**Parameters:**
- `shop_id` (required): Numeric shop ID
- `limit` (optional): Number of results (1-100, default: 25)
- `offset` (optional): Pagination offset
- `min_created` (optional): Unix timestamp for minimum date
- `max_created` (optional): Unix timestamp for maximum date

**Example:**
```
Get recent reviews for Etsy shop ID 12345678
```

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Development Mode

```bash
npm run dev
```

## API Rate Limits

Etsy's API has rate limits (per API key):
- **5 requests per second (QPS)**
- **5,000 requests per day (QPD)**
- Be mindful of pagination when retrieving large datasets — bulk crawling can exhaust the daily quota

## Error Handling

The server includes comprehensive error handling:
- Invalid API keys return authentication errors
- Missing required parameters return validation errors
- Rate limit errors are surfaced to the user
- Network errors are caught and reported

## Limitations

- **Read-only tools**: The 7 registered tools only support read operations (searching, viewing) on public data
- **OAuth token available, not yet wired into tools**: `npm run oauth` produces an `ETSY_ACCESS_TOKEN`/`ETSY_REFRESH_TOKEN` in `.env`, but `src/index.ts` doesn't have shop-management tools (orders, listing create/edit, inventory) built yet — those need to be added as a follow-up and made to send `Authorization: Bearer <ETSY_ACCESS_TOKEN>` alongside the existing `x-api-key` header

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Resources

- [Etsy API Documentation](https://developers.etsy.com/documentation/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

## Troubleshooting

### "ETSY_API_KEY environment variable is required"

Make sure you've set the `ETSY_API_KEY` in your configuration file or environment variables.

### "Authentication failed"

Verify your API key is correct and active in the Etsy Developer Portal.

### "Rate limit exceeded"

Wait a moment before making more requests. Consider implementing delays between requests if making many calls.

### Connection Issues

Ensure you have internet connectivity and that Etsy's API is accessible from your network.
