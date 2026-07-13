#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, "..", ".env");

// Load etsy-mcp-server/.env for values not already set by the MCP host
// (the host's .mcp.json only wires up ETSY_API_KEY/ETSY_SHARED_SECRET).
function loadDotEnvIfPresent() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnvIfPresent();

// Etsy API configuration
const ETSY_API_BASE = "https://openapi.etsy.com/v3";
const API_KEY = process.env.ETSY_API_KEY;
const SHARED_SECRET = process.env.ETSY_SHARED_SECRET;

if (!API_KEY) {
  console.error("Error: ETSY_API_KEY environment variable is required");
  process.exit(1);
}

// Default axios instance for public, read-only endpoints (no account specified).
// Falls back to this when the caller doesn't pass an `account` — see
// getPublicClient below, defined after the account store, for the
// per-account-key-aware version used by the actual tool handlers.
const etsyClient: AxiosInstance = axios.create({
  baseURL: ETSY_API_BASE,
  headers: {
    "x-api-key": SHARED_SECRET ? `${API_KEY}:${SHARED_SECRET}` : API_KEY,
  },
});

// --- Multi-account store (accounts.json) ---
// ETSY_API_KEY/ETSY_SHARED_SECRET (above) are the default app credentials,
// used by any account that doesn't carry its own api_key/shared_secret.
// An account connected through a *different* Etsy Developer App (its own
// keystring/shared secret) stores those on the account record instead —
// see the Account interface below. Each account's shop_id + OAuth tokens
// live here too, so connecting another Etsy account never requires
// touching the generic dispatcher below — just add an entry and
// (optionally) call set_default_account.
const ACCOUNTS_PATH = path.join(__dirname, "..", "accounts.json");

interface Account {
  shop_id: string;
  shop_name?: string;
  access_token: string;
  refresh_token: string;
  // Present only when this account was connected through its own Etsy
  // Developer App (a different app than the default .env credentials).
  // Falls back to the global API_KEY/SHARED_SECRET when absent.
  api_key?: string;
  shared_secret?: string;
}

interface AccountsFile {
  default_account: string;
  accounts: Record<string, Account>;
}

function loadAccounts(): AccountsFile {
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    return { default_account: "", accounts: {} };
  }
  return JSON.parse(fs.readFileSync(ACCOUNTS_PATH, "utf8"));
}

function saveAccounts(data: AccountsFile) {
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(data, null, 2) + "\n");
}

// `accountsData` is kept fresh by reloading from disk (reloadAccounts) at
// the start of every read/write path below, rather than trusting the
// in-memory snapshot from server startup. Without this, a long-running
// server that started before another process (e.g. `node oauth-setup.js`
// connecting a new account) wrote to accounts.json would (a) not see that
// new account at all, and worse (b) silently WIPE it the next time this
// server did any write of its own (e.g. a token refresh), since a write
// here means "serialize the in-memory accountsData object back to disk" —
// and a stale in-memory object omits whatever another process just added.
let accountsData: AccountsFile = loadAccounts();

function reloadAccounts() {
  accountsData = loadAccounts();
}

function resolveAccountName(explicit?: string): string {
  reloadAccounts();
  const name = explicit || accountsData.default_account;
  if (!name) {
    throw new Error(
      "No account specified and no default_account is set. Run `node oauth-setup.js <account-name>` to connect one, or pass an `account` argument."
    );
  }
  return name;
}

function getAccount(name: string): Account {
  reloadAccounts();
  const account = accountsData.accounts[name];
  if (!account) {
    const known = Object.keys(accountsData.accounts).join(", ") || "(none connected yet)";
    throw new Error(`Unknown account "${name}". Known accounts: ${known}`);
  }
  return account;
}

// Public (no-OAuth) endpoints still need a valid x-api-key header, which is
// just the app keystring — no access token involved. If the default .env
// app key is dead/inactive, callers can pass `account` on any public tool
// to route through that connected account's own api_key/shared_secret
// instead (falls back to .env when the account doesn't carry its own).
const publicClients = new Map<string, AxiosInstance>();

function getPublicClient(accountName?: string): AxiosInstance {
  // No explicit account: prefer the default connected account's own key
  // (falls back to raw etsyClient only when no account is connected at all).
  if (!accountName) {
    reloadAccounts();
    accountName = accountsData.default_account || undefined;
    if (!accountName) return etsyClient;
  }

  const cached = publicClients.get(accountName);
  if (cached) return cached;

  const account = getAccount(accountName);
  const apiKey = account.api_key || API_KEY;
  const sharedSecret = account.shared_secret || SHARED_SECRET;

  const client = axios.create({
    baseURL: ETSY_API_BASE,
    headers: {
      "x-api-key": sharedSecret ? `${apiKey}:${sharedSecret}` : apiKey,
    },
  });
  publicClients.set(accountName, client);
  return client;
}

async function refreshAccessToken(accountName: string) {
  const account = getAccount(accountName);
  const res = await axios.post(
    "https://api.etsy.com/v3/public/oauth/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: account.api_key || API_KEY!,
      refresh_token: account.refresh_token,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  // Reload immediately before writing so this refresh can never clobber an
  // account another process added to accounts.json since this server started.
  reloadAccounts();
  const fresh = accountsData.accounts[accountName];
  if (fresh) {
    fresh.access_token = res.data.access_token;
    fresh.refresh_token = res.data.refresh_token;
  }
  saveAccounts(accountsData);
}

// One axios instance per connected account, each with its own 401 -> refresh -> retry.
const oauthClients = new Map<string, AxiosInstance>();

function getOauthClient(accountName: string): AxiosInstance {
  const cached = oauthClients.get(accountName);
  if (cached) return cached;

  const account = getAccount(accountName);
  const apiKey = account.api_key || API_KEY;
  const sharedSecret = account.shared_secret || SHARED_SECRET;

  const client: AxiosInstance = axios.create({
    baseURL: ETSY_API_BASE,
    headers: {
      "x-api-key": sharedSecret ? `${apiKey}:${sharedSecret}` : apiKey,
    },
  });

  client.interceptors.request.use((config) => {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${getAccount(accountName).access_token}`;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      if (error.response?.status === 401 && original && !original._retried) {
        original._retried = true;
        await refreshAccessToken(accountName);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${getAccount(accountName).access_token}`;
        return client.request(original);
      }
      return Promise.reject(error);
    }
  );

  oauthClients.set(accountName, client);
  return client;
}

// Define available tools
const TOOLS: Tool[] = [
  {
    name: "search_listings",
    description:
      "Search for active listings on Etsy. Returns product listings matching the search criteria.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Which connected Etsy account's API key to use for this public call (see list_accounts). Defaults to the default account's key, or the app's own .env key if that account has none.",
        },
        keywords: {
          type: "string",
          description: "Search keywords to find listings",
        },
        limit: {
          type: "number",
          description: "Number of results to return (1-100, default: 25)",
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0)",
          minimum: 0,
        },
        min_price: {
          type: "number",
          description: "Minimum price in USD",
        },
        max_price: {
          type: "number",
          description: "Maximum price in USD",
        },
        sort_on: {
          type: "string",
          description: "Sort results by",
          enum: ["created", "price", "updated", "score"],
        },
        sort_order: {
          type: "string",
          description: "Sort order",
          enum: ["asc", "desc", "ascending", "descending"],
        },
      },
      required: ["keywords"],
    },
  },
  {
    name: "get_listing_details",
    description:
      "Get detailed information about a specific Etsy listing by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Which connected Etsy account's API key to use for this public call (see list_accounts). Defaults to the default account's key.",
        },
        listing_id: {
          type: "number",
          description: "The numeric ID of the listing",
        },
        includes: {
          type: "array",
          items: {
            type: "string",
            enum: ["Shop", "Images", "User", "Videos", "Inventory"],
          },
          description:
            "Additional data to include (Shop, Images, User, Videos, Inventory)",
        },
      },
      required: ["listing_id"],
    },
  },
  {
    name: "get_shop_by_name",
    description: "Get information about an Etsy shop by its shop name.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Which connected Etsy account's API key to use for this public call (see list_accounts). Defaults to the default account's key.",
        },
        shop_name: {
          type: "string",
          description: "The name/slug of the shop",
        },
      },
      required: ["shop_name"],
    },
  },
  {
    name: "get_shop_listings",
    description: "Get all active listings from a specific Etsy shop.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Which connected Etsy account's API key to use for this public call (see list_accounts). Defaults to the default account's key.",
        },
        shop_id: {
          type: "number",
          description: "The numeric ID of the shop",
        },
        limit: {
          type: "number",
          description: "Number of results to return (1-100, default: 25)",
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0)",
          minimum: 0,
        },
        sort_on: {
          type: "string",
          description: "Sort results by",
          enum: ["created", "price", "updated", "score"],
        },
        sort_order: {
          type: "string",
          description: "Sort order",
          enum: ["asc", "desc", "ascending", "descending"],
        },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "search_shops",
    description: "Search for Etsy shops by name or keywords.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Which connected Etsy account's API key to use for this public call (see list_accounts). Defaults to the default account's key.",
        },
        shop_name: {
          type: "string",
          description: "Shop name to search for",
        },
        limit: {
          type: "number",
          description: "Number of results to return (1-100, default: 25)",
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0)",
          minimum: 0,
        },
      },
      required: ["shop_name"],
    },
  },
  {
    name: "get_trending_listings",
    description:
      "Get trending listings on Etsy. Returns currently popular items.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Which connected Etsy account's API key to use for this public call (see list_accounts). Defaults to the default account's key.",
        },
        limit: {
          type: "number",
          description: "Number of results to return (1-100, default: 25)",
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0)",
          minimum: 0,
        },
      },
    },
  },
  {
    name: "get_shop_reviews",
    description: "Get reviews for a specific Etsy shop.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Which connected Etsy account's API key to use for this public call (see list_accounts). Defaults to the default account's key.",
        },
        shop_id: {
          type: "number",
          description: "The numeric ID of the shop",
        },
        limit: {
          type: "number",
          description: "Number of results to return (1-100, default: 25)",
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0)",
          minimum: 0,
        },
        min_created: {
          type: "number",
          description: "Unix timestamp for minimum review creation date",
        },
        max_created: {
          type: "number",
          description: "Unix timestamp for maximum review creation date",
        },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "list_accounts",
    description:
      "List all connected Etsy accounts (name, shop_id, shop_name) and which one is currently the default for tools that don't specify an `account`.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_default_account",
    description:
      "Change which connected account is used by default when a tool call omits `account`.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account name to make default (see list_accounts).",
        },
      },
      required: ["account"],
    },
  },
];

// --- Shop-management endpoints (OAuth-authenticated) ---
// Defined as data instead of one function per endpoint: each spec maps
// directly to one Etsy operationId. Path params (":name") are required
// (except shop_id, which falls back to ETSY_SHOP_ID). Any other argument
// becomes a query param (GET/DELETE) or JSON body field (POST/PUT/PATCH).
interface EndpointSpec {
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
}

const WRITE_ENDPOINTS: EndpointSpec[] = [
  // ShopListing (16) — operationIds: getListingsByShop, createDraftListing, getListing,
  // deleteListing, findAllListingsActive, findAllActiveListingsByShop, getListingsByListingIds,
  // getFeaturedListingsByShop, updateListingProperty, deleteListingProperty, getListingProperty,
  // getListingProperties, updateListing, getListingsByShopReceipt, getListingsByShopReturnPolicy,
  // getListingsByShopSectionId
  { name: "get_listings_by_shop", method: "GET", path: "/application/shops/:shop_id/listings", description: "List a shop's listings, including non-active states (draft/inactive/expired) when authenticated as the owner." },
  { name: "create_draft_listing", method: "POST", path: "/application/shops/:shop_id/listings", description: "Create a new draft listing. Body needs fields like title, description, price, quantity, who_made, when_made, taxonomy_id." },
  { name: "get_listing", method: "GET", path: "/application/listings/:listing_id", description: "Retrieve a single listing by ID." },
  { name: "delete_listing", method: "DELETE", path: "/application/listings/:listing_id", description: "Delete a listing (only allowed for draft/expired/inactive listings you own)." },
  { name: "find_all_listings_active", method: "GET", path: "/application/listings/active", description: "Browse all active listings on Etsy, paginated by creation date." },
  { name: "find_all_active_listings_by_shop", method: "GET", path: "/application/shops/:shop_id/listings/active", description: "Browse active listings for one shop." },
  { name: "get_listings_by_ids", method: "GET", path: "/application/listings/batch", description: "Fetch up to 100 listings at once by listing_ids (comma-separated)." },
  { name: "get_featured_listings_by_shop", method: "GET", path: "/application/shops/:shop_id/listings/featured", description: "Get a shop's featured listings." },
  { name: "update_listing_property", method: "PUT", path: "/application/shops/:shop_id/listings/:listing_id/properties/:property_id", description: "Set a product property (e.g. color, material) on a listing." },
  { name: "delete_listing_property", method: "DELETE", path: "/application/shops/:shop_id/listings/:listing_id/properties/:property_id", description: "Remove a product property from a listing." },
  { name: "get_listing_property", method: "GET", path: "/application/listings/:listing_id/properties/:property_id", description: "Read a single listing property." },
  { name: "get_listing_properties", method: "GET", path: "/application/shops/:shop_id/listings/:listing_id/properties", description: "List all properties set on a listing." },
  { name: "update_listing", method: "PATCH", path: "/application/shops/:shop_id/listings/:listing_id", description: "Edit an existing listing's fields (title, description, price, state, etc.)." },
  { name: "get_listings_by_receipt", method: "GET", path: "/application/shops/:shop_id/receipts/:receipt_id/listings", description: "Get the listings that were part of a specific order (receipt)." },
  { name: "get_listings_by_return_policy", method: "GET", path: "/application/shops/:shop_id/policies/return/:return_policy_id/listings", description: "Get all listings using a given return policy." },
  { name: "get_listings_by_section", method: "GET", path: "/application/shops/:shop_id/shop-sections/listings", description: "Get listings in a shop section. Pass shop_section_id as an extra argument." },

  // ShopListing Inventory (4) — variations, SKU, per-variation price/quantity/processing profile.
  // operationIds: getListingInventory, updateListingInventory, getListingsInventoryByListingIds, getListingProduct
  { name: "get_listing_inventory", method: "GET", path: "/application/listings/:listing_id/inventory", description: "Get a listing's inventory record: products, variation offerings, per-variation price/quantity/SKU. Listings never edited with Etsy's inventory tools have no inventory record." },
  { name: "update_listing_inventory", method: "PUT", path: "/application/listings/:listing_id/inventory", description: "Set a listing's variations/SKU/price/quantity. Body needs `products` (array of {sku, offerings: [{quantity, is_enabled, price}], property_values: [{property_id, value_ids, values}]}), plus optional price_on_property/quantity_on_property/sku_on_property (arrays of property IDs)." },
  { name: "get_listings_inventory_by_ids", method: "GET", path: "/application/listings/batch/inventory", description: "Get inventory records for up to 100 listings at once. Pass listing_ids (comma-separated) as an extra argument." },
  { name: "get_listing_product", method: "GET", path: "/application/listings/:listing_id/inventory/products/:product_id", description: "Get a single product (one variation combination) from a listing's inventory." },
  { name: "get_listing_variation_images", method: "GET", path: "/application/shops/:shop_id/listings/:listing_id/variation-images", description: "Get which images are assigned to which variation values on a listing." },
  { name: "update_variation_images", method: "POST", path: "/application/shops/:shop_id/listings/:listing_id/variation-images", description: "Assign images to variation values. Body needs variation_images: array of {property_id, value_id, image_id}. Overwrites all existing variation images on the listing." },

  // ShopListing Image/Video — read & delete only here (JSON/no-body); uploads need multipart,
  // see the dedicated upload_listing_image / upload_listing_video tools below.
  { name: "get_listing_images", method: "GET", path: "/application/listings/:listing_id/images", description: "List all images on a listing." },
  { name: "delete_listing_image", method: "DELETE", path: "/application/shops/:shop_id/listings/:listing_id/images/:listing_image_id", description: "Delete an image from a listing (a copy stays on Etsy's servers and can be re-assigned by listing_image_id)." },
  { name: "get_listing_videos", method: "GET", path: "/application/listings/:listing_id/videos", description: "List all videos on a listing." },
  { name: "delete_listing_video", method: "DELETE", path: "/application/shops/:shop_id/listings/:listing_id/videos/:video_id", description: "Delete a video from a listing (a copy stays on Etsy's servers and can be re-assigned by video_id)." },

  // ShopListing File — the actual digital deliverable buyers download. Read/delete only here
  // (JSON/no-body); upload needs multipart, see the dedicated upload_listing_file tool below.
  // Only returns/affects data on listings with listing_type "download"/"both" — physical listings
  // have no files.
  { name: "get_all_listing_files", method: "GET", path: "/application/shops/:shop_id/listings/:listing_id/files", description: "List all digital files attached to a listing. Empty result for physical listings." },
  { name: "get_listing_file", method: "GET", path: "/application/shops/:shop_id/listings/:listing_id/files/:listing_file_id", description: "Get metadata for one digital file attached to a listing." },
  { name: "delete_listing_file", method: "DELETE", path: "/application/shops/:shop_id/listings/:listing_id/files/:listing_file_id", description: "Delete a file from a listing. WARNING: deleting a digital listing's LAST remaining file converts it back into a physical listing — confirm this is intended, and don't delete the only file on a listing you mean to keep digital." },

  // Shop Return Policies (6) — operationIds: getShopReturnPolicies, getShopReturnPolicy,
  // createShopReturnPolicy, updateShopReturnPolicy, deleteShopReturnPolicy, consolidateShopReturnPolicies.
  // create_draft_listing's optional return_policy_id references these.
  { name: "get_shop_return_policies", method: "GET", path: "/application/shops/:shop_id/policies/return", description: "List a shop's return policies." },
  { name: "get_shop_return_policy", method: "GET", path: "/application/shops/:shop_id/policies/return/:return_policy_id", description: "Get one return policy." },
  { name: "create_shop_return_policy", method: "POST", path: "/application/shops/:shop_id/policies/return", description: "Create a return policy. Body needs accepts_returns, accepts_exchanges (both required booleans), and return_deadline (required if either is true — one of 7/14/21/30/45/60/90 days)." },
  { name: "update_shop_return_policy", method: "PUT", path: "/application/shops/:shop_id/policies/return/:return_policy_id", description: "Update a return policy's accepts_returns/accepts_exchanges/return_deadline." },
  { name: "delete_shop_return_policy", method: "DELETE", path: "/application/shops/:shop_id/policies/return/:return_policy_id", description: "Delete a return policy (only allowed if no listings use it — move them to another policy first)." },
  { name: "consolidate_shop_return_policies", method: "POST", path: "/application/shops/:shop_id/policies/return/consolidate", description: "Move all listings from one return policy to another and delete the source policy. Body needs source_return_policy_id, destination_return_policy_id." },

  // Shop Management (10) — operationIds: getShop, updateShop, getShopByOwnerUserId, findShops,
  // getShopProductionPartners, getShopSections, createShopSection, getShopSection,
  // updateShopSection, deleteShopSection
  { name: "get_shop", method: "GET", path: "/application/shops/:shop_id", description: "Retrieve a shop by its numeric shop ID." },
  { name: "update_shop", method: "PUT", path: "/application/shops/:shop_id", description: "Update shop settings (title, announcement, sale_message, policies, etc.)." },
  { name: "get_shop_by_owner_user_id", method: "GET", path: "/application/users/:user_id/shops", description: "Look up the shop owned by a given user ID." },
  { name: "find_shops", method: "GET", path: "/application/shops", description: "Search shops by name. Pass shop_name as an extra argument." },
  { name: "get_shop_production_partners", method: "GET", path: "/application/shops/:shop_id/production-partners", description: "List a shop's production partners." },
  { name: "get_shop_sections", method: "GET", path: "/application/shops/:shop_id/sections", description: "List a shop's sections (categories)." },
  { name: "create_shop_section", method: "POST", path: "/application/shops/:shop_id/sections", description: "Create a new shop section. Body needs title." },
  { name: "get_shop_section", method: "GET", path: "/application/shops/:shop_id/sections/:shop_section_id", description: "Get one shop section." },
  { name: "update_shop_section", method: "PUT", path: "/application/shops/:shop_id/sections/:shop_section_id", description: "Rename/update a shop section. Body needs title." },
  { name: "delete_shop_section", method: "DELETE", path: "/application/shops/:shop_id/sections/:shop_section_id", description: "Delete a shop section." },

  // Shipping Management (21) — Shop ShippingProfile (14), Shop HolidayPreferences (2),
  // Shop ProcessingProfiles (5)
  { name: "get_shipping_carriers", method: "GET", path: "/application/shipping-carriers", description: "List available shipping carriers and mail classes. Optional origin_country_iso filter." },
  { name: "get_shop_shipping_profiles", method: "GET", path: "/application/shops/:shop_id/shipping-profiles", description: "List a shop's shipping profiles." },
  { name: "create_shop_shipping_profile", method: "POST", path: "/application/shops/:shop_id/shipping-profiles", description: "Create a shipping profile. Body needs title, origin_country_iso, primary_cost, secondary_cost, min/max processing days." },
  { name: "get_shop_shipping_profile", method: "GET", path: "/application/shops/:shop_id/shipping-profiles/:shipping_profile_id", description: "Get one shipping profile." },
  { name: "update_shop_shipping_profile", method: "PUT", path: "/application/shops/:shop_id/shipping-profiles/:shipping_profile_id", description: "Update a shipping profile's settings." },
  { name: "delete_shop_shipping_profile", method: "DELETE", path: "/application/shops/:shop_id/shipping-profiles/:shipping_profile_id", description: "Delete a shipping profile." },
  { name: "get_shipping_profile_destinations", method: "GET", path: "/application/shops/:shop_id/shipping-profiles/:shipping_profile_id/destinations", description: "List shipping destinations/costs for a profile." },
  { name: "create_shipping_profile_destination", method: "POST", path: "/application/shops/:shop_id/shipping-profiles/:shipping_profile_id/destinations", description: "Add a shipping destination (country/region, cost, carrier) to a profile." },
  { name: "update_shipping_profile_destination", method: "PUT", path: "/application/shops/:shop_id/shipping-profiles/:shipping_profile_id/destinations/:shipping_profile_destination_id", description: "Update a shipping destination's cost/carrier." },
  { name: "delete_shipping_profile_destination", method: "DELETE", path: "/application/shops/:shop_id/shipping-profiles/:shipping_profile_id/destinations/:shipping_profile_destination_id", description: "Remove a shipping destination from a profile." },
  { name: "get_shipping_profile_upgrades", method: "GET", path: "/application/shops/:shop_id/shipping-profiles/:shipping_profile_id/upgrades", description: "List shipping upgrades (e.g. express) on a profile." },
  { name: "create_shipping_profile_upgrade", method: "POST", path: "/application/shops/:shop_id/shipping-profiles/:shipping_profile_id/upgrades", description: "Add a paid shipping upgrade option to a profile." },
  { name: "update_shipping_profile_upgrade", method: "PUT", path: "/application/shops/:shop_id/shipping-profiles/:shipping_profile_id/upgrades/:upgrade_id", description: "Update a shipping upgrade's price/settings." },
  { name: "delete_shipping_profile_upgrade", method: "DELETE", path: "/application/shops/:shop_id/shipping-profiles/:shipping_profile_id/upgrades/:upgrade_id", description: "Remove a shipping upgrade option." },
  { name: "get_holiday_preferences", method: "GET", path: "/application/shops/:shop_id/holiday-preferences", description: "List holidays and whether the shop processes orders on each." },
  { name: "update_holiday_preferences", method: "PUT", path: "/application/shops/:shop_id/holiday-preferences/:holiday_id", description: "Set whether the shop processes orders on a specific holiday. Body needs is_working." },
  { name: "get_processing_profiles", method: "GET", path: "/application/shops/:shop_id/readiness-state-definitions", description: "List a shop's order processing/readiness profiles." },
  { name: "create_processing_profile", method: "POST", path: "/application/shops/:shop_id/readiness-state-definitions", description: "Create a processing profile (min/max processing days)." },
  { name: "get_processing_profile", method: "GET", path: "/application/shops/:shop_id/readiness-state-definitions/:readiness_state_definition_id", description: "Get one processing profile." },
  { name: "update_processing_profile", method: "PUT", path: "/application/shops/:shop_id/readiness-state-definitions/:readiness_state_definition_id", description: "Update a processing profile's min/max processing days." },
  { name: "delete_processing_profile", method: "DELETE", path: "/application/shops/:shop_id/readiness-state-definitions/:readiness_state_definition_id", description: "Delete a processing profile." },

  // Receipt Management (8) — Orders. operationIds: getShopReceipts, getShopReceipt, updateShopReceipt,
  // createReceiptShipment, getShopReceiptTransactionsByListing, getShopReceiptTransactionsByReceipt,
  // getShopReceiptTransaction, getShopReceiptTransactionsByShop. Scope: transactions_r/transactions_w (already granted).
  { name: "get_shop_receipts", method: "GET", path: "/application/shops/:shop_id/receipts", description: "List a shop's orders (receipts), optionally filtered by paid/shipped/delivered/canceled status or date range." },
  { name: "get_shop_receipt", method: "GET", path: "/application/shops/:shop_id/receipts/:receipt_id", description: "Get one order (receipt) by ID." },
  { name: "update_shop_receipt", method: "PUT", path: "/application/shops/:shop_id/receipts/:receipt_id", description: "Mark an order as shipped/paid. Body fields: was_shipped, was_paid." },
  { name: "create_receipt_shipment", method: "POST", path: "/application/shops/:shop_id/receipts/:receipt_id/tracking", description: "Submit tracking info for an order, which also marks it shipped and emails the buyer. Body fields: tracking_code, carrier_name, note_to_buyer." },
  { name: "get_receipt_transactions_by_listing", method: "GET", path: "/application/shops/:shop_id/listings/:listing_id/transactions", description: "List order transactions (line items) for one listing." },
  { name: "get_receipt_transactions_by_receipt", method: "GET", path: "/application/shops/:shop_id/receipts/:receipt_id/transactions", description: "List line-item transactions within one order." },
  { name: "get_receipt_transaction", method: "GET", path: "/application/shops/:shop_id/transactions/:transaction_id", description: "Get a single order transaction (line item) by ID." },
  { name: "get_receipt_transactions_by_shop", method: "GET", path: "/application/shops/:shop_id/transactions", description: "List all order transactions (line items) across the shop." },

  // Payment Management (5) — operationIds: getShopPaymentAccountLedgerEntry, getShopPaymentAccountLedgerEntries,
  // getPaymentAccountLedgerEntryPayments, getShopPaymentByReceiptId, getPayments. Scope: transactions_r (already granted).
  { name: "get_payment_ledger_entry", method: "GET", path: "/application/shops/:shop_id/payment-account/ledger-entries/:ledger_entry_id", description: "Get a single payment-account ledger entry (a credit/debit line in the shop's Etsy Payments account)." },
  { name: "get_payment_ledger_entries", method: "GET", path: "/application/shops/:shop_id/payment-account/ledger-entries", description: "List payment-account ledger entries for reconciliation." },
  { name: "get_payment_ledger_entry_payments", method: "GET", path: "/application/shops/:shop_id/payment-account/ledger-entries/payments", description: "Get the payment tied to a ledger entry." },
  { name: "get_payment_by_receipt", method: "GET", path: "/application/shops/:shop_id/receipts/:receipt_id/payments", description: "Get the payment record for a specific order (receipt)." },
  { name: "get_payments", method: "GET", path: "/application/shops/:shop_id/payments", description: "List payments for the shop. Pass payment_ids (comma-separated) to filter to specific ones — required by Etsy." },

  // Review Management — operationId getReviewsByListing (getReviewsByShop is already covered
  // by the public get_shop_reviews tool — same endpoint, no OAuth needed for either).
  { name: "get_reviews_by_listing", method: "GET", path: "/application/listings/:listing_id/reviews", description: "Get reviews left for one specific listing. No OAuth scope required (public), routed through the authenticated client for convenience." },

  // User Management (5) — operationIds: getMe, getUser, getUserAddress, getUserAddresses, deleteUserAddress.
  // getMe needs shops_r (already granted). getUser needs email_r; the UserAddress endpoints need
  // address_r/address_w — NONE of these three scopes are granted yet. Re-run oauth-setup.js for
  // the account to add them (see updated SCOPES list there) before calling those three tools.
  { name: "get_me", method: "GET", path: "/application/users/me", description: "Get the numeric user_id/shop_id of the account behind the current token." },
  { name: "get_user", method: "GET", path: "/application/users/:user_id", description: "Get a user's basic profile (name, avatar). Requires email_r scope — not yet granted; re-authorize to enable." },
  { name: "get_user_address", method: "GET", path: "/application/user/addresses/:user_address_id", description: "Get one of your saved addresses. Requires address_r scope — not yet granted; re-authorize to enable." },
  { name: "get_user_addresses", method: "GET", path: "/application/user/addresses", description: "List your saved addresses. Requires address_r scope — not yet granted; re-authorize to enable." },
  { name: "delete_user_address", method: "DELETE", path: "/application/user/addresses/:user_address_id", description: "Delete one of your saved addresses. Requires address_w scope — not yet granted; re-authorize to enable." },
];

function pathParamNames(template: string): string[] {
  return Array.from(template.matchAll(/:([a-zA-Z_]+)/g)).map((m) => m[1]);
}

function buildToolFromSpec(spec: EndpointSpec): Tool {
  const params = pathParamNames(spec.path);
  const properties: Record<string, any> = {
    account: {
      type: "string",
      description:
        "Which connected Etsy account to act on (see list_accounts). Defaults to the default account if omitted.",
    },
  };
  for (const p of params) {
    properties[p] = {
      type: "number",
      description:
        p === "shop_id"
          ? "Shop ID (defaults to the selected account's own shop if omitted)"
          : `Path parameter: ${p}`,
    };
  }
  return {
    name: spec.name,
    description: `${spec.description} Requires OAuth (this endpoint accesses/modifies private shop data). Extra arguments become ${
      spec.method === "GET" || spec.method === "DELETE" ? "query params" : "JSON body fields"
    } — use the etsy-docs MCP's get_endpoint tool (operationId) for exact field names.`,
    inputSchema: {
      type: "object",
      properties,
      required: params.filter((p) => p !== "shop_id"),
      additionalProperties: true,
    },
  };
}

const WRITE_TOOLS: Tool[] = WRITE_ENDPOINTS.map(buildToolFromSpec);
const WRITE_ENDPOINT_MAP = new Map(WRITE_ENDPOINTS.map((e) => [e.name, e]));

function buildPath(template: string, args: any, account: Account): string {
  return template.replace(/:([a-zA-Z_]+)/g, (_, key) => {
    let value = args[key];
    if (value === undefined && key === "shop_id") value = account.shop_id;
    if (value === undefined) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return encodeURIComponent(String(value));
  });
}

// MCP tool arguments arrive as whatever JSON type the caller sent, but this
// generic dispatcher's schema declares extra fields as untyped
// (additionalProperties: true) — so a caller passing an array/object field
// (tags, materials, image_ids, products, ...) sometimes has it arrive here
// as the literal string "[\"a\",\"b\"]" instead of a real array. Sent as-is,
// Etsy either rejects it outright (e.g. tags: "contains invalid characters"
// from the literal brackets/quotes) or silently misinterprets it. Coerce any
// string that looks like JSON array/object syntax back into the real type
// before building the request body.
function coerceJsonLikeStrings(obj: any): any {
  const out: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (
        (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        (trimmed.startsWith("{") && trimmed.endsWith("}"))
      ) {
        try {
          out[key] = JSON.parse(trimmed);
          continue;
        } catch {
          // Not actually JSON (e.g. a title that legitimately starts with
          // "[SALE]") — fall through and keep the original string.
        }
      }
      out[key] = value;
    } else if (value && typeof value === "object") {
      out[key] = coerceJsonLikeStrings(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function callWriteEndpoint(spec: EndpointSpec, args: any) {
  const accountName = resolveAccountName(args.account);
  const account = getAccount(accountName);
  const client = getOauthClient(accountName);

  const params = pathParamNames(spec.path);
  const url = buildPath(spec.path, args, account);
  const rest: any = coerceJsonLikeStrings({ ...args });
  delete rest.account;
  for (const p of params) delete rest[p];

  const isBodyMethod = spec.method === "POST" || spec.method === "PUT" || spec.method === "PATCH";
  const response = await client.request({
    method: spec.method,
    url,
    params: isBodyMethod ? undefined : rest,
    data: isBodyMethod ? rest : undefined,
  });
  return response.data;
}

async function listAccounts() {
  reloadAccounts();
  return {
    default_account: accountsData.default_account || null,
    accounts: Object.entries(accountsData.accounts).map(([name, acc]) => ({
      name,
      shop_id: acc.shop_id,
      shop_name: acc.shop_name,
      is_default: name === accountsData.default_account,
    })),
  };
}

function setDefaultAccount(args: any) {
  getAccount(args.account); // throws if unknown; also reloads accountsData fresh
  accountsData.default_account = args.account;
  saveAccounts(accountsData);
  return { default_account: accountsData.default_account };
}

// Tool handlers
async function searchListings(args: any) {
  const params: any = {
    keywords: args.keywords,
    limit: args.limit || 25,
    offset: args.offset || 0,
  };

  if (args.min_price) params.min_price = args.min_price;
  if (args.max_price) params.max_price = args.max_price;
  if (args.sort_on) params.sort_on = args.sort_on;
  if (args.sort_order) params.sort_order = args.sort_order;

  const response = await getPublicClient(args.account).get("/application/listings/active", {
    params,
  });

  return {
    count: response.data.count,
    results: response.data.results.map((listing: any) => ({
      listing_id: listing.listing_id,
      title: listing.title,
      description: listing.description,
      price: listing.price?.amount
        ? `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}`
        : "N/A",
      url: listing.url,
      shop_id: listing.shop_id,
      quantity: listing.quantity,
      state: listing.state,
      created: listing.created_timestamp,
      updated: listing.updated_timestamp,
      tags: listing.tags,
    })),
  };
}

async function getListingDetails(args: any) {
  const includes = args.includes?.join(",") || "";
  const params = includes ? { includes } : {};

  const response = await getPublicClient(args.account).get(
    `/application/listings/${args.listing_id}`,
    { params }
  );

  const listing = response.data;
  return {
    listing_id: listing.listing_id,
    title: listing.title,
    description: listing.description,
    price: listing.price?.amount
      ? `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}`
      : "N/A",
    url: listing.url,
    shop_id: listing.shop_id,
    quantity: listing.quantity,
    state: listing.state,
    created: listing.created_timestamp,
    updated: listing.updated_timestamp,
    tags: listing.tags,
    materials: listing.materials,
    shipping_profile_id: listing.shipping_profile_id,
    shop: listing.Shop,
    images: listing.Images?.map((img: any) => ({
      url_570xN: img.url_570xN,
      url_fullxfull: img.url_fullxfull,
      listing_image_id: img.listing_image_id,
    })),
    videos: listing.Videos,
    inventory: listing.Inventory,
  };
}

async function getShopByName(args: any) {
  // Etsy has no "get shop by exact name" endpoint — /application/shops/{id}
  // (getShop) takes a numeric shop_id, so passing a name string there 400s
  // with "Expected int value for 'shop_id'". The real lookup-by-name path is
  // findShops (fuzzy search via ?shop_name=), so we search and pick the
  // case-insensitive exact match to preserve this tool's "by name" contract.
  const response = await getPublicClient(args.account).get("/application/shops", {
    params: { shop_name: args.shop_name, limit: 25 },
  });

  const shop = (response.data.results || []).find(
    (s: any) => s.shop_name?.toLowerCase() === String(args.shop_name).toLowerCase()
  );

  if (!shop) {
    return {
      found: false,
      shop_name_queried: args.shop_name,
      message: `No shop with the exact name "${args.shop_name}" was found.`,
      similar_matches: (response.data.results || []).map((s: any) => s.shop_name),
    };
  }

  return {
    found: true,
    shop_id: shop.shop_id,
    shop_name: shop.shop_name,
    title: shop.title,
    announcement: shop.announcement,
    currency_code: shop.currency_code,
    is_vacation: shop.is_vacation,
    vacation_message: shop.vacation_message,
    sale_message: shop.sale_message,
    digital_sale_message: shop.digital_sale_message,
    create_date: shop.create_date,
    created_timestamp: shop.created_timestamp,
    listing_active_count: shop.listing_active_count,
    url: shop.url,
  };
}

async function getShopListings(args: any) {
  const params: any = {
    limit: args.limit || 25,
    offset: args.offset || 0,
    state: "active",
  };

  if (args.sort_on) params.sort_on = args.sort_on;
  if (args.sort_order) params.sort_order = args.sort_order;

  const response = await getPublicClient(args.account).get(
    `/application/shops/${args.shop_id}/listings`,
    { params }
  );

  return {
    count: response.data.count,
    results: response.data.results.map((listing: any) => ({
      listing_id: listing.listing_id,
      title: listing.title,
      description: listing.description,
      price: listing.price?.amount
        ? `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}`
        : "N/A",
      url: listing.url,
      quantity: listing.quantity,
      state: listing.state,
      tags: listing.tags,
    })),
  };
}

async function searchShops(args: any) {
  const params: any = {
    shop_name: args.shop_name,
    limit: args.limit || 25,
    offset: args.offset || 0,
  };

  const response = await getPublicClient(args.account).get("/application/shops", { params });

  return {
    count: response.data.count,
    results: response.data.results.map((shop: any) => ({
      shop_id: shop.shop_id,
      shop_name: shop.shop_name,
      title: shop.title,
      url: shop.url,
      listing_active_count: shop.listing_active_count,
      currency_code: shop.currency_code,
      is_vacation: shop.is_vacation,
    })),
  };
}

async function getTrendingListings(args: any) {
  const params: any = {
    limit: args.limit || 25,
    offset: args.offset || 0,
  };

  const response = await getPublicClient(args.account).get("/application/listings/trending", {
    params,
  });

  return {
    count: response.data.count,
    results: response.data.results.map((listing: any) => ({
      listing_id: listing.listing_id,
      title: listing.title,
      price: listing.price?.amount
        ? `${listing.price.amount / listing.price.divisor} ${listing.price.currency_code}`
        : "N/A",
      url: listing.url,
      shop_id: listing.shop_id,
      tags: listing.tags,
    })),
  };
}

async function getShopReviews(args: any) {
  const params: any = {
    limit: args.limit || 25,
    offset: args.offset || 0,
  };

  if (args.min_created) params.min_created = args.min_created;
  if (args.max_created) params.max_created = args.max_created;

  const response = await getPublicClient(args.account).get(
    `/application/shops/${args.shop_id}/reviews`,
    { params }
  );

  return {
    count: response.data.count,
    results: response.data.results.map((review: any) => ({
      shop_id: review.shop_id,
      listing_id: review.listing_id,
      rating: review.rating,
      review: review.review,
      created_timestamp: review.created_timestamp,
      updated_timestamp: review.updated_timestamp,
    })),
  };
}

// --- Multipart uploads (listing images/videos) ---
// Can't go through the generic JSON dispatcher above — Etsy requires
// multipart/form-data with a binary file part for these two.
const MEDIA_TOOLS: Tool[] = [
  {
    name: "upload_listing_image",
    description:
      "Upload a new image to a listing from a local file path, or re-assign a previously deleted image by listing_image_id. Requires OAuth (listings_w). Confirm with the user before calling (write operation).",
    inputSchema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Which connected Etsy account to act on. Defaults to the default account if omitted." },
        shop_id: { type: "number", description: "Shop ID (defaults to the selected account's own shop if omitted)" },
        listing_id: { type: "number", description: "The listing to attach the image to" },
        image_path: { type: "string", description: "Absolute local file path of the image to upload. Omit if using listing_image_id instead." },
        listing_image_id: { type: "number", description: "ID of a previously deleted image to re-assign, instead of uploading a new file." },
        rank: { type: "number", description: "Position among the listing's images (1 = first/leftmost)." },
        overwrite: { type: "boolean", description: "When true, replaces the existing image at the given rank." },
        is_watermarked: { type: "boolean", description: "When true, marks the image as having a watermark." },
        alt_text: { type: "string", description: "Alt text for the image (max 500 characters)." },
      },
      required: ["listing_id"],
    },
  },
  {
    name: "upload_listing_video",
    description:
      "Upload a new video to a listing from a local file path, or re-associate an existing video by video_id. Requires OAuth (listings_w). Confirm with the user before calling (write operation).",
    inputSchema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Which connected Etsy account to act on. Defaults to the default account if omitted." },
        shop_id: { type: "number", description: "Shop ID (defaults to the selected account's own shop if omitted)" },
        listing_id: { type: "number", description: "The listing to attach the video to" },
        video_path: { type: "string", description: "Absolute local file path of the video to upload. Omit if using video_id instead." },
        video_id: { type: "number", description: "ID of an existing video (already on the same shop) to associate with this listing, instead of uploading a new file." },
        name: { type: "string", description: "File name to record for the uploaded video (defaults to the video_path's file name)." },
      },
      required: ["listing_id"],
    },
  },
  {
    name: "upload_listing_file",
    description:
      "Upload the actual digital deliverable (the file a buyer downloads) to a digital listing, from a local file path, or re-associate an existing file by listing_file_id. Requires OAuth (listings_w). Confirm with the user before calling (write operation). SAFETY: attaching a file to a listing that is NOT already type 'download'/'both' silently converts it into a digital listing and strips its shipping profile and variations — this tool checks the listing's current type first and refuses unless it's already download/both, or force is set to true.",
    inputSchema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Which connected Etsy account to act on. Defaults to the default account if omitted." },
        shop_id: { type: "number", description: "Shop ID (defaults to the selected account's own shop if omitted)" },
        listing_id: { type: "number", description: "The listing to attach the file to" },
        file_path: { type: "string", description: "Absolute local file path of the digital file to upload. Omit if using listing_file_id instead." },
        listing_file_id: { type: "number", description: "ID of an existing file (already on the same shop) to associate with this listing, instead of uploading a new one." },
        name: { type: "string", description: "File name to record for the uploaded file (defaults to the file_path's file name)." },
        rank: { type: "number", description: "Display order position among the listing's files (1 = first)." },
        force: { type: "boolean", description: "Skip the listing_type safety check and upload even if the listing isn't already 'download'/'both'. Only use this if converting the listing to digital is intentional." },
      },
      required: ["listing_id"],
    },
  },
];

async function uploadListingImage(args: any) {
  const accountName = resolveAccountName(args.account);
  const account = getAccount(accountName);
  const shopId = args.shop_id || account.shop_id;
  if (!args.listing_id) throw new Error("Missing required parameter: listing_id");
  if (!args.image_path && !args.listing_image_id) {
    throw new Error("Provide either image_path (local file path to upload) or listing_image_id (to re-assign a previously deleted image).");
  }

  const form = new FormData();
  if (args.image_path) {
    const buffer = fs.readFileSync(args.image_path);
    form.append("image", buffer, path.basename(args.image_path));
  } else {
    form.append("listing_image_id", String(args.listing_image_id));
  }
  if (args.rank !== undefined) form.append("rank", String(args.rank));
  if (args.overwrite !== undefined) form.append("overwrite", String(args.overwrite));
  if (args.is_watermarked !== undefined) form.append("is_watermarked", String(args.is_watermarked));
  if (args.alt_text) form.append("alt_text", args.alt_text);

  const client = getOauthClient(accountName);
  const response = await client.request({
    method: "POST",
    url: `/application/shops/${shopId}/listings/${args.listing_id}/images`,
    data: form,
    headers: form.getHeaders(),
  });
  return response.data;
}

async function uploadListingVideo(args: any) {
  const accountName = resolveAccountName(args.account);
  const account = getAccount(accountName);
  const shopId = args.shop_id || account.shop_id;
  if (!args.listing_id) throw new Error("Missing required parameter: listing_id");
  if (!args.video_path && !args.video_id) {
    throw new Error("Provide either video_path (local file path to upload) or video_id (to re-associate an existing video).");
  }

  const form = new FormData();
  if (args.video_path) {
    const buffer = fs.readFileSync(args.video_path);
    form.append("video", buffer, path.basename(args.video_path));
    form.append("name", args.name || path.basename(args.video_path));
  } else {
    form.append("video_id", String(args.video_id));
  }

  const client = getOauthClient(accountName);
  const response = await client.request({
    method: "POST",
    url: `/application/shops/${shopId}/listings/${args.listing_id}/videos`,
    data: form,
    headers: form.getHeaders(),
  });
  return response.data;
}

async function uploadListingFile(args: any) {
  const accountName = resolveAccountName(args.account);
  const account = getAccount(accountName);
  const shopId = args.shop_id || account.shop_id;
  if (!args.listing_id) throw new Error("Missing required parameter: listing_id");
  if (!args.file_path && !args.listing_file_id) {
    throw new Error("Provide either file_path (local file path to upload) or listing_file_id (to re-associate an existing file).");
  }

  const client = getOauthClient(accountName);

  if (!args.force) {
    const listingRes = await client.get(`/application/listings/${args.listing_id}`);
    const listingType = listingRes.data?.listing_type;
    if (listingType !== "download" && listingType !== "both") {
      throw new Error(
        `Listing ${args.listing_id} has listing_type "${listingType}", not "download"/"both". Uploading a file here would silently convert it into a digital listing and strip its shipping profile and variations. If that's intentional, set type: "download" via update_listing first (confirm with the user), or pass force: true to override this check.`
      );
    }
  }

  const form = new FormData();
  if (args.file_path) {
    const buffer = fs.readFileSync(args.file_path);
    form.append("file", buffer, path.basename(args.file_path));
    form.append("name", args.name || path.basename(args.file_path));
  } else {
    form.append("listing_file_id", String(args.listing_file_id));
  }
  if (args.rank !== undefined) form.append("rank", String(args.rank));

  const response = await client.request({
    method: "POST",
    url: `/application/shops/${shopId}/listings/${args.listing_id}/files`,
    data: form,
    headers: form.getHeaders(),
  });
  return response.data;
}

// Create and configure MCP server
const server = new Server(
  {
    name: "etsy-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...TOOLS, ...WRITE_TOOLS, ...MEDIA_TOOLS],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    const writeSpec = WRITE_ENDPOINT_MAP.get(name);
    if (writeSpec) {
      return {
        content: [
          { type: "text", text: JSON.stringify(await callWriteEndpoint(writeSpec, args), null, 2) },
        ],
      };
    }

    switch (name) {
      case "search_listings":
        return { content: [{ type: "text", text: JSON.stringify(await searchListings(args), null, 2) }] };
      case "get_listing_details":
        return { content: [{ type: "text", text: JSON.stringify(await getListingDetails(args), null, 2) }] };
      case "get_shop_by_name":
        return { content: [{ type: "text", text: JSON.stringify(await getShopByName(args), null, 2) }] };
      case "get_shop_listings":
        return { content: [{ type: "text", text: JSON.stringify(await getShopListings(args), null, 2) }] };
      case "search_shops":
        return { content: [{ type: "text", text: JSON.stringify(await searchShops(args), null, 2) }] };
      case "get_trending_listings":
        return { content: [{ type: "text", text: JSON.stringify(await getTrendingListings(args), null, 2) }] };
      case "get_shop_reviews":
        return { content: [{ type: "text", text: JSON.stringify(await getShopReviews(args), null, 2) }] };
      case "list_accounts":
        return { content: [{ type: "text", text: JSON.stringify(await listAccounts(), null, 2) }] };
      case "set_default_account":
        return { content: [{ type: "text", text: JSON.stringify(setDefaultAccount(args), null, 2) }] };
      case "upload_listing_image":
        return { content: [{ type: "text", text: JSON.stringify(await uploadListingImage(args), null, 2) }] };
      case "upload_listing_video":
        return { content: [{ type: "text", text: JSON.stringify(await uploadListingVideo(args), null, 2) }] };
      case "upload_listing_file":
        return { content: [{ type: "text", text: JSON.stringify(await uploadListingFile(args), null, 2) }] };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message;
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Etsy MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
