# G3: Replacement propagation design

Status: owner approved the design and ticket conversion on 2026-11-02 for
[issue #12](https://github.com/bencodrington/turbobard-admin/issues/12).
This approves design records and follow-on tickets only. It does not authorize
implementation or any production database or storage change.

## Admin repository: replacement publication

- Replace existing audio at its current storage name. Do not add a database
  schema field or change the Sound identity for replacement propagation.
- Prepare both MP3 and WebM/Vorbis as required by G2. A short interval in which
  the two formats contain different revisions is acceptable during publication.
- Keep recoverable copies of the old objects for the overwrite operation,
  verify each write, and attempt restoration if a later step fails. If
  restoration fails, report the result as unresolved and block another Apply.
- After the entire storage and catalog change is verified, remove the temporary
  recovery copies. They do not provide a later admin undo.
- Replacing one existing One-shot variation overwrites that variation's MP3 and
  WebM pair. An added variation gets a new name; removing a variation removes
  its catalog reference but preserves its stored files. Reordering variations
  changes only their catalog order.
- Keep MP3 and WebM under matching base names and preserve the existing catalog
  fields so both catalog consumers can read the edited Sound. No legacy-player
  refresh mechanism is part of G3.
- Show the storage and catalog effects in G1's impact preview and require
  explicit Apply. Design or ticket approval does not authorize a live write.
- Same-name overwrites may remain cached after a successful write. The owner
  accepts possible delay before a player receives the replacement, so reopen,
  refresh, or explicit reload cannot guarantee immediate new bytes. Preserve
  existing Cache-Control settings; do not change them as part of replacement.

For a replacement that changes the catalog's variation list, the proposed
sequence is: validate prepared MP3/WebM pairs, show the preview, take temporary
copies of objects being overwritten, Apply conditional storage writes, verify
their objects, conditionally update and read back the single Sound entry, then
remove the temporary copies. New variation objects must be uploaded before the
catalog references them. If an upload fails, restore overwritten objects. If
the catalog write fails or its response is uncertain, first read back the
authoritative entry under G1's rule, then restore the old entry and objects
only when the observed state makes that safe. An unresolved result blocks
another Apply and requires manual investigation.
After the catalog readback succeeds, failure to remove a temporary copy is a
cleanup problem to report and retry; it does not reverse the published Sound.
The brief mixed-format window is an accepted consequence of overwriting names.

## Proposed player changes — address in `bencodrington/turbobard`

The rebuilt player currently loads saved audio references from browser storage
without consulting the catalog. It needs a separate change to refresh the
opened Environment's saved audio references by stable Sound ID on open or
explicit reload while preserving saved metadata, volume, timing, placement,
and membership. Other saved Environments refresh when opened; page refresh
alone does not scan all saves. Saved One-shots adopt the catalog's current
variation list and order. Opening the Environment and Play remain available
while this check runs, so a quick Play may use the old saved references for
that playback session. An explicit reload during playback updates saved
references but keeps all current playback, including future scheduled
One-shots, on the existing references until playback is stopped and restarted.
Ordinary metadata changes remain local to saved Environments.

HTTP and HTTPS use separate browser saves, although both read the same catalog
and audio storage. Refresh an opened Environment's saves on either origin; do
not transfer saves between origins. A public generation lookup endpoint is out
of scope; the owner accepts cache delay from same-name overwrites.

The owner excluded the behavior of an unavailable replacement from this G3
product design.

## Approved follow-on ticket split

Keep [W5](https://github.com/bencodrington/turbobard-admin/issues/19) as the
admin coordination issue and split it into the following reviewable tickets:

1. [Admin storage publication foundation](https://github.com/bencodrington/turbobard-admin/issues/31),
   blocked by G1 preview/Apply (#24) and G2's prepared Audio draft (#28):
   conditional MP3/WebM writes, temporary old
   copies, verification, safe readback/restore, cleanup, and unresolved-state
   reporting. Exercise partial failures with fixtures and automated tests.
2. [Admin Loop replacement](https://github.com/bencodrington/turbobard-admin/issues/32),
   blocked by the storage foundation and Sound editor (#15): select one prepared
   Loop, preview its effects on both catalog
   consumers, then Apply a same-name replacement without changing Sound ID or
   schema.
3. [Admin One-shot variation editing](https://github.com/bencodrington/turbobard-admin/issues/33),
   blocked by the storage foundation and Sound editor (#15): add, replace,
   remove, and reorder variations under the
   agreed file rules; preview and Apply the one-Sound catalog change.
4. [Turbobard player proposal](https://github.com/bencodrington/turbobard/issues/71)
   for the owner to address:
   refresh only the opened Environment's audio references by Sound ID, preserve
   saved non-audio data and active playback, and exercise both browser-save
   origins. This issue and implementation are separate from admin publication.

## Evidence and limits

- Rebuilt saved Sound snapshots store audio references and are loaded without a
  catalog lookup (`../turbobard/src/persistence/environments.ts`,
  `../turbobard/src/workspace/environmentWorkspace.ts`).
- The catalog adapter builds MP3 URLs from the legacy `fileName` or `samples`
  fields (`../turbobard/src/legacy/catalog.ts`).
- Legacy playback selects MP3 or WebM/Vorbis from the same base name
  (`turbo-bard/src/utils/audioFileUtil.ts` in the legacy checkout).
- Turbobard ADR-0005 preserves the separate HTTP and HTTPS save origins.
- Cloud Storage can serve cached old content after an overwrite until its cache
  lifetime expires: https://docs.cloud.google.com/storage/docs/consistency.

No production endpoints or data were changed during this interview.
