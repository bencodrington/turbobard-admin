# Limit admin write recovery and search verification

The owner chose a narrower live-write workflow after reviewing the trade-off:
the admin will keep no entry history or restore action and will not check or
display search visibility after Apply. This avoids building recovery storage and
search monitoring for the initial single-entry workflows, but a committed
overwrite or removal may have no admin undo, and a saved entry may remain
undiscoverable through a stale projection or cache without an admin warning.
Code review and explicit owner approval gate production writes; each write still
requires a preview and Apply. The shared catalog format and schema freeze remain
in force until legacy-player retirement.
