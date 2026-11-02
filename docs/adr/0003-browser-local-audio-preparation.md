# Prepare source audio in the owner's browser, subject to a feasibility prototype

For the initial source-audio workflow, keep source files and generated outputs
in browser memory and process them locally, provided a feasibility prototype
confirms that the required formats and desktop workflow are practical. If the
prototype fails, reopen this decision instead of silently moving source files
to a server.

This avoids transmitting original audio to an admin service and avoids server
temporary-file retention. It also keeps the initial admin deployment simple.
The trade-off is that browser processing may be slower or less reliable than
native or hosted FFmpeg, and a page refresh or close loses the draft. The
prototype must verify accepted input formats, MP3 and WebM/Vorbis output,
measurements, resource use, and usable progress/retry behavior before the
workflow is implemented.

This decision covers preparation and audition only. Publishing audio to storage
or adding a Sound to the live catalog remains a separately reviewed workflow
under G1 and W4. Approval of this ADR and its tickets does not authorize a
production mutation.
