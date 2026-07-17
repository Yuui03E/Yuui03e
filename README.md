# Yuui — Next-Generation Anime Library Manager

A local-first desktop anime library manager built with Tauri 2, React 19, and Rust. Automatically scans your video files, identifies series via AniList and AniDB, and provides rich metadata, library analysis, and in-app playback.

## Screenshots

| Home                          | Library                             | Discover                              |
| ----------------------------- | ----------------------------------- | ------------------------------------- |
| ![Home](screenshots/home.png) | ![Library](screenshots/library.png) | ![Discover](screenshots/discover.jpg) |

## Features

- **Automatic scanning**: Recursively scan folders, parse filenames (anitomy-style), and group files into series
- **Hybrid matching**: AniList GraphQL fuzzy title matching + AniDB ed2k hash file lookup
- **Rich metadata**: Characters, staff, relations, recommendations, trailers, tags, studios from AniList
- **Library analysis**: Missing-episode tracking, duplicate detection, quality-upgrade suggestions, per-group coverage
- **In-app playback**: HTML5 video player with hover preview, seek position resume, and AniList progress sync
- **Manual match-fix**: Review page for unmatched series with free-text AniList search and pin
- **Discover & Calendar**: Trending anime and seasonal airing schedule from AniList
- **Custom UI**: Borderless transparent window, animated shader background, page transitions

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ and npm
- [Rust](https://www.rust-lang.org/) (stable toolchain)
- [Tauri 2 CLI](https://tauri.app/) prerequisites for your OS:
  - **Windows**: Microsoft Visual Studio C++ Build Tools, WebView2
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `webkit2gtk`, `libgtk-3`, etc. (see Tauri docs)
- [FFmpeg](https://ffmpeg.org/) (optional, for preview generation — or set path in Settings)

## Setup

```bash
# Install frontend dependencies
npm install

# Run in development (starts Vite + Tauri window)
npm run tauri dev

# Build production bundle (.exe / .msi)
npm run tauri build

# Frontend-only dev server (no Tauri)
npm run dev

# Type check + Vite build only
npm run build
```

## Project Structure

```
Yuui03e-dev/
├── PRD.md                    # Product Requirements Document (full spec)
├── README.md                 # This file
├── docs/
│   ├── ARCHITECTURE.md       # Detailed architecture reference
│   ├── CHANGELOG.md          # Completed work log (Phases 1–4)
│   └── TODO.md               # Remaining tasks and future enhancements
├── package.json              # Frontend dependencies
├── vite.config.ts            # Vite config
├── tsconfig.json             # TypeScript config
├── tailwind.config.js        # Tailwind config
├── index.html                # HTML entry point
├── src/                      # Frontend (React + TypeScript)
│   ├── App.tsx               # Routes (8 pages)
│   ├── main.tsx             # React entry
│   ├── components/           # Shared UI (8 components)
│   ├── features/             # Page views (8 pages in 7 dirs)
│   ├── lib/                  # API bridge, types, formatters
│   ├── store/                # Zustand state management
│   └── styles/               # Global CSS
└── src-tauri/                # Backend (Rust + Tauri)
    ├── Cargo.toml            # Rust dependencies
    ├── tauri.conf.json       # Tauri config (window, security, bundle)
    └── src/                  # 11 Rust modules
        ├── lib.rs            # Tauri setup + command registration
        ├── commands.rs       # 19 Tauri commands (IPC API)
        ├── db.rs             # SQLite layer (7 tables, CRUD, migrations)
        ├── scanner.rs        # File scanner
        ├── parser.rs         # Filename parser
        ├── metadata.rs       # AniList client (search, detail, rate limit)
        ├── anidb.rs          # AniDB UDP client
        ├── hashing.rs        # ed2k hash (MD4)
        ├── media.rs          # FFmpeg preview worker
        └── library_analysis.rs  # Missing/duplicate/upgrade analysis
```

## Key Documentation

| Document                                       | Purpose                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| [`PRD.md`](PRD.md)                             | Full product spec: features, tech stack, API, schema, data flow     |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Detailed architecture: module responsibilities, data flow, patterns |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md)       | Completed work log across all phases                                |
| [`docs/TODO.md`](docs/TODO.md)                 | Remaining tasks with implementation instructions                    |

## Tech Stack

**Frontend:** React 19, React Router 7, Zustand 5, Tanstack Query 5, Tailwind 3, Framer Motion 12, Vite 8, TypeScript 6

**Backend:** Rust, Tauri 2, SQLite (sqlx 0.8), tokio, reqwest, walkdir, strsim (Jaro-Winkler), md4 (ed2k), serde

## License

Private project.
