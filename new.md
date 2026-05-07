# OAuth Callback Handling

## Backend Behavior

The backend's `GET /auth/github/callback` handles GitHub's OAuth redirect. It distinguishes between **web** and **CLI** clients via the encoded `state` parameter.

### Web Flow

1. Backend receives `?code=xxx&state=yyy` from GitHub
2. Decodes state, retrieves PKCE code verifier, exchanges code for GitHub access token
3. Fetches GitHub user profile, creates/updates user in DB
4. Signs JWT `access_token` (15m) + `refresh_token` (7d)
5. Sets both tokens as **HTTP-only cookies** (`access_token`, `refresh_token`)
6. Redirects browser to `${FRONTEND_URL}/auth/callback`

The frontend should:
- Listen on `/auth/callback`
- Read the cookies (browser sends them automatically with requests)
- Call a backend endpoint (e.g. `GET /auth/me` or decode the JWT) to get user info
- Navigate to the dashboard

## CSRF Token

The backend uses double-submit cookie pattern via `csrf-csrf`. On every mutating request (`POST`, `PUT`, `PATCH`, `DELETE`), the frontend must send the CSRF token in the `X-CSRF-Token` header.

### Frontend Implementation

**On app load** — fetch the CSRF token once and store in memory (not localStorage):

```ts
let csrfToken: string | null = null;

async function bootstrapCsrf() {
  const res = await fetch('http://localhost:3000/csrf-token', {
    credentials: 'include',
  });
  const data = await res.json();
  csrfToken = data.token;
}
```

**On every mutating request** — attach the token as a header:

```ts
async function apiPost(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken ?? '',
      'X-API-Version': '1',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}
```

The backend reads the CSRF token from the `x-csrf-token` cookie (set by the server, readable by JS via `httpOnly: false`) and compares it with the `X-CSRF-Token` header. If they don't match, the request is rejected with 403.

### Rules

- Token is fetched once and held in a JavaScript variable (not localStorage, not sessionStorage)
- On full page reload, re-fetch from `GET /csrf-token`
- Every `POST`/`PUT`/`PATCH`/`DELETE` request must include `X-CSRF-Token` header
- `GET`/`HEAD`/`OPTIONS` requests do not need the header

### Error Handling

If the callback fails (expired state, invalid code, etc.):
- Backend returns JSON `{ status: "error", message: "<reason>" }` with status 500
- The error is not swallowed by a redirect

### CLI Flow

1. Backend receives `?code=xxx&state=yyy` where state contains `client: "cli"`
2. Completes the same OAuth exchange + token issuance
3. Returns a minimal HTML page: *"Login successful. You may close this tab."*
4. CLI polls with `?temp_token=xxx` to retrieve the tokens
