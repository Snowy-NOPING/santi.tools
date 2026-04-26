# releasing santi.tools

## the easy way — use the release script

from inside the `cobalt-app` folder:

```powershell
.\release.ps1 0.2.0
```

or just run it with no args and it'll prompt you:

```powershell
.\release.ps1
```

the script will:
1. check git status and warn you about uncommitted changes
2. parse `CHANGELOG.md` and pull the notes for your version
3. bump the version in `tauri.conf.json` and `Cargo.toml`
4. commit, tag, and push to GitHub
5. create a draft GitHub release with the changelog (if `gh` CLI is installed)
6. GitHub Actions builds the `.exe` and attaches it to the release automatically

---

## changelog format

add a section to `CHANGELOG.md` before releasing — the script picks it up automatically:

```markdown
## [0.2.0] - 2025-05-01

### Added
- some new feature

### Fixed
- some bug
```

---

## prerequisites

- `git` in PATH
- `bun` in PATH
- `gh` CLI (optional but recommended) — https://cli.github.com
  - run `gh auth login` once to authenticate

---

## what github actions produces

| file | description |
|------|-------------|
| `santi.tools-X.X.X-setup.exe` | custom animated installer (recommended) |
| `santi.tools_X.X.X_x64-setup.exe` | raw tauri NSIS installer |
| `santi.tools_X.X.X_x64_en-US.msi` | MSI package |

---

## code signing (optional)

add these secrets to your repo settings → Secrets → Actions:

| secret | description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | private key (base64) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | key password |

generate a key:
```powershell
bun tauri signer generate -w ~/.tauri/santi-tools.key
```

---

## nest.rip OAuth setup

your OAuth app is already registered at nest.rip with client ID `a8b00d4a-652c-4301-a7d6-3764be0d9e2e`.

the redirect URI `santi-tools://auth/callback` must be added in the nest.rip app settings.

**add this secret to your GitHub repo** (Settings → Secrets → Actions → New repository secret):

| secret | value |
|--------|-------|
| `NEST_CLIENT_SECRET` | the client secret from your nest.rip app (`hDsRyASZdF1JaX4hYHR2FjG1pP5NClIM`) |

the client secret is baked into the Rust binary at build time via `env!("NEST_CLIENT_SECRET")` — it never touches the frontend JS.

to enable the deep link so the OS routes `santi-tools://auth/callback` back into the app, add this to `tauri.conf.json` under `"app"`:

```json
"deepLinkProtocols": ["santi-tools"]
```

and add `tauri-plugin-deep-link` to `Cargo.toml`:

```toml
tauri-plugin-deep-link = "2"
```

then register it in `lib.rs`:

```rust
.plugin(tauri_plugin_deep_link::init())
```
