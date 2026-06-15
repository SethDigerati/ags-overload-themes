# ags-overload-themes

## Goal
Port `SethDigerati/conky-themes-repo` (10 Conky widgets) to an AGS v3 personal config repo named `ags-overload-themes`.

## Structure
- `config.ts` — colors, intervals, positions, `.env` parser
- `data.ts` — central `/proc` & `/sys` collector (CPU, mem, GPU, net, disk, battery, temps) using 1s `interval`
- `src/*.tsx` — 10 widget files (System, Cpu, Gpu, Memory, Network, Weather, LastFm, Market, News, Quote)
- `main.ts` — entry point registering all windows
- `style.scss` — dark yellow-on-black theme, per-window margin classes
- `assets/icons/` — 35 weather PNG icons (YR convention: `clearsky_day.png`, `partlycloudy_night.png`, etc.)

## Key Conventions
- `createState` returns `[Accessor<T>, Setter<T>]` — always destructure: `const [state, setState] = createState(value)`
- Accessors are functions: `state()` to read, `setState(val)` to write
- Widget files use `.tsx` (JSX) — supported intrinsic elements: `window`, `box`, `label`, `image`, `levelbar`, `stack`, `revealer`, `overlay`, `centerbox`, `scrollablewindow`, `entry`, `button`, `togglebutton`, `switch`, `menubutton`, `popover`, `drawingarea`, `slider`
- `<image file={path}>` for images (NOT `<picture>`)
- `orientation={Gtk.Orientation.VERTICAL}` for vertical boxes (NOT `vertical`)
- `ellipsize={3}` for text truncation (NOT `truncate`)
- `widthRequest={N}` for widget width (NOT `width={N}`)
- `GLib.get_current_dir()` for absolute project root path

## Imports
| Module | Import |
|---|---|
| State mgmt | `createState`, `createComputed`, `createBinding`, `For` from `"ags"` |
| Time | `createPoll`, `interval` from `"ags/time"` |
| File | `readFile`, `writeFile` from `"ags/file"` |
| Process | `exec`, `execAsync` from `"ags/process"` |
| Fetch | `fetch` from `"ags/fetch"` |
| GTK4 | `{ Astal, Gtk, Gdk }` from `"ags/gtk4"` |
| App | `app` from `"ags/gtk4/app"` |
| GLib | `GLib` from `"gi://GLib?version=2.0"` |

## Run
```bash
cd ~/Projects/ags-overload-themes && PATH="$PWD/node_modules/.bin:$PATH" ags run main.ts
```

## Completed Features
- All 10 widgets render without JS errors
- Weather icons from `assets/icons/` mapped to OWM condition codes and displayed via `<image>`
- Smash Stadium font for weekday display in System widget
- `.env` API keys load correctly from project root

## API Keys (in `.env`)
- `WEATHER_API_KEY` — OpenWeatherMap
- `LASTFM_API_KEY`, `LASTFM_USERNAME` — Last.fm
- `NEWS_API_KEY` — NewsAPI.org

## Notes
- Smash Stadium font is at `~/.fonts/Smash Stadium Font.ttf` (family name: "Smash Stadium Font")
- GE Inspira font also available at `~/.fonts/GE_Inspira.ttf`
- Symlink: `~/.config/ags/` → `~/Projects/ags-overload-themes`
- sass binary in `node_modules/.bin/`
