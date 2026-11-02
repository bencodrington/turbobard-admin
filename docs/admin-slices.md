# Approved Turbobard admin slices

G1 was refined on 2026-11-02 in [the safe-write design](admin-safe-writes.md).
Its approved limits supersede the earlier history, search-verification, and
non-production-drill requirements below. The other slice dependencies remain.

Status: approved for ticket conversion on 2026-11-01. Track tickets and dependencies
in the [GitHub map issue](https://github.com/bencodrington/turbobard-admin/issues/1).
Published and verified: 21 native sub-issues and 38 native dependency links.
No implementation or production mutation was performed as part of ticket conversion.
Requirements and source findings are in [the interview record](admin-design.md); terminology is in
[the glossary](../GLOSSARY.md).

## Constraints applying to every slice

- Separate project with one Cloudflare Worker deployment; inherit Turbobard's
  stack, applicable agent instructions, charcoal/blue theme, Alegreya Sans and
  Germania One typography.
- Desktop, single-owner access; credentials stay server-side.
- Keep the Turbobard database schema unchanged until legacy-player retirement.
  Careful, reviewed content corrections remain in scope for both players.
- Agents must identify effects on Turbobard and obtain clear confirmation before
  database changes. Every dashboard database/storage mutation requires an impact
  preview and explicit Apply. Planning/ticket approval is not approval to mutate
  production data.
- Preserve unknown entry fields, Sound identities, and tag order. Keep malformed
  entries visible; one bad record must not hide the catalog.
- Never infer that a file is unused by players merely because the current
  catalog does not reference it. Preserve stored files during catalog removal.
- No Computer Use. Use CLI/API tools and automated Playwright tests/captures.

## First release: read-only catalog administration

These slices need no further product grilling. R2 resolves technical facts, not
product policy; an integration blocker may require revisiting its dependents.
Verification should use representative fixtures without changing production.

| ID | Slice | Kind | Depends on | Reviewable result |
| --- | --- | --- | --- | --- |
| R1 | Private admin foundation | Implement directly | — | Inherited React/TypeScript/Vite foundation, theme/fonts, agent guidance, verification tooling, and one Cloudflare Worker deployment on its free `workers.dev` URL. Set up the owner-only Access policy in the Cloudflare Dashboard; apply Access to UI and API routes. |
| R2 | Read-only integration feasibility | Research | — | Establish supported server runtime/authentication, least-privilege Firestore/storage access, complete enumeration, scan limits, and required playback formats for both players. Compare deployed behavior with local source when authorized access is available; record gaps and a viable API contract. No writes or credential exposure. |
| R3 | Complete catalog browsing | Implement after research | R1, R2 | Private read-only API and UI list all Sounds/Packs, including malformed records. Search name, tags, author, ID, filename; filter by type, exact tags, author, and problems. Show load failures/incompleteness explicitly. |
| R4 | Sound/Pack inspection and audition | Implement directly | R3 | Friendly metadata, full copyable read-only JSON with unknown fields, validation warnings, Sound-to-Pack references, and individual playback including each One-shot variation. Keep failed records inspectable. |
| R5 | Referenced-file health checks | Implement directly | R2, R4 | On-demand catalog-wide existence/metadata checks and per-file playback/decoding. Distinguish unchecked, missing, inaccessible, and decode failures, with check times and incomplete scan state. Do not claim automatic audio correctness. |
| R6 | Duplicate-tag report | Implement directly | R3 | Exact repeated tags within entries and catalog-wide case/whitespace variants; links to affected entries; no automatic fixes or reordering. |
| R7 | Catalog and health statistics | Implement directly | R3, R5, R6 | Loop/One-shot/Pack totals, sample counts, author/tag breakdowns, and data/file problems. Distinguish catalog totals from partial or stale health results. |
| R8 | Storage inventory | Implement directly | R2, R3 | Read-only object inventory linked to current catalog references; identify objects with no catalog reference without calling them safe to delete. No deletion controls. |

R1–R7 complete the agreed first release. R8 is a separate read-only extension and
can follow without waiting for write designs.

## Focused grilling sessions

Each session must end with an agreed design and smaller implementation tickets;
these broad slices are not ready to implement as written.

| ID | Session | Inputs/dependencies | Decisions it must resolve |
| --- | --- | --- | --- |
| G1 | Safe live writes | R2 and integration findings | Before/after preview, affected entries/files/players, explicit Apply, stale-edit detection, recoverable history, partial failures, permissions, and verification of search visibility. Existing triggers/caches and both players must be accounted for without schema changes. Define test/recovery evidence before enabling production writes. |
| G2 | Source-audio preparation and ingestion | R2; publication follows G1 | Input formats and grouping, One-shot variations, target encodings for supported players, loudness/clipping/silence policy, seamless loops, processing execution/location, progress/failure/retry, temporary outputs, and pre-publication audition. Legacy processing tooling was not found, so include research before choosing a pipeline. |
| G3 | Replacement propagation in rebuilt saved scenes | R2, G1; coordinate with G2 | Deliver new audio on reopen/refresh/explicit reload; preserve active playback and saved metadata/settings. Cover Loop replacement, changes to One-shot variations, cache behavior, unavailable replacements, recovery, HTTP/HTTPS saved-state origins, and both players' catalog compatibility. Do not assume new database fields, overwritten paths, or a reconciliation mechanism. Only rebuilt-player propagation is required. |
| G4 | Permanent storage deletion | R8, G1, G3 | Retention, old saved references, evidence required before deletion, confirmation, recovery options, and whether deletion can be allowed while legacy remains active. Catalog-unreferenced alone is insufficient evidence. |
| G5 | Schema evolution after legacy retirement | Explicit retirement prerequisite | Backward compatibility, versioning/migrations, rollout, verification, rollback, and treatment of old browser saves. No schema changes before retirement. Design discussion may happen earlier. |

G1, G2, and G3 are the next substantive design work. G4 and G5 are deferred follow-ups
and do not block read-only administration or carefully designed ordinary edits.

## Writes with established product scope

These workflows need no additional broad feature interview, but implementation
must wait for the relevant safety/processing designs. G1 may split them further.

| ID | Slice | Blocked by | Reviewable result |
| --- | --- | --- | --- |
| W1 | Edit existing Sound metadata | R4, G1 | Structured name, attribution author/URLs, ordered tags and default timing; preserve IDs and unknown fields. Preview and Apply one entry. Link duplicate-tag reports to this editor. |
| W2 | Create/edit Packs | R4, G1 | Name, ordered tags, existing-Sound membership/order, per-member volume/timing and individual auditioning; validate references. Saved user Environments retain their existing membership/settings. |
| W3 | Remove catalog Sounds/Packs | W2, G1 | Reviewed removal with recoverable history. Block Sound deletion while Packs reference it; resolve memberships explicitly. Preserve audio objects. |
| W4 | Add Sounds from source audio | R4, G1, G2 | Local source upload, Loop/One-shot grouping, metadata, preparation, audition and reviewed publication of one Sound at a time. Expose partial failure/recovery as defined by the design. |
| W5 | Replace audio and edit One-shot variations | W1, G2, G3 | Replace a Loop or add/remove/reorder One-shot variations; preserve Sound identity. Rebuilt saved scenes receive updated audio references on reopen/reload while retaining saved metadata/settings. Preserve legacy compatibility and old referenced files as required by the agreed design. |

W1–W3 may proceed after G1 without waiting for source-audio processing or replacement
propagation. W4 and W5 remain blocked until their focused designs are approved.
Recovery/audit storage choices must themselves respect the schema constraint.

## Deferred extensions

No initial implementation scope is assumed for additional admins/roles, phone
administration, a mixer/Environment editor, simultaneous Pack auditioning, bulk
tag/metadata edits, batch publication, Loop/One-shot conversion, raw-JSON writes,
automatic audio-quality analysis, aggregate audio duration, storage costs, usage
analytics, or migration of ordinary metadata corrections into saved scenes.

## Ticket conversion

The owner approved one map issue with ordered research/grilling/task children
and dependency links. R1 and R2 are the entry points; their implementation and
research may proceed independently. Keep blocked writes visibly blocked and
keep schema evolution gated by legacy retirement. Cross-repo changes discovered
by G3 need linked work in Turbobard; this map remains owned by turbobard-admin.

Entry points: [R1: private admin foundation](https://github.com/bencodrington/turbobard-admin/issues/2)
and [R2: read-only integration feasibility](https://github.com/bencodrington/turbobard-admin/issues/3).
All tickets remain unassigned; this session created and verified the queue only.
