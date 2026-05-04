# Insighta Labs Backend

Backend API for the Insighta Labs platform — a unified system powering a CLI tool and web portal for profile management and analytics.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Authentication Flow](#authentication-flow)
- [Token Handling Approach](#token-handling-approach)
- [Role Enforcement Logic](#role-enforcement-logic)
- [Natural Language Parsing](#natural-language-parsing)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [CLI Usage](#cli-usage)
- [Logging](#logging)
- [Project Structure](#project-structure)

---

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   CLI (Node.js) │     │  Web Portal     │     │  GitHub          │
│   (local)       │     │  (browser)      │     │  OAuth Provider  │
└───────┬─────────┘     └───────┬─────────┘     └───────┬──────────┘
        │                       │                       │
        │  Bearer tokens        │  HTTP-only cookies    │  OAuth redirect
        │                       │                       │
        └───────────┬───────────┘                       │
                    │                                   │
              ┌─────▼───────────────────────────────────▼─────┐
              │              Backend API (Express)            │
              │  ┌─────────────────────────────────────────┐  │
              │  │ Middleware Pipeline                     │  │
              │  │ CORS → JSON → Cookie → Morgan → Routes │  │
              │  └─────────────────────────────────────────┘  │
              │  ┌────────────┐  ┌──────────────────────────┐  │
              │  │ /auth/*    │  │ /api/profiles/*          │  │
              │  │ GitHub     │  │ Auth + Role + Version    │  │
              │  │ OAuth/PKCE │  │ Middleware Stack         │  │
              │  └────────────┘  └──────────────────────────┘  │
              └────────────────────────┬────────────────────────┘
                                       │
                              ┌────────▼────────┐
                              │  PostgreSQL      │
                              │  (via Prisma)    │
                              │  Users, Accounts │
                              │  Profiles        │
                              └─────────────────┘
```

The system follows a three-tier architecture:
1. **Backend** — Express + TypeScript + Prisma + PostgreSQL
2. **CLI** — Node.js tool installed globally (`~/.insighta/`)
3. **Web Portal** — Browser-based frontend using HTTP-only cookies

Both CLI and Web share the same backend APIs with different authentication transport layers.

---

## Authentication Flow

### GitHub OAuth with PKCE

The backend supports **both web and CLI clients** through a single OAuth flow, distinguished by a `client` query parameter:

### Web Flow (Cookie-based)

```
1. GET /auth/github?client=web
   → Server generates PKCE code_verifier + code_challenge
   → Encodes state: { client: "web", ts: <timestamp> } as base64
   → Stores code_verifier mapped to state
   → Redirects to GitHub OAuth authorize URL

2. User authorizes on GitHub
   → GitHub redirects to GET /auth/github/callback?code=xxx&state=yyy

3. Server decodes state, retrieves code_verifier
   → Exchanges code for GitHub access token
   → Fetches user profile, creates/updates user in DB
   → Signs JWT access_token (15m) + refresh_token (7d)
   → Sets both as HTTP-only cookies
   → Redirects to frontend with ?token=ok
```

### CLI Flow (Token-based)

```
1. GET /auth/github?client=cli
   → Server generates PKCE + temp_token
   → Encodes state: { client: "cli", temp_token: "xxx", ts: <timestamp> }
   → Returns { auth_url, temp_token } as JSON

2. CLI opens auth_url in user's browser
   → User authorizes on GitHub
   → GitHub redirects to /auth/github/callback
   → Server completes auth, stores result under temp_token (10min TTL)
   → Shows "Login successful" HTML page

3. CLI polls GET /auth/github/callback?temp_token=xxx
   → Returns tokens when available
   → Returns { status: "pending" } (202) while waiting
   → Returns { status: "error", message: "Session expired" } (410) if timeout
```

---

## Token Handling Approach

### Token Types

| Token | Lifetime | Transport (Web) | Transport (CLI) |
|---|---|---|---|
| `access_token` | 15 minutes | HTTP-only cookie (`sameSite: lax`) | Response body |
| `refresh_token` | 7 days | HTTP-only cookie (`sameSite: lax`) | Response body |

### Token Rotation

The refresh endpoint (`POST /auth/refresh`) implements **refresh token rotation**:
1. Verifies the refresh token signature
2. Atomically consumes (invalidates) the old token via Prisma transaction
3. Issues a new access_token + refresh_token pair
4. Stores new refresh token in the `Account` table
5. If the old token is not found (already consumed), clears all cookies and returns 401 — protecting against token theft

### Security

- **Web**: Both tokens are `httpOnly: true`, preventing JavaScript access (CSRF attack mitigation)
- **CLI**: Tokens returned in JSON body only; stored at `~/.insighta/credentials.json`
- **State**: Encoded as base64 JSON with timestamp; single-use; deleted after callback
- **Code verifier**: Single-use; deleted after token exchange

---

## Role Enforcement Logic

Roles are enforced through **structured middleware**, not scattered per-route checks:

### Middleware Stack for `/api/profiles/*`

```
requireApiVersion → authenticate → [requireRole('ADMIN')] → controller
```

| Middleware | Purpose | Location |
|---|---|---|
| `requireApiVersion` | Rejects requests without `X-API-Version: 1` header | `src/middlewares/apiversion.middleware.ts` |
| `authenticate` | Validates access token from Bearer header or cookie; checks user is active | `src/middlewares/auth.middleware.ts` |
| `requireRole(...roles)` | Enforces role-based access control | `src/middlewares/authorize.middleware.ts` |

### Role Matrix

| Role | GET /api/profiles | GET /api/profiles/search | POST /api/profiles | DELETE /api/profiles/:id |
|---|---|---|---|---|
| `ANALYST` | ✅ | ✅ | ❌ 403 | ❌ 403 |
| `ADMIN` | ✅ | ✅ | ✅ | ✅ |

- Default role on signup: `ANALYST`
- If `is_active = false` → 403 Forbidden on all authenticated requests

---

## Natural Language Parsing

The `GET /api/profiles/search?q=<query>` endpoint parses natural language queries to filter profiles:

**Supported patterns:**
- Gender: "male", "female", "men", "women", "boys", "girls"
- Country: country names or codes (e.g., "nigeria", "NG", "united states")
- Age group: "young", "adult", "middle-aged", "elderly", "child"
- Age range: "age 25-40", "25 to 40", "over 30", "under 25"
- Min/max age: "min age 25", "max 40"

The parser uses regex pattern matching to extract structured filter parameters from free-text queries, then translates them into Prisma `where` clauses.

---

## API Endpoints

### Authentication (`/auth`)

| Method | Path | Description | Auth Required |
|---|---|---|---|
| `GET` | `/auth/github` | Initiate GitHub OAuth. Query: `client=web\|cli`, `redirect_uri` (for web) | ❌ |
| `GET` | `/auth/github/callback` | OAuth callback / CLI token poll. Query: `code`, `state` or `temp_token` | ❌ |
| `POST` | `/auth/refresh` | Rotate refresh token. Body or cookie: `refresh_token` | ❌ (uses refresh cookie) |
| `POST` | `/auth/logout` | Invalidate refresh tokens, clear cookies | ✅ |

### Profiles (`/api/profiles`)

**Required header for all:** `X-API-Version: 1`

| Method | Path | Description | Role |
|---|---|---|---|
| `GET` | `/api/profiles` | List profiles with pagination, filters, sorting | Authenticated |
| `GET` | `/api/profiles/search` | Natural language search | Authenticated |
| `GET` | `/api/profiles/:id` | Get single profile by ID | Authenticated |
| `POST` | `/api/profiles` | Create profile (calls external APIs) | `ADMIN` |
| `DELETE` | `/api/profiles/:id` | Delete profile | `ADMIN` |

### Query Parameters

**List & Search:**
- `page` (default: 1), `limit` (default: 10)
- `gender`, `country`, `age_group`, `min_age`, `max_age`
- `sort_by` (`name`, `gender`, `age`, `country`, `created_at`), `order` (`asc`, `desc`)
- `q` (search endpoint only — natural language query)

### Pagination Response Format

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "total_pages": 203,
  "links": {
    "self": "/api/profiles?page=1&limit=10",
    "next": "/api/profiles?page=2&limit=10",
    "prev": null
  },
  "data": [ ... ]
}
```

### Standard Error Response

```json
{
  "status": "error",
  "message": "descriptive error message"
}
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# GitHub OAuth App
GITHUB_APP_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback

# JWT Secrets (use strong random strings)
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# CSRF Protection
CSRF_SECRET=your_csrf_secret_here

# Frontend URL (for OAuth redirect after login)
FRONTEND_URL=http://localhost:3000
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL
- npm

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Useful Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix linting issues |
| `npm run format` | Format code with Prettier |
| `npm test` | Run test suite |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run seed` | Seed database with sample data |

---

## CLI Usage

The CLI tool (`insighta`) is in a separate repository. After installation:

```bash
# Authentication
insighta login                  # Start OAuth flow, poll for tokens
insighta logout                 # Clear stored credentials
insighta whoami                 # Show current user info

# Profiles
insighta profiles list                               # List all profiles
insighta profiles list --gender male                 # Filter by gender
insighta profiles list --country NG --age-group adult # Multiple filters
insighta profiles list --min-age 25 --max-age 40     # Age range
insighta profiles list --sort-by age --order desc    # Sorting
insighta profiles list --page 2 --limit 20           # Pagination

insighta profiles get <id>                           # Get single profile
insighta profiles search "young males from nigeria"  # Natural language search
insighta profiles create --name "Harriet Tubman"     # Create profile (admin)

insighta profiles export --format csv                # Export to CSV
insighta profiles export --format csv --gender male --country NG
```

Credentials are stored at `~/.insighta/credentials.json` with automatic token refresh.

---

## Logging

The backend uses **Winston** for application logs and **Morgan** for HTTP request logging, unified through a single logger pipeline:

```
2026-05-04T12:00:00.000Z [info]: [auth] Initiating auth flow {"client":"web"}
2026-05-04T12:00:01.000Z [info]: [auth] GitHub token exchange successful
2026-05-04T12:00:01.000Z [info]: [auth] User saved {"user_id":"...","role":"ANALYST"}
2026-05-04T12:00:01.000Z [debug]: [http] GET /api/profiles 200 45ms
2026-05-04T12:00:02.000Z [warn]: [auth] Token verification failed {"method":"GET","path":"/api/profiles"}
```

**Log levels:**
- `debug` — Token verification, code verifier storage, HTTP requests (development only)
- `info` — Auth flow steps, user operations, token issuance
- `warn` — Failed auth attempts, expired sessions, inactive accounts
- `error` — Token exchange failures, database errors, callback failures

---

## Project Structure

```
src/
├── config/
│   └── logger.ts                 # Winston + Morgan logger setup
├── controllers/
│   ├── auth.controller.ts        # Auth flow handlers
│   └── profile.controller.ts     # Profile CRUD + search
├── lib/
│   └── prisma.ts                 # Prisma client initialization
├── middlewares/
│   ├── auth.middleware.ts        # Bearer token + cookie authentication
│   ├── authorize.middleware.ts   # Role-based authorization
│   ├── apiversion.middleware.ts  # X-API-Version header check
│   └── error.middleware.ts       # Global error handler
├── models/
│   ├── auth.model.ts             # User upsert logic
│   ├── token.model.ts            # Refresh token storage + rotation
│   └── user.model.ts             # User lookup by ID
├── routes/
│   ├── auth.route.ts             # /auth/* routes
│   └── profile.routes.ts         # /api/profiles/* routes
├── services/
│   ├── auth.service.ts           # OAuth, PKCE, device flow, state encoding
│   └── token.service.ts          # JWT sign/verify
├── types/
│   └── express.d.ts              # Express Request.user augmentation
├── utils/
│   ├── AppError.ts               # Custom error class
│   ├── catchAsync.ts             # Async error wrapper
│   ├── externalApi.ts            # External API clients
│   └── responseHandler.ts        # Standardized response helpers
├── app.ts                        # Express app + middleware pipeline
└── server.ts                     # HTTP server entry point
```

---

## Security

- **PKCE** — SHA-256 code challenge for OAuth flow
- **HTTP-only cookies** — Tokens inaccessible to JavaScript in web portal
- **CSRF protection** — Double-submit token pattern via `csrf-csrf`
- **Refresh token rotation** — Atomic consume + reissue prevents token reuse
- **Structured middleware** — Auth and role checks applied at route level, not scattered
- **Single-use state** — OAuth state deleted after callback
- **Environment variables** — No hardcoded secrets or URLs
