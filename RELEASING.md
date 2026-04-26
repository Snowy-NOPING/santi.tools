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
