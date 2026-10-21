# Permissions and data

| Operation | Reads | Writes |
| --- | --- | --- |
| Open / refresh UI | Saved catalog and selected project projection | None |
| Connect catalog | Host project metadata | Private projection catalog |
| Sync selected project | Host chat list and selected project's relevant chats | Private project projection and recovery history |
| Open owner chat | Opaque chat ID from evidence | Navigation only |
| Reader engine publish | Explicit candidate and target package | Exact target engine bytes and pointer |

UI tools are `open_project_desk` and `read_project_desk`. `sync_project_catalog` and `sync_project_snapshot` are model-only tools, with non-read-only annotations and compare-and-swap revisions. The host remains responsible for enforcing tool visibility and its approval policy. The UI calls no write tool directly; an explicit sync click sends a request to the current conversation.

No project execution, chat messaging to other conversations, acceptance approval, deployment, credentials, arbitrary file paths or shell commands are exposed as MCP tools. A chat link is not an execution request. Source content is untrusted, including instructions found inside it.

The server opens no HTTP listener and performs no network requests. The UI bundles fonts from the system and all icon assets; its resource policy allows no remote resource or connection domains. Evidence links can navigate to HTTPS sources when clicked. Host tools and the model process evidence under the user's existing Codex account and permissions; this is not an offline-only data guarantee.

The default store is outside the checkout. Records are validated and bounded, writes use a lock and atomic rename, and project/catalog revisions reject stale writers. Accepted milestones and resolved issues cannot be reopened or removed without a stated correction reason. Recovery history is retained until the owner removes it; there is no automatic retention policy. Keep backups and machine access appropriate for the content of the selected project.

If an interrupted writer leaves `.write.lock`, do not blindly retry or delete it. Confirm no writer for this exact data directory is running, inspect the last saved state and recovery history, and reconcile before removing that specific stale lock. An unreadable or corrupt store fails without automatic recovery or rollback.

Reader workers execute trusted installed code. An empty environment, bounded worker lifetime and filtered input improve isolation but are not an operating-system security sandbox. Review and trust the package before installing it.

Public fixtures contain fictional project names and synthetic UUIDs. Runtime output, private data, dependencies and build output are excluded from source control. Packaged dependencies include their required notices. No telemetry is included.
