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
session controls. Verify both a page and a future `/api/*` route are denied in
a private browser session and allowed for the owner. Keep `workers.dev` and
preview URLs disabled so they cannot bypass the Access hostname. No deployment
hostname or owner identity is configured in this repository.

The Access applications and owner-only Allow policies are defined as Terraform
in `infra/cloudflare/`. Supply the account ID, each exact hostname, and owner
email in a private `.tfvars` file, then review `terraform plan` before applying.
The Terraform stack does not deploy Workers or configure Google IAM.

Worker secrets and Google credentials must be configured with Cloudflare's
secret mechanism after R2's integration spike and least-privilege grants are
approved. Never put credentials in `VITE_*` variables or client assets. Live
database and storage access is not configured by these files.

## Project records

- [Domain glossary](GLOSSARY.md)
- [Approved scope](docs/admin-design.md)
- [Slice plan](docs/admin-slices.md)
- [R2 integration feasibility](docs/integration-feasibility.md)
- [Schema-freeze decision](docs/adr/0001-preserve-shared-schema-until-legacy-retirement.md)
