# Reader engine updates

Project Desk separates the stable MCP broker, UI and persistence contract from a pure projection engine. Each read verifies the active engine's hash and starts a fresh worker with only the catalog metadata and selected project's validated projection. This avoids module-cache staleness while preserving the stdio connection.

A full UI, tool, schema, skill or permission change requires a full plugin update. This redesign is such a change. Reader-only updates apply to an already compatible installation; they do not update a previously loaded UI.

Build a candidate with a new `ENGINE_VERSION`, then inspect both release manifests. To publish explicitly to a selected local installation:

```sh
node scripts/engine-release.mjs --candidate /absolute/candidate --target /absolute/installed --expect CURRENT_ENGINE_SHA256
```

The command checks the current digest and fixed core hashes, saves the prior pointer, writes immutable content-addressed engine bytes, then atomically swaps the pointer. A changed core requires a full update. No network updater or MCP publishing tool exists. Installation paths must come from the user or inspected installation metadata.

An in-flight worker keeps the bytes verified at its start. The next read sees the new pointer. Invalid hashes, ABI mismatches, scope mismatches and timeouts fail without falling back. The UI keeps its prior snapshot with a read error. Rollback is an explicit publish of a compatible prior package with the currently active hash; it never rolls back the private project store.

The tests exercise a live stdio connection through update, invalid-pointer failure, recovery and rollback, and verify that the private projection stays unchanged.
