# Turbobard Admin

Private, separate administration workspace for the Turbobard sound catalog.
The first release is read-only; this foundation does not connect to production
data.

## Requirements

- Node 26 (`.nvmrc`)
- npm 11 or newer

Read [the Node tooling guidance](docs/agents/node-tooling.md) before running
project commands.

## Local development

```powershell
npm ci
npm run dev
```

`npm run verify` runs formatting, linting, typechecking, unit tests, build, and
Playwright. Playwright uses desktop Chromium by default.

## Cloudflare deployment

Staging and production use separate Workers and Wrangler configurations. Build
and deploy with `npm run deploy:staging` or `npm run deploy:production` after
the corresponding Cloudflare account is configured. Those commands publish a
Worker; they do not configure Cloudflare Access.

Before publishing either environment, create a Cloudflare Access Self-hosted
application for that environment's exact hostname. Protect the full hostname,
including every path, and add an Allow policy for the owner's identity. Leave
unmatched identities denied; use the intended identity provider and domain
session controls. Verify both a page and a future `/api/*` route are denied to
an unauthenticated request and allowed for the owner using automated Playwright
or CLI/API checks. Keep `workers.dev` and preview URLs disabled so they cannot
bypass the Access hostname. No deployment hostname or owner identity is
configured in this repository.

The custom-domain bindings, Access applications, and owner-only Allow policies
are defined as Terraform in `infra/cloudflare/`. Supply the account ID, zone ID,
each exact hostname, and owner email in a private `.tfvars` file, then review
`terraform plan` before applying. Deploy the Workers first so the custom-domain
bindings can attach to existing Worker services. The Terraform stack does not
deploy Workers or configure Google IAM.

Worker secrets and Google credentials must be configured with Cloudflare's
secret mechanism after the integration approach and least-privilege grants are
reviewed. Never put credentials in `VITE_*` variables or client assets. Live
database and storage access is not configured by these files.

The read-only catalog API reads Firestore's `tracks` and `packs` collections
through the Firestore REST API. Configure `GOOGLE_PROJECT_ID`,
`GOOGLE_CLIENT_EMAIL`, and `GOOGLE_PRIVATE_KEY` as Worker-side bindings for each
environment. Store the service-account private key with `wrangler secret put`
and grant that account only Firestore entity get/list access. The Worker uses
the Firestore `datastore` OAuth scope; IAM still limits what the account can
read. No credentials belong in the static assets or browser configuration.
`GET /api/health` reports whether the bindings exist, without returning their
values. `GET /api/catalog?collection=tracks|packs` returns at most 250
documents per page, raw Firestore fields, decoded fields, per-record validation
warnings, and an opaque continuation token. The browser continues via a
“Load more” action, and failed or partial collections remain visible as such.

The API is read-only and uses Firestore's authoritative documents rather than
the legacy search projection. It does not read Storage or change the Turbobard
schema. A missing Worker binding or insufficient IAM grant is reported as an
integration error; live access still requires owner-only Access policy and
approved Google IAM configuration.

## Project records

- [Domain glossary](GLOSSARY.md)
- [Approved scope](docs/admin-design.md)
- [Slice plan](docs/admin-slices.md)
- [R2 integration feasibility](docs/integration-feasibility.md)
- [Schema-freeze decision](docs/adr/0001-preserve-shared-schema-until-legacy-retirement.md)
