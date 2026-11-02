# Turbobard admin design interview

## G3 documentation boundary (2026-11-02)

Keep replacement-publication requirements and implementation work in this admin
repository separate from how the rebuilt player handles saved Environments.
When a behavior requires changes in both repositories, describe the proposed
player changes in a clearly labeled, separate section for the owner to address
in `bencodrington/turbobard`. Do not treat approval of admin design or tickets
as approval to implement or mutate data in either repository.

## G3 approved design (2026-11-02)

The owner approved the [replacement propagation design](admin-replacement-propagation.md)
and its follow-on ticket split. Existing audio names are overwritten with
temporary recovery copies during Apply, followed by verification and removal
of those copies. New One-shot variations get new names; removed variations
leave stored files in place. A separate proposed Turbobard change refreshes
only the opened Environment's audio references and preserves its saved settings
and current playback. HTTP and HTTPS saves refresh independently when opened.

Because the owner accepted cache delay and immediate Play from saved references,
reopen, refresh, and explicit reload offer best-effort delivery rather than an
immediate new-byte guarantee. The unavailable-replacement edge case is outside
this design at the owner's direction. See [ADR-0004](adr/0004-overwrite-audio-with-bounded-recovery.md).
Approval covers design and tickets only; production mutations require separate
impact preview, Apply, and owner confirmation.

## G1 update (2026-11-02)

The owner approved the [safe catalog write design](admin-safe-writes.md).
It supersedes the earlier requirements for recoverable history, search
visibility verification/status, and a non-production drill. Code review and
explicit owner approval gate production writes. A narrow shared-format check
remains for both players; no broad legacy-player impact assessment is required.
No production mutation was authorized by this design approval.

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

### Additional previous-admin source finding (2026-11-01)

The prior dashboard checkout is at
`C:\Users\benve\OneDrive\Documents\Dev\turbo-bard-admin`. Its
`src/routes/AddTrack.svelte` documents manual upload of generated files through
the Cloud Console, followed by `firestore-import` of `tracks.json` with a
service-account key file. `src/routes/+page.server.ts` uses `fluent-ffmpeg` and
`ffmpeg-static` to create MP3 and WebM files in `static/output/`, temporarily
writing the source file to `static/`. The old app does not contain a Firestore
read API or automatic Cloud Storage upload. This is a local preparation/manual
publication reference only; it does not establish a safe hosted pipeline or
deployed behavior. See `docs/integration-feasibility.md` for the R2 implications.

### Deployment preference update (2026-11-02)

Use one Turbobard Admin deployment, without separate staging and production
Workers. Use Cloudflare's free `workers.dev` URL, with no custom domain or DNS
zone. Keep the owner-only Access policy in the Cloudflare Dashboard rather than
recording it in policy files in this repository. Provide a plain-language
dashboard walkthrough in the README. The repository retains one Wrangler file
for the Worker deployment itself.

## G2 update (2026-11-02)

The owner approved the source-audio preparation design in [issue #11](https://github.com/bencodrington/turbobard-admin/issues/11).
This authorizes design records and follow-up tickets only; it does not authorize
production database or storage mutations. The design and conditional processing
decision are recorded in [ADR-0003](adr/0003-browser-local-audio-preparation.md).
The prototype and local draft workflow are tracked by [#27](https://github.com/bencodrington/turbobard-admin/issues/27)
and [#28](https://github.com/bencodrington/turbobard-admin/issues/28); reviewed
publication remains in [W4](https://github.com/bencodrington/turbobard-admin/issues/18).

### Input and draft model

- Accept local WAV, AIFF, FLAC, MP3, and Ogg/Vorbis source audio.
- Prepare one Audio draft at a time. The owner explicitly selects Loop or
  One-shot. A Loop has exactly one source file; a One-shot has one or more
  variations.
- Preserve the order in which files are selected for One-shot variations; do
  not sort by filename.

### Preparation and review

- Generate MP3 at 192 kbps and WebM/Vorbis at quality 6. Preserve mono/stereo
  channel layout and source sample rate where supported; resample only when
  required. WebM is intended for a future rebuilt-player update. G2 does not
  include that player change.
- Measure integrated loudness (LUFS), sample peak (dBFS), and full-scale sample
  count for both source files and prepared outputs. Report measurements without
  normalization or blocking thresholds.
- Warn on leading or trailing silence below −60 dBFS RMS for at least 0.5
  seconds. Do not flag quiet sections inside a file.
- Do not automatically analyze or alter Loop seams; human audition is the
  quality check.
- Show the current processing stage and per-output percentage when reliable;
  otherwise show indeterminate progress. Require both encodings for every
  source. Retain successful outputs, automatically retry each failed encoding
  once, then offer manual retry.
- Keep source files and outputs in browser memory for the open page only.
  Refresh or close discards the Audio draft.
- Before a draft is ready, audition every generated output, including every
  One-shot variation.

### Processing feasibility and publication boundary

Processing must happen in the owner's browser if a feasibility prototype
confirms support for the accepted source formats, both encodings, measurements,
and an acceptable desktop workflow. If that prototype fails, reopen the
execution-location decision; do not silently upload source files to a server.

The previous admin's local FFmpeg workflow generated MP3 and WebM but required
manual Cloud Storage upload and Firestore import. It does not establish a safe
hosted pipeline. [FFmpeg.wasm documents MP3 and Vorbis encoders](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/website/docs/overview.md),
while [its published benchmark](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/website/docs/performance.md)
shows a substantial slowdown versus native FFmpeg on a video conversion; that
benchmark does not establish audio conversion performance for this workflow.
Browser-native WebCodecs does not provide MP3 encoding according to [MDN's codec guide](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection).

This design covers local preparation and audition only. Adding a Sound to the
live catalog and publishing stored files remain in W4, behind G1's reviewed
preview and Apply rules. No production data or storage was changed during this
interview.
