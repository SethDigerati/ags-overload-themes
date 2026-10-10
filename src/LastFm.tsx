import { Gtk } from "ags/gtk4"
import { createState, createComputed, For } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
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

function hashStr(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}

function fileExists(path: string): boolean {
  try { return GLib.file_test(path, GLib.FileTest.EXISTS) } catch { return false }
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

// Fallback chain: try each available size largest-first; "" renders the
// empty .cover-img box in the UI.
async function resolveCover(artist: string, track: string, t: any): Promise<string> {
  const dest = coverPathFor(artist, track)
  if (fileExists(dest)) return dest
  for (const url of pickImageUrls(t)) {
    try {
      const imgRes = await fetch(url)
      const imgBytes = await imgRes.bytes()
      const arr = imgBytes?.toArray()
      if (arr && arr.length > 0) {
        writeFile(dest, arr)
        return dest
      }
    } catch (e) { console.error("lastfm image download:", e) }
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
    const [infoData, artistData] = await Promise.all([infoRes.json(), artistRes.json()])
    if (infoData?.track?.duration) {
      const secs = Math.floor(parseInt(infoData.track.duration) / 1000)
      track.duration = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`
    }
    if (infoData?.track?.userplaycount) track.playcount = infoData.track.userplaycount
    if (artistData?.artist?.stats?.userplaycount) track.artistPlaycount = artistData.artist.stats.userplaycount
  } catch (e) { console.error("lastfm track info:", e) }
  infoCache.set(key, { duration: track.duration, playcount: track.playcount, artistPlaycount: track.artistPlaycount })
}

// One-time migration: remove legacy fixed-name covers (cover_0..3.jpg and
// timestamped cover_<ts>_<i>.jpg) left by previous versions.
function cleanupLegacy(): void {
  try {
    const names = exec(["ls", DATA_DIR]).split("\n").map((n) => n.trim()).filter(Boolean)
    for (const n of names) {
      if (/^cover_\d\.jpg$/.test(n) || /^cover_\d+_\d+\.jpg$/.test(n)) {
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
    const data = await res.json()
    if (myId !== _runId) return
    if (!data?.recenttracks?.track) return
    const items = Array.isArray(data.recenttracks.track) ? data.recenttracks.track : [data.recenttracks.track]
    if (tracks().length > 0 && tracks()[0].isNowPlaying) {
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
        return {
          artist,
          track,
          album: t.album?.["#text"] || "Unknown",
          duration: "-",
          playcount: "-",
          artistPlaycount: "-",
          image: await resolveCover(artist, track, t),
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
cleanupLegacy()
fetchLastfm().catch((e) => console.error("lastfm init:", e))

export function LastFmBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
      <label wrap xalign={0} class="section-header" label="LAST.FM" />
      <box class="hr-line" />
      <label ellipsize={3} maxWidthChars={40} wrap class="accent" label={createComputed(() => nowPlaying())} xalign={0} />
      <For each={tracks}>
        {(item, idx) => (
          <box orientation={Gtk.Orientation.VERTICAL}>
            <box>
              {item.image ? (
                <image class="cover-img" file={item.image} pixelSize={idx.peek() === 0 ? 100 : 80} />
              ) : (
                <box class="cover-img" widthRequest={idx.peek() === 0 ? 100 : 80} heightRequest={idx.peek() === 0 ? 100 : 80} />
              )}
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
        )}
      </For>
    </box>
  )
}
