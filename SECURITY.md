# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | yes |
| < 1.0 | no |

## Reporting a vulnerability

**Do not open a public issue for exploitable vulnerabilities.**

Report privately through [GitHub's private vulnerability reporting](https://github.com/PotenFYR-Studios/discord-botlists/security/advisories/new) on this repository.

Include what you can:

- Affected package version (`@potenfyrstudios/discord-botlists`) and runtime (Node/Bun)
- A minimal proof of concept or reproduction steps
- Impact assessment (what an attacker could do)
- Any suggested fix (optional)

You will get an acknowledgment within 72 hours, followed by status updates as the fix progresses. We credit reporters in the release notes by default; tell us if you prefer to stay anonymous.

## Scope

**In scope:**

- The library: `src/` as published to npm (stats posting, parser, status checker)
- The webhook server (`src/webhooks/server.ts`): authentication bypass, vote forgery, signature verification bypass, rate-limit evasion, denial of service via request handling
- Token handling (leakage in logs, errors, or unexpected destinations)

**Out of scope:**

- The botlists themselves and their APIs (report to the respective list)
- Weaknesses that require the operator to disable the secure defaults (`security.requireSecret = false`, empty allowlists, etc.)
- The documentation site (static content, no backend)
- Vulnerabilities in applications *using* the library (e.g. an app that ignores webhook auth events)

## Built-in defenses

The webhook server ships secure by default; these are documented behavior, not security claims to test around:

- Refuses to start without a configured secret (`security.requireSecret`, default `true`)
- Shared or per-list secrets; per-list HMAC-SHA256 payload signature verification (`x-signature-256` / `x-hub-signature-256` / `x-signature`)
- Per-IP rate limiting (default 30 req/min) with `Retry-After`
- Brute-force lockout: 10 consecutive auth failures bans the IP for 15 minutes
- 512 KB request body limit
- Optional list allowlist (`security.allowedLists`)

## Data handling

The SDK stores tokens only in memory for the process lifetime and sends them only to the endpoints configured in the registry (or your custom list records). It never transmits them anywhere else and does not log them. Status probes perform anonymous HEAD/GET requests to list homepages with a browser user agent, so no bot data is included.
