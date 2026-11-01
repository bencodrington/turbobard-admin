# Read-only integration feasibility (R2)

Status: source and documentation research complete on 2026-11-01. No deployed
Firebase project or Cloudflare account was accessed. The deployed collection
contents, object inventory, IAM grants, current search behavior, and actual
runtime compatibility remain unverified.

## Previous admin checkout

The previous dashboard source is at
`C:\Users\benve\OneDrive\Documents\Dev\turbo-bard-admin`. It is a SvelteKit
project, separate from this React/Vite rebuild. Its source does not contain a
Firestore read client or API. `src/routes/AddTrack.svelte` builds a Sound JSON
entry and tells the operator to upload generated files manually through the
Google Cloud Console, then run `firestore-import` against `tracks.json` using a
service-account key file. The code provides no evidence that key file is in the
repository or that this import is suitable for dashboard runtime access.

`src/routes/+page.server.ts` accepts a local audio upload and uses `fluent-ffmpeg`
with `ffmpeg-static` to produce MP3 and WebM files under `static/output/`; it
temporarily writes the input under `static/` and removes it after both format
conversions succeed. The `AddTrack` instructions then require a separate manual
Cloud Storage upload and Firestore import. This confirms a prior local
preparation workflow, but not a safe hosted ingestion flow, automatic storage
upload, read-only access design, or deployed behavior. Treat the static-folder
write approach as a historical reference only.

## Findings

### Runtime and authentication

The selected deployment is Cloudflare Workers with static assets. The existing
Turbobard deploys are static-only; their Access protection is an authentication
pattern, not a backend. Workers use web-standard APIs and document a subset of
Node APIs. This makes a small `fetch`-based API viable, but does not establish
compatibility of Firebase Admin SDK or Google client libraries. Use Google REST
APIs with a server-side service-account credential and Web Crypto token exchange
after a compatibility spike; keep the private key in a Worker secret and never
in `VITE_*`, static assets, logs, or API responses. If that spike fails, move
the API to a supported Google runtime (such as Cloud Run) and retain Cloudflare
Access in front of it.

Cloudflare Access should protect the exact staging and production admin
hostnames, with one allow policy for the owner's identity and default-deny
behavior. Apply the policy to each entire hostname (no path restriction), so
`/api/*` and static pages share the same gate. Keep Workers dev and preview URLs
disabled. No host, identity provider, owner email, or account identifier was
available to configure or verify here.

### Least privilege

For Firestore reads, prefer a project custom role with only
`datastore.entities.get` and `datastore.entities.list`, bound to the service
account. `roles/datastore.viewer` is a simpler fallback if a custom role is not
available; it includes the entity read permissions but also database metadata
and backup visibility. For object inspection, prefer a bucket-scoped custom role
with only `storage.objects.get` and `storage.objects.list`; the built-in
`roles/storage.objectViewer` is a fallback and can also view folder and bucket
metadata. Neither choice should permit object or document writes. Avoid broad
Editor, Owner, Storage Admin, or Firebase Admin roles. Confirm whether legacy
ACLs or bucket policy create a separate access path before assuming IAM is
sufficient.

### Enumeration, pagination, and scan limits

The current rebuilt client uses `search_v3` plus per-ID fetch calls; this is
query-driven and cannot enumerate the complete catalog. The source describes
Firestore collections `tracks` and `packs`. Firestore `documents.list` supports
listing collection documents and `pageToken`; the API may return fewer than the
requested `pageSize`, so continue until no `nextPageToken` remains. Cloud
Storage `objects.list` returns a `nextPageToken` and recommends at most 1,000
entries per page. Stop on missing continuation tokens and surface API errors as
an incomplete scan, never as an empty catalog.

Firestore's `documents.list` reference does not declare a maximum page size.
Start with a conservative request size of 250 documents and honor the actual
response size. For Storage, request no more than the documented recommended
1,000 objects per page. Do not scan an unbounded collection in one Worker
invocation: return one page at a time, pass cursors opaquely, and persist no scan
data in the legacy database. A future total scan cap should be configurable and
reported as `complete: false` with a resume cursor. Worker CPU/subrequest
ceilings vary by plan and can terminate work; actual account limits and catalog
size were not available, so a safe total scan cap cannot yet be asserted. The
source-only findings also do not establish that every deployed record follows
the expected shape.

### Data and playback behavior

The legacy source stores Loop `fileName` and One-shot `samples`, with attribution,
tags, and interval fields; Packs refer to Sound IDs with member volume/timing.
The rebuilt catalog constructs `.mp3` object URLs. The legacy client selects
WebM/Vorbis when the browser supports it and otherwise falls back to MP3. Keep
both formats available to playback checks where present. The contract must keep
raw Firestore fields and document IDs intact so unknown and malformed records
remain inspectable.

The legacy app's source documents search projections regenerated by Firestore
triggers and warm search functions that cache results without visible
invalidation. Reads of authoritative `tracks`/`packs` documents therefore need
not match search projection visibility at every instant. No deployed parity or
cache behavior has been verified.

## Proposed private API contract

- `GET /api/health`: returns only service and integration readiness; never
  credential details.
- `GET /api/catalog?collection=tracks|packs&pageToken=...`: one bounded page of
  raw entries, preserving document ID, fields, and per-record parse warnings.
  Response: `{ items, nextPageToken, complete, scannedAt }`.
- `GET /api/storage?prefix=...&pageToken=...`: metadata-only object page for
  future inventory and file checks. It must not imply an unreferenced object is
  unused or permit mutations.
- Use same-origin requests, `Cache-Control: no-store` for authenticated API
  responses, and no CORS allowlist. Require Cloudflare Access on every route.
- Pass Firestore and Storage continuation tokens opaquely; bind cursor state to
  the requested collection/prefix and reject mismatched or invalid tokens.
- Return explicit `complete: false` and a resume token on a deliberate scan cap;
  distinguish permission, timeout, and malformed-response failures from empty
  data. Bound page sizes and request timeouts.

Representative fixtures for the next implementation slice should include a
valid Loop, valid One-shot with multiple samples, Pack with member settings,
unknown extra fields, missing required fields, wrong-typed tags/samples, and an
unresolvable Pack member. Keep malformed rows inspectable and attach warnings.

## Source references

- Local Turbobard source: `../turbobard/src/legacy/catalog.ts`,
  `../turbobard/src/audio/browser.ts`, `../turbobard/package.json`,
  `../turbobard/wrangler.production.jsonc`,
  `../turbobard/wrangler.staging.jsonc`.
- Previous admin source: `C:\Users\benve\OneDrive\Documents\Dev\turbo-bard-admin\src\routes\AddTrack.svelte`,
  `C:\Users\benve\OneDrive\Documents\Dev\turbo-bard-admin\src\routes\+page.server.ts`.
- [Cloudflare Workers runtime APIs](https://developers.cloudflare.com/workers/runtime-apis/)
- [Cloudflare Workers Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Access self-hosted apps](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- Cloudflare Access Terraform applications and policies: `infra/cloudflare/access.tf`.
- [Firebase Admin SDK setup and supported Node versions](https://firebase.google.com/docs/admin/setup)
- [Firestore documents.list REST reference](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/list)
- [Firestore IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/firestore)
- [Cloud Storage objects.list REST reference](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/list)
- [Cloud Storage IAM roles](https://docs.cloud.google.com/storage/docs/access-control/iam-roles)
