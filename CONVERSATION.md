# Opencode Conversation Log

## Session: ags-overload-themes

---

### Turn 1 — User request
> I want to create a new repo, basically it is going to be an AGS version of my other conky themes repo (SethDigerati/conky-themes-repo)
> Repo name: ags-overload-themes

Setup:
- Created `/home/digerati/Projects/ags-overload-themes`
- Installed AGS v3.1.0 via `yay -S aylurs-gtk-shell`
- Initialized project with `ags init -d ~/Projects/ags-overload-themes`
- Installed npm deps (ags, gnim, sass)
- Symlinked `~/.config/ags/` → project dir
- Copied `.env` from Desktop
- Downloaded weather icons from GitHub

First `ags run main.ts` failed — `sass` not in PATH. Fixed by prefixing: `PATH="$PWD/node_modules/.bin:$PATH" ags run main.ts`

---

### Turn 2 — Project structure

Files created:
- `config.ts` — colors, intervals, positions, `.env` parser
- `style.scss` — dark theme CSS
- `data.ts` — central data collector (`/proc`, `/sys` reads on 1s interval)
- `env.d.ts` — environment type declarations
- `tsconfig.json` — AGS v3 TS config
- `main.ts` — entry point
- `src/System.tsx` — time, date, kernel, uptime, battery
- `src/Cpu.tsx` — CPU model, freq, temp, per-core load bars
- `src/Gpu.tsx` — GPU model, type, driver, memory, freq
- `src/Memory.tsx` — RAM/Swap usage with level bars, disk R/W speeds
- `src/Network.tsx` — status, SSID, signal, IP, DL/UL speeds & totals, latency
- `src/Weather.tsx` — OWM current + 5-day forecast, moon phase
- `src/LastFm.tsx` — recent tracks with album art
- `src/Market.tsx` — crypto prices (BTC, ETH, SOL, XRP, DOGE, etc.) + forex
- `src/News.tsx` — tech, science, space, climate headlines
- `src/Quote.tsx` — random quote from zenquotes.io

---

### Turn 3 — Error fixing round 1

Errors from first `ags run main.ts`:
1. **`cpuPerc is not a function`** — `createState` returns `[Accessor, Setter]` tuple. Fixed `data.ts` to destructure all 40+ state variables.
2. **`No property vertical on GtkBox`** — GTK4 uses `orientation={Gtk.Orientation.VERTICAL}` instead of `vertical`. Fixed all 10 widget files.
3. **`No property truncate on GtkLabel`** — GTK4 uses `ellipsize={3}`. Fixed Cpu.tsx, Gpu.tsx, Weather.tsx, LastFm.tsx.
4. **`No property width on GtkLabel`** — GTK4 uses `widthRequest={N}` instead of `width={N}`. Fixed Gpu.tsx, Memory.tsx, Network.tsx.
5. **`location is not a function`** — API widgets used non-destructured `createState` (same bug as data.ts). Fixed Weather.tsx, LastFm.tsx, Market.tsx, Quote.tsx, News.tsx.
6. **`window._prevRx` undefined** — GJS has no `window` global. Moved to module-level `let _prevRx = 0` etc. in data.ts.
7. **`sda` hardcoded** — changed disk stat detection to match first non-loop/ram/zram device.
8. **`.env` path** — was `${SRC}/.env` with undefined `SRC`. Changed to `".env"`.

---

### Turn 4 — Smash Stadium font

User wanted "Smash Stadium Font" for weekday display (from `~/.fonts/Smash Stadium Font.ttf`).

Changes:
- Split `time` poll in System.tsx into `weekday` (date '+%A', 60s) and `timeStr` (date '+%H:%M', 1s)
- Added `<label class="weekday">` with `font-family: "Smash Stadium Font"`
- Added `.weekday` class in style.scss (38pt, white)

---

### Turn 5 — Weather icons

User noted weather icons in `assets/icons/` weren't being used.

Changes:
- Added `mapWeatherIcon(code, isDay)` converting OWM condition codes → local icon filenames
- Store icon name in weather + forecast state
- Display via `<image file={...}>` (AGS v3 doesn't support `<picture>`)
- Used `GLib.get_current_dir()` for absolute icon paths

Also learned: AGS v3 GTK4 JSX intrinsic elements are: `window`, `box`, `label`, `image`, `levelbar`, `stack`, `revealer`, `overlay`, `centerbox`, `scrolledwindow`, `entry`, `button`, `togglebutton`, `switch`, `menubutton`, `popover`, `drawingarea`, `slider`.

---

## Current State

**Running cleanly with `ags run main.ts`** — only harmless Gdk portal warnings.

### Key Gotchas
| Wrong | Right |
|---|---|
| `<picture file={...}>` | `<image file={...}>` |
| `<box vertical>` | `<box orientation={Gtk.Orientation.VERTICAL}>` |
| `width={60}` | `widthRequest={60}` |
| `truncate` | `ellipsize={3}` |
| `const x = createState(v)` | `const [x, setX] = createState(v)` |
| `x(val)` (set) | `setX(val)` |
| `window._var` | module-level `let _var` |
| `"sda"` hardcoded | match first non-loop device |
| `readFile(\`\${SRC}/.env\`)` | `readFile(".env")` |
| `import { Gtk, Gdk }` unused | remove unused imports |
