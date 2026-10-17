import { Gtk } from "ags/gtk4"
import { createState, createComputed, For } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import Gio from "gi://Gio?version=2.0"
import GLib from "gi://GLib?version=2.0"
import { writeFile, exec } from "./util"
import { env, intervals } from "../config"

const API_KEY = env.LASTFM_API_KEY || ""
const USERNAME = env.LASTFM_USERNAME || ""
const DATA_DIR = "/tmp/ags/lastfm"

// Last.fm serves this stock placeholder hash when a track has no artwork.
// Downloading it for every art-less track made several rows show the same
// "duplicated" cover, so it is treated as missing instead.
const NO_ART_HASH = "2a96cbd8b46e442fc41c2b86b821562f"
const IMG_SIZES = ["extralarge", "large", "medium", "small"] as const

// Pre-blurred placeholder tile: GTK's CSS engine has no backdrop blur and
// ignores `filter:`, so the frosted-glass background is a small SVG whose
// feGaussianBlur librsvg renders offscreen. Written once when missing; bump
// the filename version to force a refresh after artwork tweaks.
const BLUR_PLACEHOLDER = `${DATA_DIR}/placeholder_blur_v4.svg`

function ensureBlurPlaceholder(): void {
  try {
    if (GLib.file_test(BLUR_PLACEHOLDER, GLib.FileTest.IS_REGULAR)) return
    writeFile(BLUR_PLACEHOLDER, `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="intense-blur" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="16" />
    </filter>
  </defs>
  <!-- Translucent frosted glass tint (transparent background, no black/blue) -->
  <rect width="200" height="200" fill="#FFFFFF" fill-opacity="0.05" />

  <g filter="url(#intense-blur)">
    <!-- Soft frosted white light blooms -->
    <circle cx="45" cy="45" r="50" fill="#FFFFFF" fill-opacity="0.45" />
    <circle cx="155" cy="155" r="55" fill="#FFFFFF" fill-opacity="0.30" />

    <!-- Theme gold blooms -->
    <circle cx="140" cy="50" r="55" fill="#FFE020" fill-opacity="0.65" />
    <circle cx="50" cy="145" r="50" fill="#E3C30D" fill-opacity="0.55" />

    <!-- Diagonal golden refraction lines that smear across the frosted glass -->
    <line x1="15" y1="30" x2="175" y2="190" stroke="#FFE020" stroke-width="14" stroke-opacity="0.55" stroke-linecap="round" />
    <line x1="50" y1="15" x2="190" y2="155" stroke="#FFE020" stroke-width="8" stroke-opacity="0.45" stroke-linecap="round" />
    <line x1="15" y1="95" x2="115" y2="195" stroke="#FFFFFF" stroke-width="8" stroke-opacity="0.35" stroke-linecap="round" />
  </g>
</svg>`)
  } catch (e) {
    console.error("blur placeholder:", e)
  }
}

type Track = {
  artist: string; track: string; album: string;
  duration: string; playcount: string; artistPlaycount: string; image: string;
  isNowPlaying: boolean;
}

const [nowPlaying, setNowPlaying] = createState("Not Playing")
const [tracks, setTracks] = createState<Track[]>([])

// Enrichment cache: track.getInfo / artist.getInfo are per-song constants,
// so fetch once per song instead of every poll (previously 6 calls / 5s).
const infoCache = new Map<string, { duration: string; playcount: string; artistPlaycount: string }>()

let _fetching = false
let _runId = 0

async function safeJson(res: any): Promise<any> {
  if (!res || res.ok === false) return null
  try {
    const text = await res.text()
    if (!text || !text.trim().startsWith("{")) return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

function hashStr(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}

function isValidImageFile(path: string): boolean {
  try {
    if (!GLib.file_test(path, GLib.FileTest.IS_REGULAR)) return false
    const [ok, bytes] = GLib.file_get_contents(path)
    if (!ok || !bytes || bytes.length < 1024) {
      try { GLib.unlink(path) } catch { /* ignore */ }
      return false
    }
    return true
  } catch {
    return false
  }
}

// Largest usable artwork URL first; skips empties and the stock placeholder.
function pickImageUrls(t: any): string[] {
  const urls: string[] = []
  for (const size of IMG_SIZES) {
    const url = t.image?.find((img: any) => img.size === size)?.["#text"] || ""
    if (url && !url.includes(NO_ART_HASH) && !urls.includes(url)) urls.push(url)
  }
  return urls
}

// Stable per-track filename: a new song gets a NEW path (the file currently
// on screen is never overwritten), a repeated song reuses its cached file.
function coverPathFor(artist: string, track: string): string {
  return `${DATA_DIR}/cover_${hashStr(`${artist}|${track}`)}.jpg`
}

async function fetchItunesCover(artist: string, track: string, album: string): Promise<string> {
  try {
    const query = album && album !== "Unknown" ? `${artist} ${album}` : `${artist} ${track}`
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`)
    const data = await safeJson(res)
    const url = data?.results?.[0]?.artworkUrl100
    if (url) return String(url).replace("100x100bb", "300x300bb")
  } catch { /* ignore */ }
  return ""
}

async function downloadAndCache(url: string, dest: string): Promise<string> {
  if (!url || url.includes(NO_ART_HASH)) return ""
  try {
    const res = await fetch(url)
    if (!res || res.ok === false) return ""
    const bytes = await res.bytes()
    const arr = bytes?.toArray()
    if (arr && arr.length > 1024) {
      writeFile(dest, arr)
      return dest
    }
  } catch (e) {
    console.error("cover download error:", e)
  }
  return ""
}

// Multi-tier resolution: per-track file is reused only when valid, otherwise
// recenttracks payload first, iTunes fallback second. Album art from
// track.getInfo is handled in enrich() where infoData is available.
async function resolveCover(artist: string, track: string, album: string, t: any): Promise<string> {
  const dest = coverPathFor(artist, track)
  if (isValidImageFile(dest)) return dest

  for (const url of pickImageUrls(t)) {
    const path = await downloadAndCache(url, dest)
    if (path) return path
  }

  const itunesUrl = await fetchItunesCover(artist, track, album)
  if (itunesUrl) {
    const path = await downloadAndCache(itunesUrl, dest)
    if (path) return path
  }

  return ""
}

async function enrich(track: Track): Promise<void> {
  const key = `${track.artist}|${track.track}`
  const cached = infoCache.get(key)
  if (cached) {
    track.duration = cached.duration
    track.playcount = cached.playcount
    track.artistPlaycount = cached.artistPlaycount
    return
  }
  try {
    const [infoRes, artistRes] = await Promise.all([
      fetch(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(track.artist)}&track=${encodeURIComponent(track.track)}&api_key=${API_KEY}&format=json`),
      fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${encodeURIComponent(track.artist)}&user=${encodeURIComponent(USERNAME)}&api_key=${API_KEY}&format=json`),
    ])
    const [infoData, artistData] = await Promise.all([safeJson(infoRes), safeJson(artistRes)])
    if (!infoData && !artistData) return
    if (infoData?.track?.duration) {
      const secs = Math.floor(parseInt(infoData.track.duration) / 1000)
      track.duration = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`
    }
    if (infoData?.track?.userplaycount) track.playcount = infoData.track.userplaycount
    if (artistData?.artist?.stats?.userplaycount) track.artistPlaycount = artistData.artist.stats.userplaycount
    if (!track.image && infoData?.track?.album) {
      const dest = coverPathFor(track.artist, track.track)
      for (const url of pickImageUrls(infoData.track.album)) {
        const path = await downloadAndCache(url, dest)
        if (path) {
          track.image = path
          break
        }
      }
    }
  } catch (e) { console.error("lastfm track info:", e) }
  infoCache.set(key, { duration: track.duration, playcount: track.playcount, artistPlaycount: track.artistPlaycount })
}

// One-time migration: remove legacy fixed-name covers (cover_0..3.jpg and
// timestamped cover_<ts>_<i>.jpg) left by previous versions, plus superseded
// placeholder tile versions.
function cleanupLegacy(): void {
  try {
    const currentTile = BLUR_PLACEHOLDER.slice(BLUR_PLACEHOLDER.lastIndexOf("/") + 1)
    const names = exec(["ls", DATA_DIR]).split("\n").map((n) => n.trim()).filter(Boolean)
    for (const n of names) {
      const staleCover = /^cover_\d\.jpg$/.test(n) || /^cover_\d+_\d+\.jpg$/.test(n)
      const staleTile = /^placeholder_blur_.*\.svg$/.test(n) && n !== currentTile
      if (staleCover || staleTile) {
        try { exec(["rm", "-f", `${DATA_DIR}/${n}`]) } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

async function fetchLastfm() {
  if (!API_KEY || !USERNAME) return
  if (_fetching) return
  _fetching = true
  const myId = ++_runId
  try {
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(USERNAME)}&api_key=${API_KEY}&format=json&limit=4`
    )
    const data = await safeJson(res)
    if (!data) return
    if (myId !== _runId) return
    if (!data?.recenttracks?.track) return
    const items = Array.isArray(data.recenttracks.track) ? data.recenttracks.track : [data.recenttracks.track]
    if (tracks().length > 0 && tracks()[0].isNowPlaying && tracks()[0].image) {
      const first = items[0]
      if (first?.["@attr"]?.nowplaying === "true" &&
          `${first.artist?.["#text"]}|${first.name}` === `${tracks()[0].artist}|${tracks()[0].track}`)
        return
    }
    const count = Math.min(4, items.length)
    // Resolve covers concurrently; each writes to its own per-track file,
    // so nothing on screen is touched until the atomic swap below.
    const all: Track[] = await Promise.all(
      Array.from({ length: count }, (_, i) => (async (): Promise<Track> => {
        const t = items[i]
        const artist = t.artist?.["#text"] || "Unknown"
        const track = t.name || "Unknown"
        const album = t.album?.["#text"] || "Unknown"
        return {
          artist,
          track,
          album,
          duration: "-",
          playcount: "-",
          artistPlaycount: "-",
          image: await resolveCover(artist, track, album, t),
          isNowPlaying: t["@attr"]?.nowplaying === "true",
        }
      })())
    )
    if (myId !== _runId) return
    // Separate nowplaying from scrobbles
    const nowPlayingTrack = all.find(t => t.isNowPlaying)
    const scrobbles = all.filter(t => !t.isNowPlaying)
    // Build display: nowplaying first if active, then scrobbles (max 3)
    const display: Track[] = []
    if (nowPlayingTrack) display.push(nowPlayingTrack)
    for (const s of scrobbles) {
      if (display.length >= 3) break
      // Skip scrobbles that match the nowplaying track (already featured)
      if (nowPlayingTrack && `${s.artist}|${s.track}` === `${nowPlayingTrack.artist}|${nowPlayingTrack.track}`) continue
      display.push(s)
    }
    await Promise.all(display.map(enrich))
    if (myId !== _runId) return
    // Atomic publish: status + art + metadata swap in the same tick, so a
    // cover can never appear ahead of the text to its right.
    setTracks(display)
    setNowPlaying(nowPlayingTrack ? "▶ Playing" : "⏸ Paused")
  } catch (e) { console.error("lastfm fetch:", e) }
  finally { _fetching = false }
}

interval(intervals.lastfm, () => fetchLastfm().catch((e) => console.error("lastfm poll:", e)))
Gio.NetworkMonitor.get_default()?.connect("network-changed", (_m: any, online: boolean) => {
  if (online) {
    fetchLastfm().catch((e) => console.error("lastfm poll:", e))
  }
})
cleanupLegacy()
ensureBlurPlaceholder()
fetchLastfm().catch((e) => console.error("lastfm init:", e))

export function LastFmBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
      <label wrap xalign={0} class="section-header" label="LAST.FM" />
      <box class="hr-line" />
      <label ellipsize={3} maxWidthChars={40} wrap class="accent" label={createComputed(() => nowPlaying())} xalign={0} />
      <For each={tracks}>
        {(item, idx) => {
          const size = idx.peek() === 0 ? 100 : 80
          // No border, no padding: the overlay is exactly `size`, so the art and
          // the placeholder tile occupy identical geometry and rows never shift
          // a pixel when a track gains or loses artwork.
          return (
            <box orientation={Gtk.Orientation.VERTICAL}>
              <box>
                <overlay
                  class={item.image ? "cover-frame has-art" : "cover-frame is-placeholder"}
                  widthRequest={size}
                  heightRequest={size}
                  halign={Gtk.Align.START}
                  valign={Gtk.Align.CENTER}
                >
                  {/* Same <image> widget + pixelSize in both branches: cached
                      art when available, pre-blurred SVG tile otherwise. */}
                  <image
                    class="cover-art"
                    file={item.image || BLUR_PLACEHOLDER}
                    pixelSize={size}
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.CENTER}
                  />
                  {/* Always rendered (empty + transparent with art) so no JSX
                      fragment is needed to split main vs overlay children. */}
                  <label
                    $type="overlay"
                    class={item.image ? "hidden-icon" : "placeholder-icon"}
                    label={item.image ? "" : "♪"}
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.CENTER}
                    xalign={0.5}
                    yalign={0.5}
                  />
                </overlay>
              <box class="track-details" orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER}>
                <box>
                  <label class="accent" label="Track: " xalign={0} />
                  <label wrap maxWidthChars={40} class="gray2" label={item.track} xalign={0} hexpand />
                </box>
                <box>
                  <label class="accent" label="Artist: " xalign={0} />
                  <label wrap maxWidthChars={40} class="gray3" label={item.artist} xalign={0} hexpand />
                </box>
                <box>
                  <label class="accent" label="Album: " xalign={0} />
                  <label wrap maxWidthChars={40} class="gray3" label={item.album} xalign={0} hexpand />
                </box>
                {idx.peek() === 0 && (
                  <box>
                    <label class="accent" label="Duration: " xalign={0} />
                    <label ellipsize={3} maxWidthChars={10} wrap class="gray3" label={item.duration} xalign={0} />
                  </box>
                )}
                <box>
                  <label class="accent" label="Plays: " xalign={0} />
                  <label ellipsize={3} maxWidthChars={10} wrap class="gray3" label={item.playcount} xalign={0} />
                  <label class="accent" label="Artist plays: " xalign={0} />
                  <label ellipsize={3} maxWidthChars={10} wrap class="gray3" label={item.artistPlaycount} xalign={0} />
                </box>
              </box>
            </box>
            {idx.peek() === 0 && <box class="hr-line" />}
            </box>
          )
        }}
      </For>
    </box>
  )
}
