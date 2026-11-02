# G1: Safe catalog writes

Status: owner approved the design on 2026-11-02. This approves design records and
implementation tickets only. It does not authorize a production catalog or storage
mutation. See [issue #10](https://github.com/bencodrington/turbobard-admin/issues/10).

## Scope and existing constraints

Each Apply changes one Sound or Pack. Sound metadata edits, Pack creation and
edits, and catalog removal use this design. Audio ingestion and replacement
inherit its preview and Apply rules; their file sequencing and partial-failure
details belong to G2 and G3. Removing a catalog entry preserves stored audio.
Sound removal remains blocked while any Pack references it. The database schema
stays unchanged until legacy-player retirement.

The admin remains owner-only behind Cloudflare Access. All database credentials
stay server-side. Use a separate, narrowly permissioned write identity; the
catalog reader retains read-only access. Enable the write identity only after
code review and explicit owner approval. Every later mutation still requires its
own preview and explicit Apply. Agents must obtain clear owner confirmation
before executing a database change.

## Preview and Apply

For each proposed change, show the exact current and proposed entry, including
unknown fields and ordered tags. Summarize affected Pack references, stored
files, and expected effects in the rebuilt player. Check that the proposed
entry preserves the shared catalog format consumed by both players. No legacy
client changes or broad legacy-player tests are part of G1.

The preview is tied to the current entry version. Apply rejects a stale preview
and requires a new one. Sound removal also rechecks Pack references at Apply;
any current reference blocks removal. Sound and Pack removal require the owner
to type the entry ID before Apply. The preview states that there is no admin
undo and that stored audio remains in place.

If an Apply response is lost or times out, read the authoritative entry back
before allowing another Apply. Show the outcome as confirmed saved, confirmed
unchanged, or unresolved. An unresolved outcome blocks immediate retry until
the entry can be read and reconciled.

## Deliberate limits and production gate

There is no admin-side history or restore workflow. A successfully applied
overwrite or removal may have no admin undo. Search visibility is neither
checked nor shown in the write workflow. Apply confirms the authoritative
catalog write; player search may still serve an old projection or cache.

Code review and explicit owner approval are the production enablement gate.
The owner did not require a staging drill or recovery/search-verification
evidence. The deployed trigger, cache, IAM, and player behavior remain
unverified by R2's source-only research. These limits supersede the earlier G1
requirements for recoverable history, search visibility verification, and a
non-production drill.

## Implementation breakdown

1. Private write API and permissions: separate limited write identity, exact
   entry mutation, conditional version check, authoritative readback after an
   uncertain response, and fail-closed errors.
2. Preview and Apply: exact before/after presentation, affected references and
   files, shared-format check, stale-preview handling, and explicit Apply.
3. Removal safeguards: current Pack-reference recheck, typed-ID confirmation,
   preserved stored files, and no-undo warning.

W1-W3 remain the feature tickets that use these foundations. G2 and G3 must
specify multi-step file publication and recovery behavior before W4/W5 can
mutate storage or publish replacement audio.
