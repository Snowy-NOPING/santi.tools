# santi.tools

a cobalt-powered media downloader for windows, built with tauri.

## features

- download videos and audio from youtube, tiktok, twitter, instagram, and [many more](https://github.com/imputnet/cobalt)
- yt-dlp fallback for youtube when cobalt is rate-limited
- image host via [nest.rip](https://nest.rip) — upload and share files instantly
- file compressor — compress video, audio, and images locally
- download history — per-user log of everything you've saved
- notes — local note editor, stored per user
- google oauth login + local accounts
- custom profile with avatar upload
- dark purple theme

## install

grab the latest `.exe` from [releases](https://github.com/Snowy-NOPING/santi.tools/releases) and run it. no admin rights needed.

## building from source

**requirements:** [bun](https://bun.sh), [rust](https://rustup.rs), windows 10+

<<<<<<< HEAD
> [!TIP]
> **antivirus flags**
> windows might flag the `.exe` because it's not signed with an expensive certificate. just click "run anyway", it’s open source.

=======
>>>>>>> fedfdf2 (chore: release v1.3.0)
```powershell
git clone https://github.com/Snowy-NOPING/santi.tools
cd santi.tools/cobalt-app

# download yt-dlp sidecar
New-Item -ItemType Directory -Force src-tauri/bin
Invoke-WebRequest https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe `
  -OutFile src-tauri/bin/yt-dlp-x86_64-pc-windows-msvc.exe

bun install
bun tauri dev
```

## releasing

```powershell
.\release.ps1 1.0.0
```

see [RELEASING.md](RELEASING.md) for details.

## credits

- [cobalt](https://github.com/imputnet/cobalt) — media downloading backend
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — youtube fallback
- [nest.rip](https://nest.rip) — file hosting api
- [tauri](https://tauri.app) — app framework
