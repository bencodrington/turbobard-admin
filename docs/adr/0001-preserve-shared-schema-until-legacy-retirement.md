# Preserve the shared database schema until the legacy player is retired

Both the legacy player and rebuilt Turbobard consume the live catalog. Keep its
database schema unchanged until the legacy player is retired, allowing carefully
reviewed corrections to existing entries rather than freezing catalog content.
This postpones schema improvements to protect active users; every write design,
including rebuilt saved-scene audio replacement, must fit the existing schema
and preserve compatibility with both catalog consumers.
