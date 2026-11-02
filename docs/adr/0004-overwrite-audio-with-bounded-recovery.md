# Overwrite Sound audio at existing names with bounded recovery

For G3, replace an existing Sound's MP3 and WebM objects at their current
names, preserving Sound identity and the shared catalog schema. The owner chose
this to let existing saved references resolve to replacement audio without
requiring new catalog fields. Same-name overwrites cannot guarantee immediate
fresh playback because caches may retain old bytes; the owner accepted that
delay and chose to keep existing cache settings.

The two formats cannot be changed atomically. The admin therefore makes
temporary recovery copies, verifies conditional writes and the catalog result,
restores on a recoverable failure, and reports unresolved outcomes. A brief
mixed-format interval is accepted. Temporary copies are removed after the
complete change is verified, so this is not an admin undo mechanism. Rebuilt
player reconciliation is separate work in Turbobard.
