# Install Project Desk

Project Desk is a local desktop plugin. A web-only chat cannot launch its stdio process. It requires a host with MCP Apps UI and Codex project/chat tools; source builds require Node.js 22.18+ and npm.

## Build and register

Clone this repository, enter it, and run:

```sh
npm ci
npm run build
```

The repository includes `.agents/plugins/marketplace.json`, pointing at its root plugin. In a supported Codex CLI, register the built local checkout:

```sh
codex plugin marketplace add .
```

Use the desktop plugin directory to install **Project Desk** from the **Project Desk Local** source. The host may need to reload plugin metadata; do that when convenient. The repository and packaging commands do not restart it. A fresh checkout is source-only: build before registering it. A generated ZIP already contains the runnable `dist/` bundle and can be extracted to a stable local folder and registered the same way.

These are local marketplace instructions, based on [official plugin packaging documentation](https://developers.openai.com/plugins/build/plugins). Publishing source to GitHub does not list the plugin in OpenAI's universal directory.

## Connect a project

1. Open **项目工作台** from a supported global or chat plugin entrypoint.
2. Click **连接项目**. The UI requests catalog sync in the current chat; the bundled skill uses the host's project list.
3. Choose any accessible project from the picker. Click **同步项目** to review that project's chats and create its projection.
4. Follow the current chat's completion. The open UI picks up the saved projection on its next refresh, or click **刷新视图**.
5. Click a milestone, issue or pending acceptance. **打开负责聊天** navigates to its source chat so you can steer it yourself.

If the host cannot send a sync request, copy the prompt displayed by the UI into the current chat. If project or chat tools are unavailable, the skill reports that limitation; it does not scan undocumented local application databases.

## Private data

The default data directory is `~/.local/share/codex-project-desk`. `CODEX_PROJECT_DESK_HOME` can select a different absolute private directory before server startup. For a separate instance, launch `dist/server.mjs --data-dir /absolute/private-directory`. Do not point it inside this checkout or a shared publication directory.

The plugin stores `state.json`, a temporary write lock, and previous projections in `history/`. The old source chats remain authoritative. Keep this directory private; deleting it removes the saved catalog and projections, not the original chats. The plugin does not import another installation's private state automatically.

## Verification boundary

Automated MCP tests and fictional browser evidence are documented in [verification](docs/verification.md). A particular desktop host still needs install, project sync and chat navigation acceptance. The project picker cannot grant access to a project the host cannot read.
