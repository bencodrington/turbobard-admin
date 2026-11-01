# Turbobard admin design interview

Status: initial interview and slice map approved for ticket conversion on
2026-11-01. Track work in the [GitHub map issue](https://github.com/bencodrington/turbobard-admin/issues/1).
No implementation or production mutation was performed as part of ticket
conversion. See [the slice map](admin-slices.md).

## Confirmed requirements

- Maintain a separate project and hosting for Turbobard administration.
- Inherit Turbobard's technology stack, applicable agent guidance, general theme,
  and typography. Turbobard's source is in `../turbobard`.
- Manage the existing database and its storage objects. Consult the legacy
  application for existing data, search, update, and audio-processing behavior.
- Browse, search, and filter Sounds and Packs; check associated files.
- Add Loops, One-shots, and Packs.
- Edit Sound metadata, including tag order, and replace Sound files.
- Edit and remove Sounds and Packs.
- Show aggregate Sound and Pack statistics, flag duplicate tags, and support
  inspection of database entry shapes.
- Protect active Turbobard users. Agents must explicitly call out changes that
  affect Turbobard and obtain clear confirmation before database changes.
- Discuss stronger schema-evolution safeguards as a distinct design topic.

## Interview process

Resolve workflows and key features first, then divide work into slices. Identify
which slices need their own design interviews and which can be implemented
directly. Create GitHub tickets only after the user approves the proposed work.

## Settled interview decisions

### Round 1

- Initially, only the owner uses the dashboard, behind authenticated access.
  Roles and invitations are deferred.
- The first useful release is read-only: catalog browsing/search, raw-entry
  inspection, audio auditioning, and file checks. Writes follow later.
- Every dashboard database or storage change requires an impact preview and
  an explicit Apply action. Agents additionally require the owner's clear
  confirmation before executing database changes.
- Initially target desktop browsers and catalog administration. A full mixer
  and Environment editor are outside this version's scope.

### Round 2

- Browse all Sounds and Packs without a query. Keep malformed entries visible
  with warnings. Search name, tags, author, ID, and filename; filter by type,
  exact tags, author, and detected problems.
- Run catalog-wide existence/metadata checks on demand; audition/decode files
  individually. Distinguish unchecked, missing, inaccessible, and decode failures,
  with check times. Human audition assesses whether the audio is correct.
  Automatic silence, clipping, and loop-seam analysis is deferred.
- Show friendly metadata and complete, formatted, copyable read-only JSON,
  including unknown fields, warnings, and Sound-to-Pack references.
- Flag exact repeated tags within an entry and case/whitespace variants across
  the catalog. Preserve order and apply no automatic fixes. Reusing a tag on
  different entries is normal.
- Initial statistics: Sounds split by type, Packs, One-shot sample counts,
  tag/author breakdowns, and detected data/file problems. Distinguish database
  totals from incomplete or old checks. Usage analytics, storage costs, and
  aggregate audio duration are deferred.
- Removing catalog entries preserves audio files by default. Block deleting
  Sounds referenced by Packs until memberships are explicitly resolved.
  Stored-file deletion is a separate workflow; absence of catalog references
  cannot establish absence of references in users' saved Environments.

### Round 3

- Ingestion should accept local source audio, group files into One-shot
  variations or separate Loops, collect metadata, and support auditioning the
  prepared result before reviewed publication. Audio processing needs its own
  grilling session.
- Audio replacements MUST reach existing saved Environments in the rebuilt
  player as well as new catalog additions. The proposal to leave rebuilt saved
  Environments on old audio was rejected. This requirement does not authorize
  overwriting live files.
- Structured Sound editors cover name, attribution author/URLs, ordered tags,
  and One-shot variations/default timing. Variations can be added, removed, and
  reordered. Preserve unknown fields and keep Sound IDs stable. Loop/One-shot
  conversion and arbitrary raw-JSON writes are deferred.
- Pack editing uses existing catalog Sounds and covers name, ordered tags,
  member addition/removal/order, member volume, and One-shot timing. Validate
  references and support individual auditioning. Simultaneous Pack preview is
  deferred.
- Initial writes affect one Sound or Pack at a time. Bulk tag cleanup, bulk
  metadata editing, and batch publication are deferred. Tag reports link to
  individual editors.
- Plan a separate storage inventory, identifying objects with no current catalog
  references without claiming they are unused by players. Permanent deletion
  needs its own safety design.
- Before enabling writes, hold a focused safety session covering previews,
  affected Packs/files, stale edits, recoverable history, partial failures, and
  verification of visibility through Turbobard search. Schema evolution remains
  an explicit follow-up design topic.

### Round 4

- Rebuilt saved Environments adopt replacements on reopen/refresh or explicit
  reload. Preserve currently playing audio; do not force an immediate switch.
- Ordinary metadata/default/Pack-membership edits affect future catalog
  additions. Preserve metadata, settings, and membership already saved in users'
  Environments. Audio replacement is the explicit exception. Propagating metadata
  corrections would require a separate migration workflow.
- Replacement propagation targets the rebuilt player only. No legacy-player
  update mechanism is required. Rebuilt replacement/reconciliation still needs
  focused design within the constraints confirmed in Round 5.

### Round 5

- Use a separate Cloudflare admin deployment restricted to the owner through
  Access. Keep database/storage credentials exclusively in a server-side API.
  Investigate runtime compatibility and read-only permissions before integration.
  Audio-processing execution remains part of its focused design session.
- Do not change the Turbobard database schema until the legacy player is retired.
  The owner may carefully correct existing live entries used by both players.
  Schema freeze does not imply a freeze on catalog content.
- Replacement and write-safety designs must obey this schema freeze and preserve
  compatibility with both catalog consumers. No replacement-propagation changes
  to the legacy client are planned. No particular overwrite, redirect, versioning,
  or reconciliation mechanism has been approved.

## Branches assigned to follow-up slices

- Live-write previews, recovery, stale edits, partial failures, search visibility,
  and shared-player compatibility.
- Audio preparation, processing execution, validation, and publication.
- Rebuilt saved-Environment replacement propagation within the schema freeze.
- Permanent stored-file deletion, recovery/retention, and legacy references.
- Schema evolution after legacy-player retirement.

These are intentionally separate design sessions, not assumed implementation
details. The read-only release does not depend on resolving them.

## Evidence

- Turbobard uses React, TypeScript, and Vite, with Vitest/Testing Library and
  Playwright verification (`../turbobard/package.json`, ADR-0001).
- Its domain glossary uses **Sound**, avoiding the legacy term **Track**, and
  defines Loops, One-shots, Packs, and user-created Environments
  (`../turbobard/GLOSSARY.md`). Admin-specific definitions remain to be resolved.
- Its current frontend uses the legacy Firebase API and streams existing audio;
  its README requires secrets to stay outside browser-exposed configuration.
- Theme: charcoal surfaces and blue/cyan accents, Alegreya Sans body text and
  Germania One display text (`../turbobard/src/styles.css`).
- Legacy checkout: `C:/Users/benve/OneDrive/Documents/Dev/turbo-bard`, branch
  `redesign-may-2024`. Findings below describe checked-out source, not verified
  deployed behavior or current production data.
- Legacy Firestore collections are `tracks` and `packs`. Sounds have ordered
  tags, attribution, and either a Loop filename or One-shot samples. Pack members
  reference Sound IDs and carry volume/timing settings (legacy
  `src/models/DatabaseTypes.ts`, `src/models/Track.ts`).
- Legacy audio selects WebM/Vorbis or MP3; the rebuild catalog constructs MP3
  URLs (legacy `src/utils/audioFileUtil.ts`, rebuild `src/legacy/catalog.ts`).
- Legacy Firestore triggers regenerate collection search projections; warm
  search functions cache them without visible invalidation. A successful write
  does not establish immediate search visibility (legacy `functions/src/index.ts`).
- Saved Environments retain audio references. Replacing/deleting stored files
  can change/break existing playback. Removing a Sound referenced by a Pack can
  fail catalog search because the rebuild resolves all members eagerly
  (rebuild `src/legacy/catalog.ts`, `src/domain/catalog.ts`,
  `src/persistence/environments.ts`).
- No audio conversion/upload pipeline was found. Legacy `database/process.js`
  transforms metadata only; its documented whole-collection replacement process
  is not an established safe dashboard update strategy. Audio preparation remains
  an unresolved research branch.
- Neither checked-out player refreshes populated saved audio references on
  startup. Legacy metadata fetching is limited to unloaded Sounds
  (`src/hooks/useTrackMetadata.ts`); the rebuild loads saved snapshots directly
  (`src/workspace/environmentWorkspace.ts`, `src/persistence/environments.ts`).
  A new-filename replacement strategy that updates saved scenes therefore needs
  player changes. Same-path overwrites have uncertain delivery timing because
  loaded audio and network caches can retain earlier content.
- Admin cannot directly rewrite browser saves belonging to Turbobard's origins.
  Turbobard ADR-0005 preserves independent HTTP/HTTPS saves, so any client-side
  migration must account for those origins.
- Turbobard's Cloudflare deployments are static-assets-only and protected with
  Cloudflare Access. They provide a hosting/auth pattern, not an existing admin
  API. Server-side database/storage access and audio-processing runtime support
  require investigation; no runtime/SDK compatibility has been established.

No production endpoints were accessed and no database or storage was changed
during this investigation.
