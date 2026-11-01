# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `bencodrington/turbobard-admin`.
Use the `gh` CLI inside this clone; infer the repository from its Git remote.
Outside the clone, pass `--repo bencodrington/turbobard-admin`.

## Conventions

- Create: `gh issue create --title "..." --body-file <path>`.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels`.
  Add label filters as needed.
- Comment: `gh issue comment <number> --body-file <path>`.
- Apply labels: `gh issue edit <number> --add-label "<label>"`.
- Remove labels: `gh issue edit <number> --remove-label "<label>"`.
- Close: `gh issue close <number> --comment "..."`.

For multiline bodies, write the exact text to a temporary file and use
`--body-file`.

When a skill says "publish to the issue tracker", create a GitHub issue.
When it says "fetch the relevant ticket", read the GitHub issue.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding operations

Use one issue labelled `wayfinder:map` for the map's Notes, Decisions-so-far,
and Fog. Link child tickets using GitHub sub-issues when available.
Otherwise, maintain a task list in the map and put `Part of #<map>` at the
top of each child body.

Label children `wayfinder:<type>`, where type is research, prototype,
grilling, or task. Create missing wayfinder labels when that workflow is used.

Represent blockers with GitHub native issue dependencies when available.
Otherwise, put `Blocked by: #<number>, #<number>` at the top of the child body.
A ticket is unblocked when every blocker is closed.

Choose the first open child in map order with no open blockers or assignee.
Claim it with `gh issue edit <number> --add-assignee @me`.
Resolve it by commenting with the answer, closing it, and adding a brief
finding and issue link to the map's Decisions-so-far.
