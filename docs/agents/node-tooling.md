# Node tooling

The repository's required Node version is the single source of truth in
`.nvmrc`. Use that version before running `npm`, `npx`, or project scripts.

On Windows with nvm-windows:

```powershell
nvm use (Get-Content .nvmrc).Trim()
```

If the runtime manager is unavailable, prepend an installed matching Node
directory to the current process `PATH`. Keep that change process-local and do
not hard-code a user-specific installation path in the repository.

The Node major version must satisfy `.nvmrc`; npm 11 or newer is required by
`package.json`.
