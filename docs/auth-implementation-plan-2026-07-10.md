# QGI Auth — implementation plan (Google + Cognito email/password)

**Date:** 2026-07-10 · **Author:** Claude Code (frontend session) · **Status:** PLAN for founder review — no code written yet.
**Goal:** full **sign-in + sign-up** for QGI using (1) **Google** and (2) **Cognito email/password**, with a native in-page form (no hosted-UI redirect for email/password). **Localhost first**; push to prod later after the founder tests locally.

---

## 0. Current state (from investigation — 3 read-only agents)

| Area               | Finding                                                                                                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth lib           | `next-auth@^5.0.0-beta.30` (Auth.js v5), `jose@6` (for Cognito JWT verify). `next@16.2.2` → middleware is `proxy.ts`. **No DB / Prisma / adapter.**                                                                                                                                                         |
| NextAuth config    | `lib/auth-config.ts` — Google-only **stub** (empty creds), JWT sessions (default), no `SessionProvider`, **never actually used** except the handler route.                                                                                                                                                  |
| Cognito (frontend) | `lib/auth.ts` — **dormant** `jose` verifier of Cognito Bearer JWTs; gates 4 API routes via `withAuth`/`requireGroup("pro")` on the `cognito:groups` claim. No code ever _mints_ a token. Reads `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `AWS_REGION`(=eu-central-1).                                    |
| Login UI           | `app/login/page.tsx` = **"coming soon" stub** (#429). **No signup / account / forgot-password pages.** No `useSession` anywhere.                                                                                                                                                                            |
| Gating             | `proxy.ts` — manual cookie check for `authjs.session-token`; redirects to `/login`. Matcher gates `/dashboard,/trends,/risk-board,/compound-risk,/compare,/analogues,/patterns,/countries/:iso`. `SKIP_AUTH=true` bypasses everything (3 places: `proxy.ts:14`, `lib/auth.ts:74`, `lib/auth-config.ts:26`). |
| Cognito infra      | **None exists** (searched qgi-infra + qgi-aws-tf). Build from zero. Region **must** be `eu-central-1` (issuer URL is derived from it). Staging `222222222222` → prod `444444444444`. Ticket **qgi-aws-tf#103 / #448**.                                                                                      |
| Google/GCP         | **No gcloud/bq/creds on this machine** (old `/workspace` profile gone post-reset). **No reusable OAuth web client.** BQ used a _user_ ADC — NOT reusable for web sign-in. Need a new **Web OAuth client** in project `extreme-lattice-344211` (console only).                                            |
| ⚠️ Side flags      | `.env.local` holds plaintext AWS STS creds (gitignored) + `SKIP_AUTH=true,SKIP_AUTH_GROUPS=pro`. The "split-brain" (NextAuth-Google vs dormant-Cognito) must be reconciled by this plan.                                                                                                                    |

---

## 1. Architecture decision (the key call)

Two coherent options. **Recommendation: Option A now, Option B later.**

### ✅ Option A — NextAuth front door; Cognito for email/password; Google direct _(recommended for Phase 1, localhost-first)_

- **Email/password** → NextAuth **Credentials provider** that calls Cognito directly (`@aws-sdk/client-cognito-identity-provider`: `InitiateAuth`/`SignUp`/`ConfirmSignUp`/`ForgotPassword`). **Native form on our own domain, no Hosted UI.** Email/pass users live in Cognito → carry `cognito:groups`.
- **Google** → NextAuth's **direct Google provider** (already wired; native "Continue with Google" button; redirect to Google, not Cognito). Google users live in the **NextAuth JWT session only** (not in Cognito) for now.
- **Session** → NextAuth JWT cookie for both; a `jwt`/`session` callback normalizes both to `{ sub, email, provider, groups }`.
- **Pros:** fastest to a _working, native-UX_ auth on localhost; minimal infra (Cognito **user pool + app client only** — no Hosted-UI domain); reuses the existing Google wiring; best UX (no redirect hops).
- **Cons / accepted for launch:** split user store — Google users aren't in Cognito, so they have no `cognito:groups`. This is **fine at launch** because `pro` is a _paid_ tier nobody has yet; the pro-gated APIs stay gated for everyone until payments exist (Phase 3).

### Option B — Fully unified in Cognito (Google federated _into_ Cognito) _(the robust end-state)_

- Google configured as a **social IdP inside the Cognito user pool**; sign-in via NextAuth **Cognito provider** (OAuth code flow → Cognito **Hosted UI** → Google). Every user (Google + email/pass) is a Cognito user → uniform `cognito:groups`.
- **Pros:** single source of truth; plan-gating works for everyone; no future migration of Google users into Cognito.
- **Cons:** more infra (`aws_cognito_user_pool_domain` + Hosted UI + Google-IdP config in Cognito); the Google flow hops through Cognito's Hosted UI (a themable but off-domain page); heavier to stand up for a first localhost test.

**Why A→B:** ship a real, native, testable auth fast (A). Migrate Google identities into Cognito (B) only when you actually need Google users to hold plan/tier claims — cleanly deferrable, and A doesn't paint us into a corner (NextAuth stays the front door either way).

> The rest of this plan implements **Option A**, with the few Option-B-only steps called out.

---

## 2. Target design (Option A)

```
Browser  ──►  /login (native form)               ──►  NextAuth Credentials provider
             ├─ "Continue with Google" button    ──►  NextAuth Google provider ──► Google
             └─ email + password                        └─ @aws-sdk/client-cognito-identity-provider
                                                            InitiateAuth (USER_PASSWORD_AUTH) ──► Cognito User Pool
  /signup, /forgot-password (native forms)  ──►  server actions ──► SignUp/ConfirmSignUp/ForgotPassword ──► Cognito
  session (JWT cookie, authjs.session-token) ◄── jwt/session callbacks normalize { sub, email, provider, groups }
  proxy.ts gates product routes on a *validated* session; SKIP_AUTH=false
```

### Cognito user pool (Terraform, new `qgi-infra/modules/cognito/`)

- `aws_cognito_user_pool`: `username_attributes=["email"]`, `auto_verified_attributes=["email"]`, `password_policy` (min 10, upper/lower/number), `account_recovery_setting`=verified email, `mfa_configuration="OFF"` (OPTIONAL later), email = Cognito default sender for now (~50/day; SES for prod volume — Phase 2).
- `aws_cognito_user_pool_client` (**confidential, server-side** — has a secret; NextAuth Credentials runs server-side): `explicit_auth_flows=["ALLOW_USER_PASSWORD_AUTH","ALLOW_REFRESH_TOKEN_AUTH"]`, `prevent_user_existence_errors="ENABLED"`, token validities set. _(SRP `ALLOW_USER_SRP_AUTH` is more secure but heavier to implement server-side; USER_PASSWORD_AUTH over TLS is the pragmatic choice for a server-side Credentials provider. Revisit for SRP if desired.)_
- `aws_cognito_user_group "pro"` (matches the existing `requireGroup("pro")`).
- **No** Hosted-UI domain, **no** identity pool for Option A.
- Outputs → Vercel/`.env`: `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `COGNITO_ISSUER`.

### Frontend changes

- **Install** `@aws-sdk/client-cognito-identity-provider` (only new dep).
- **`lib/cognito.ts`** (new) — thin server-only wrapper: `signUp`, `confirmSignUp`, `resendCode`, `signIn` (InitiateAuth), `forgotPassword`, `confirmForgotPassword`, with `SECRET_HASH` (HMAC of username+clientId with the client secret). Never imported by client components.
- **`lib/auth-config.ts`** — add: real Google provider (env creds), a **Credentials provider** (calls `lib/cognito.ts signIn`, returns `{ id: sub, email, groups }`), `session.strategy="jwt"`, `jwt`/`session` callbacks to carry `sub`/`email`/`provider`/`groups`, `trustHost`, `AUTH_SECRET`.
- **Auth UI** in a new `app/(auth)/` route group: `login` (Google button + email/password form + links), `signup` (email/password + confirm-code step), `forgot-password` (request + reset-with-code). Server actions for sign-up/confirm/reset (they call `lib/cognito.ts`; email/password sign-in goes through `signIn("credentials", …)`).
- **`app/layout.tsx`** — wrap in `<SessionProvider>`; add sign-in/out + account controls to the nav (a small `AuthMenu` client component using `useSession`).
- **`proxy.ts`** — keep the matcher; replace the name-only cookie check with a real session check (use Auth.js's `auth` wrapper or validate the JWT); keep `SKIP_AUTH` escape hatch but default it **false** locally to exercise the flow. Add `/admin` to the matcher (see `app/admin/layout.tsx` TODO) once auth is on.
- **API gating (the 4 routes)** — Phase 1: gate on **authenticated session** (not `pro`), forwarding the Cognito access token (email/pass users) or the NextAuth session for Google users. Keep `requireGroup("pro")` wired but dormant until Phase 3 (payments). Keep the 3 `SKIP_AUTH` bypasses consistent.

---

## 3. Phased plan (localhost-first)

### Phase 0 — Prerequisites (one-time; owner in **bold**)

1. **Founder — Google OAuth (console only, can't be scripted):** project `extreme-lattice-344211` → OAuth consent screen **External**, app "QG Intelligence", scopes `openid email profile` (non-sensitive → no Google review), add test user `aminalait.de@gmail.com`, **Publish**. → Create **OAuth client ID → Web application**, redirect URIs: `http://localhost:3000/api/auth/callback/google` (+ later `https://qgintelligence.com/...`, `https://qgi-frontend.vercel.app/...`). Copy **Client ID + Secret**.
2. **Cognito staging pool:** I write the `qgi-infra/modules/cognito/` Terraform + wire it into `environments/staging`. **Apply** needs staging AWS creds/CI — either (a) you apply via the normal PR→TF-plan-review→OIDC flow, or (b) for an _immediate_ localhost test, you hand me short-lived staging creds and I create a dev pool (documented, to be replaced by the TF pool). **Decision needed.**
3. **Claude — `AUTH_SECRET`:** `npx auth secret` (or `openssl rand -base64 32`).
4. **Claude — `.env.local`:** add `AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `COGNITO_USER_POOL_ID/CLIENT_ID/CLIENT_SECRET/ISSUER`, `AWS_REGION=eu-central-1`, set `SKIP_AUTH=false`.

### Phase 1 — Build + test on localhost (the bulk; Claude)

Order: `lib/cognito.ts` → `lib/auth-config.ts` (providers + callbacks) → server actions → `app/(auth)/*` UI → `SessionProvider` + `AuthMenu` → `proxy.ts` session check → API route gating. Each step type-checks + unit-tested as it lands. Ends with the manual localhost checklist (§4) green. **Nothing pushed** — you test locally.

### Phase 2 — Prod rollout (after you approve locally)

Terraform the **prod** pool (`444444444444`) + SES for verification emails at volume; add prod redirect URIs to the Google client; set all env in Vercel (prod + preview); flip `SKIP_AUTH=false` in prod; **PR → Sonnet review → merge → deploy**; verify live (sign-up→confirm→login, Google login, gated-route redirect). Note the pre-push hook (`.next` clean) + no-`--no-verify` rules from the last deploy.

### Phase 3 — later / optional

Unify Google into Cognito (Option B) **if** Google users need plan claims; wire `pro` gating to a payment provider; add MFA (OPTIONAL→required for pro); account/settings page.

---

## 4. Testing strategy (well-tested = a real gate, not a checkbox)

- **Unit (vitest, mocked Cognito):** `lib/cognito.ts` (SECRET_HASH computation, error mapping — `UserNotConfirmedException`, `NotAuthorizedException`, `UsernameExistsException` → friendly messages); `auth-config` jwt/session callbacks (groups/email surfaced correctly); `proxy` matcher/redirect logic. Cognito SDK mocked with `aws-sdk-client-mock`.
- **Integration (against a real _staging_ pool):** full **sign-up → confirm-code → sign-in → refresh → forgot-password → reset** happy path + the key failures (wrong password, unconfirmed user, duplicate email, expired/incorrect code). Run behind an env guard so it only runs when staging creds are present (not in the default `npm test`).
- **E2E (Playwright, headless in `qgi-dev`):** localhost flows — email/password sign-up+login, Google button reaches Google's consent (stop at the boundary or use a test account), unauthenticated `/dashboard` → redirect to `/login?callbackUrl=…`, authenticated access, sign-out. Fits the existing `tests/e2e/*` suite; must stay green in the pre-push hook (420 tests today).
- **Manual localhost checklist (before you say "push"):** sign up new email → receive Cognito code → confirm → land signed-in; wrong-password error is friendly; forgot-password round-trip; "Continue with Google" → Google → back signed-in; visit `/trends` signed-out → bounced to `/login` → after login, returned to `/trends`; sign-out clears session; `AuthMenu` shows the right state; no console errors; `SKIP_AUTH=false` actually enforces.
- **Security review:** client secret + AUTH*SECRET server-only (never `NEXT_PUBLIC*`); `lib/cognito.ts`is server-only;`prevent_user_existence_errors`; rate-limit sign-up/confirm/forgot (Cognito has built-ins; add app-level throttling if needed); HTTPS-only cookies in prod; CSRF (NextAuth handles); don't log tokens/passwords; keep the `.env.local` AWS-STS-creds note in mind (rotate/remove).

---

## 5. Decisions I need from you (blockers)

1. **Architecture:** Option A now (native forms, Google direct, Cognito for email/pass — recommended) vs Option B (fully unified in Cognito, Hosted-UI Google). **My rec: A.**
2. **Google OAuth client:** you create it in the GCP console (Phase 0.1) — I'll hand you the exact click-path + redirect URIs. Confirm project `extreme-lattice-344211` is the one to use.
3. **Cognito pool creation for localhost:** (a) proper Terraform applied to staging via CI, or (b) I spin a quick dev pool now with short-lived staging creds so you can test _today_ (then formalize in TF). **My rec: (b) to unblock localhost, then (a).**
4. **Sign-up email:** Cognito default sender (~50/day, fine for local + early access) now; SES for prod at Phase 2 — OK?

Give me 1–4 and I'll start Phase 0/1 on localhost.
