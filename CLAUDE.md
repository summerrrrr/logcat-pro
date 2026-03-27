# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run dev          # Start development mode (electron-vite dev)
npm run build        # Compile TypeScript & Vue (electron-vite build)
npm run pack         # Package app without installer
npm run dist         # Build Windows NSIS installer → release/
npm run preview      # Preview production build
```

No test framework is configured.

## Architecture

LogCat Pro is a Windows Electron desktop app for real-time Android logcat viewing and AI-powered analysis. It uses the standard three-process Electron architecture:

### Main Process (`src/main/`)
- **ADB** (`adb/`): Device discovery, WiFi connection, screenshots, process monitoring. `AdbPath.ts` searches multiple locations for the adb binary (bundled in `resources/bin/`, PATH, ANDROID_HOME, common install paths).
- **Log Collection** (`collector/`): Spawns `adb logcat` child processes, parses threadtime format via regex (`LogParser.ts`), buffers output at 100ms intervals.
- **Analysis** (`analyzer/`): Plugin-based rule engine. Rules: `CrashRule` (FATAL EXCEPTION, Java/native crashes), `AnrRule` (ANR detection), `PerformanceRule` (frame skips, GC, slow ops).
- **AI** (`ai/`): Multi-provider LLM integration (Gemini, OpenAI, Claude, custom). `PDFGenerator.ts` exports analysis reports.
- **Storage** (`storage/`): sql.js SQLite with FTS5 full-text search. Tables: sessions, logs, bookmarks. Auto-saves every 10 seconds.
- **IPC** (`ipc.ts`): Central IPC handler registration bridging main ↔ renderer.

### Preload (`src/preload/`)
Exposes `electronAPI` with namespaced methods: `device`, `log`, `storage`, `config`, `analysis`, `bookmark`, `window`.

### Renderer (`src/renderer/`)
Vue 3 + Pinia + Element Plus + TypeScript.

- **Views**: HomeMode, LiveLogMode, FileAnalyzerMode, ChatMode, PerfMode, ScreenshotView (frameless window)
- **State** (Pinia stores):
  - `logStore`: Log entries as `shallowRef` (avoids deep reactivity for perf), max 50k entries, filter/highlight/rate tracking
  - `deviceStore`: Device list, active device/pid, performance polling
  - `configStore`: AI provider configs persisted to localStorage
  - `analysisStore`: Analysis results and selected issues

### Shared Types (`src/shared/`)
Cross-process type definitions used by all three processes.

## Key Patterns

- **Path alias**: `@/` maps to `src/renderer/` in renderer code (configured in `tsconfig.web.json` and `electron.vite.config.ts`)
- **Performance**: Virtual list rendering via `@tanstack/vue-virtual` for 50k+ logs; `shallowRef` for log arrays; client-side filtering
- **sql.js** is marked as external in Vite config
- **Dark theme** by default with CSS variables
- **ADB binary** bundled in `resources/bin/` for standalone operation
