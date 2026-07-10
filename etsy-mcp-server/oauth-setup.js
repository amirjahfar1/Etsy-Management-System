// OAuth 2.0 helper for the Etsy MCP server — connects (or reconnects) ONE
// account per run and stores it in accounts.json under the given name.
// Run with: node oauth-setup.js <account-name>
// Listens on a FIXED port/path so the callback URL registered in the
// Etsy app dashboard never needs to change between runs or accounts.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '.env');
const ACCOUNTS_PATH = path.join(__dirname, 'accounts.json');

const PORT = 3945;
const LOCALHOST_REDIRECT_URI = `http://localhost:${PORT}/oauth/redirect`;
// Used only with --remote. Override without editing this file via
// OAUTH_PUBLIC_REDIRECT_URI=... in the environment or .env.
const PUBLIC_REDIRECT_URI = process.env.OAUTH_PUBLIC_REDIRECT_URI || 'https://aamirali.com/etsy-callback.php';

const initFlag = process.argv.includes('--init');
const completeArg = process.argv.find((a) => a.startsWith('--complete='));
// --init / --complete are the two-step remote flow driven by something else
// (e.g. Claude) across separate invocations: --init prints the authorize URL
// and exits; --complete= finishes the exchange using a pasted "state code"
// line. Both imply remote mode. Plain --remote is the single-process
// interactive flow for a human running this at their own terminal.
const remoteMode = initFlag || !!completeArg || process.argv.includes('--remote') || process.env.OAUTH_REMOTE === '1';
const REDIRECT_URI = remoteMode ? PUBLIC_REDIRECT_URI : LOCALHOST_REDIRECT_URI;

const PENDING_DIR = path.join(__dirname, '.oauth-pending');
function pendingFilePath(name) {
  return path.join(PENDING_DIR, `${name}.json`);
}

const accountName = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
if (!accountName) {
  console.error('Usage: node oauth-setup.js <account-name> [--remote | --init | --complete="<state> <code>"]');
  console.error('Example: node oauth-setup.js my-second-shop');
  console.error('  --remote            : complete the Etsy login on ANY machine/IP, in one run.');
  console.error('                        Prints the authorize URL, then prompts you to paste back');
  console.error('                        the "state code" line shown by the aamirali.com catcher');
  console.error('                        page, instead of running a local callback server.');
  console.error('  --init               : first half of the remote flow, split across two runs.');
  console.error('                        Prints the authorize URL and exits; saves the pending');
  console.error('                        PKCE verifier to .oauth-pending/<account>.json.');
  console.error('  --complete="<line>"  : second half — finishes the exchange using the "state code"');
  console.error('                        line from the catcher page and the file --init saved.');
  process.exit(1);
}

function loadEnv() {
  const env = {};
  if (fs.existsSync(ENV_PATH)) {
    for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
  }
  return env;
}

function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    return { default_account: '', accounts: {} };
  }
  return JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8'));
}

function saveAccounts(data) {
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(data, null, 2) + '\n');
}

const env = loadEnv();
const CLIENT_ID = process.env.ETSY_API_KEY || env.ETSY_API_KEY;
const SHARED_SECRET = process.env.ETSY_SHARED_SECRET || env.ETSY_SHARED_SECRET;

if (!CLIENT_ID) {
  console.error('Missing ETSY_API_KEY. Add it to etsy-mcp-server/.env first, e.g.:');
  console.error('  ETSY_API_KEY=your_keystring');
  process.exit(1);
}

const SCOPES = [
  'shops_r', 'shops_w',
  'listings_r', 'listings_w', 'listings_d',
  'transactions_r', 'transactions_w',
  'profile_r', 'profile_w',
  'email_r', 'address_r', 'address_w',
].join(' ');

const codeVerifier = crypto.randomBytes(32).toString('base64url');
const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
const state = crypto.randomBytes(16).toString('hex');

const authorizeUrl = new URL('https://www.etsy.com/oauth/connect');
authorizeUrl.searchParams.set('response_type', 'code');
authorizeUrl.searchParams.set('client_id', CLIENT_ID);
authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authorizeUrl.searchParams.set('scope', SCOPES);
authorizeUrl.searchParams.set('state', state);
authorizeUrl.searchParams.set('code_challenge', codeChallenge);
authorizeUrl.searchParams.set('code_challenge_method', 'S256');

async function fetchShopInfo(accessToken) {
  // access_token is "<user_id>.<opaque>" — the numeric prefix is the Etsy user id.
  const userId = accessToken.split('.')[0];
  const apiKeyHeader = SHARED_SECRET ? `${CLIENT_ID}:${SHARED_SECRET}` : CLIENT_ID;
  const res = await fetch(`https://openapi.etsy.com/v3/application/users/${userId}/shops`, {
    headers: {
      'x-api-key': apiKeyHeader,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return { shop_id: null, shop_name: null };
  const shop = await res.json();
  return { shop_id: String(shop.shop_id), shop_name: shop.shop_name };
}

// Shared by all modes: validates state, exchanges the code for tokens, fetches
// shop info, and writes accounts.json. Returns a result object instead of
// touching an HTTP response directly, so each caller (local-server handler,
// single-run remote prompt, or the --complete step) can report it their own way.
// Takes verifier/expectedState/redirectUri explicitly rather than closing over
// the top-of-file ones, because --complete runs in a fresh process and must use
// the values --init persisted to disk, not freshly-generated ones.
async function completeAuth(code, returnedState, { verifier, expectedState, redirectUri }) {
  if (returnedState !== expectedState) {
    console.error('State mismatch. Expected', expectedState, 'got', returnedState);
    return { status: 'state_mismatch' };
  }

  const tokenRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error('Token exchange failed:', tokens);
    return { status: 'token_error', tokens };
  }

  const { shop_id, shop_name } = await fetchShopInfo(tokens.access_token);

  const accountsData = loadAccounts();
  accountsData.accounts[accountName] = {
    shop_id,
    shop_name,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    // Recorded so the MCP server can use this account's own app credentials
    // (x-api-key, token refresh) instead of the default .env ones — matters
    // whenever this account was connected through a different Etsy Developer
    // App than the default. Harmless to store even when it matches .env.
    api_key: CLIENT_ID,
    shared_secret: SHARED_SECRET,
  };
  const isNowDefault = !accountsData.default_account;
  if (isNowDefault) {
    accountsData.default_account = accountName;
  }
  saveAccounts(accountsData);

  console.log(`Success. Account "${accountName}"${shop_name ? ` -> shop "${shop_name}" (${shop_id})` : ''} saved to etsy-mcp-server/accounts.json`);
  console.log('Access token expires in', tokens.expires_in, 'seconds; refresh_token is valid ~90 days and refreshes automatically.');
  if (isNowDefault) {
    console.log('This is now the default account (use set_default_account to change it once more accounts are connected).');
  }

  return { status: 'success', shop_id, shop_name };
}

if (initFlag) {
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  fs.writeFileSync(
    pendingFilePath(accountName),
    JSON.stringify({ accountName, codeVerifier, state, redirectUri: REDIRECT_URI }, null, 2) + '\n'
  );
  console.log(`Connecting account: "${accountName}" (remote mode, step 1/2)`);
  console.log(`Using public redirect URI: ${REDIRECT_URI}`);
  console.log('Make sure this exact URL is registered as a Callback URL in your Etsy app');
  console.log('(alongside the existing localhost one — Etsy apps support multiple).');
  console.log('\nOpen this URL from ANY machine/browser/network to authorize:\n');
  console.log(authorizeUrl.toString());
  console.log('\nAfter approving, copy the "<state> <code>" line the catcher page shows and run:');
  console.log(`  node oauth-setup.js ${accountName} --complete="<paste the line here>"`);
  process.exit(0);
} else if (completeArg) {
  const pending = pendingFilePath(accountName);
  if (!fs.existsSync(pending)) {
    console.error(`No pending authorization found for "${accountName}". Run --init first.`);
    process.exit(1);
  }
  const { codeVerifier: savedVerifier, state: savedState, redirectUri: savedRedirectUri } = JSON.parse(fs.readFileSync(pending, 'utf8'));

  const pasted = completeArg.slice('--complete='.length).replace(/^"|"$/g, '').trim();
  const spaceIdx = pasted.indexOf(' ');
  if (spaceIdx === -1) {
    console.error('Expected "<state> <code>" (space-separated) — got a single token. Aborting.');
    process.exit(1);
  }
  const pastedState = pasted.slice(0, spaceIdx);
  const pastedCode = pasted.slice(spaceIdx + 1).trim();

  const result = await completeAuth(pastedCode, pastedState, {
    verifier: savedVerifier,
    expectedState: savedState,
    redirectUri: savedRedirectUri,
  });
  if (result.status === 'success') {
    fs.unlinkSync(pending);
  }
  // process.exitCode (not process.exit()) — forcing an immediate exit right
  // after an awaited fetch() can crash with a libuv assertion on some Node
  // builds because the fetch's socket handle is still mid-teardown. Setting
  // exitCode and letting the script reach end-of-file naturally avoids that.
  process.exitCode = result.status === 'success' ? 0 : 1;
} else if (remoteMode) {
  console.log(`Connecting account: "${accountName}" (remote mode)`);
  console.log(`Using public redirect URI: ${REDIRECT_URI}`);
  console.log('Make sure this exact URL is registered as a Callback URL in your Etsy app');
  console.log('(alongside the existing localhost one — Etsy apps support multiple).');
  console.log('\nOpen this URL from ANY machine/browser/network to authorize:\n');
  console.log(authorizeUrl.toString());
  console.log('\nAfter approving, the aamirali.com page shows a line like "<state> <code>".');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const pasted = (await rl.question('Paste that line here: ')).trim();
  rl.close();

  const spaceIdx = pasted.indexOf(' ');
  if (spaceIdx === -1) {
    console.error('Expected "<state> <code>" (space-separated) — got a single token. Aborting.');
    process.exit(1);
  }
  const pastedState = pasted.slice(0, spaceIdx);
  const pastedCode = pasted.slice(spaceIdx + 1).trim();

  const result = await completeAuth(pastedCode, pastedState, { verifier: codeVerifier, expectedState: state, redirectUri: REDIRECT_URI });
  process.exitCode = result.status === 'success' ? 0 : 1;
} else {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname !== '/oauth/redirect') {
      res.writeHead(404).end('Not found');
      return;
    }

    const returnedState = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' }).end(`<h2>Authorization failed</h2><p>${error}</p>`);
      console.error('Authorization error:', error, url.searchParams.get('error_description'));
      server.close();
      process.exitCode = 1;
      return;
    }

    try {
      const result = await completeAuth(code, returnedState, { verifier: codeVerifier, expectedState: state, redirectUri: REDIRECT_URI });

      // process.exitCode (not process.exit()) after every branch below — forcing
      // an immediate exit right after an awaited fetch() can crash with a libuv
      // assertion on some Node builds because the fetch's socket handle is still
      // mid-teardown. Setting exitCode and closing the server lets the process
      // end naturally once the event loop drains, without that crash.
      if (result.status === 'state_mismatch') {
        res.writeHead(400, { 'Content-Type': 'text/html' }).end('<h2>State mismatch — possible CSRF, aborting.</h2>');
        server.close();
        process.exitCode = 1;
        return;
      }
      if (result.status === 'token_error') {
        res.writeHead(400, { 'Content-Type': 'text/html' }).end(`<h2>Token exchange failed</h2><pre>${JSON.stringify(result.tokens, null, 2)}</pre>`);
        server.close();
        process.exitCode = 1;
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' }).end(
        `<h2>Authorized ✓</h2><p>Account "${accountName}"${result.shop_name ? ` (${result.shop_name})` : ''} saved to etsy-mcp-server/accounts.json. You can close this tab.</p>`
      );
      server.close();
      process.exitCode = 0;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html' }).end('<h2>Unexpected error</h2>');
      console.error(err);
      server.close();
      process.exitCode = 1;
    }
  });

  server.listen(PORT, () => {
    console.log(`Connecting account: "${accountName}"`);
    console.log(`Callback server listening at ${REDIRECT_URI}`);
    console.log('Make sure this exact URL is registered as a Callback URL in your Etsy app.');
    console.log('\nOpen this URL in your browser to authorize:\n');
    console.log(authorizeUrl.toString());
    console.log('\nWaiting for you to approve access...');
  });
}
