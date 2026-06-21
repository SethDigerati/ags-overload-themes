import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed, For } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import { writeFile } from "./util"
import { env } from "../config"

const { TOP, LEFT } = Astal.WindowAnchor
const API_KEY = env.LASTFM_API_KEY || ""
const USERNAME = env.LASTFM_USERNAME || ""
const DATA_DIR = "/tmp/ags/lastfm"

const [nowPlaying, setNowPlaying] = createState("Not Playing")
const [tracks, setTracks] = createState<Array<{
  artist: string; track: string; album: string;
  duration: string; playcount: string; artistPlaycount: string; image: string;
  isNowPlaying: boolean;
}>>([])

async function fetchLastfm() {
  if (!API_KEY || !USERNAME) return
  try {
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${USERNAME}&api_key=${API_KEY}&format=json&limit=4`
    )
    const data = await res.json()
    if (!data?.recenttracks?.track) return
    const items = Array.isArray(data.recenttracks.track) ? data.recenttracks.track : [data.recenttracks.track]
    const ts = Date.now()
    const all: Array<{ artist: string; track: string; album: string; duration: string; playcount: string; artistPlaycount: string; image: string; isNowPlaying: boolean }> = []
    for (let i = 0; i < Math.min(4, items.length); i++) {
      const t = items[i]
      const imgUrl = t.image?.find((img: any) => img.size === "extralarge")?.["#text"] || ""
      let imgPath = ""
      if (imgUrl) {
        try {
          const imgRes = await fetch(imgUrl)
          const imgBytes = await imgRes.bytes()
          if (imgBytes) {
            imgPath = `${DATA_DIR}/cover_${ts}_${i}.jpg`
            writeFile(imgPath, imgBytes.toArray())
          }
        } catch (e) { console.error("lastfm image download:", e) }
      }
      all.push({
        artist: t.artist?.["#text"] || "Unknown",
        track: t.name || "Unknown",
        album: t.album?.["#text"] || "Unknown",
        duration: "-",
        playcount: "-",
        artistPlaycount: "-",
        image: imgPath,
        isNowPlaying: t["@attr"]?.nowplaying === "true",
      })
    }
    // Separate nowplaying from scrobbles
    const nowPlayingTrack = all.find(t => t.isNowPlaying)
    const scrobbles = all.filter(t => !t.isNowPlaying)
    // Build display: nowplaying first if active, then scrobbles (max 3)
    const display: typeof all = []
    if (nowPlayingTrack) display.push(nowPlayingTrack)
    for (const s of scrobbles) {
      if (display.length >= 3) break
      // Skip scrobbles that match the nowplaying track (already featured)
      if (nowPlayingTrack && `${s.artist}|${s.track}` === `${nowPlayingTrack.artist}|${nowPlayingTrack.track}`) continue
      display.push(s)
    }
    setNowPlaying(nowPlayingTrack ? "▶ Playing" : "⏸ Paused")
    for (let i = 0; i < display.length; i++) {
      try {
        const info = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(display[i].artist)}&track=${encodeURIComponent(display[i].track)}&api_key=${API_KEY}&format=json`
        )
        const infoData = await info.json()
        if (infoData?.track?.duration) {
          const secs = Math.floor(parseInt(infoData.track.duration) / 1000)
          display[i].duration = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`
        }
        if (infoData?.track?.userplaycount) display[i].playcount = infoData.track.userplaycount
      } catch (e) { console.error("lastfm track info:", e) }
      try {
        const artistInfo = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${encodeURIComponent(display[i].artist)}&user=${USERNAME}&api_key=${API_KEY}&format=json`
        )
        const artistData = await artistInfo.json()
        if (artistData?.artist?.stats?.userplaycount) display[i].artistPlaycount = artistData.artist.stats.userplaycount
      } catch (e) { console.error("lastfm artist info:", e) }
    }
    setTracks(display)
  } catch (e) { console.error("lastfm fetch:", e) }
}

interval(5000, () => fetchLastfm().catch((e) => console.error("lastfm poll:", e)))
fetchLastfm().catch((e) => console.error("lastfm init:", e))

export default function LastFmWidget() {
  return (
    <window visible name="lastfm" class="LastFm" anchor={TOP | LEFT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={399} resizable={false}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <label wrap xalign={0} class="section-header" label="LAST.FM" />
        <label ellipsize={3} maxWidthChars={40} wrap class="accent" label={createComputed(() => nowPlaying())} xalign={0} />
        <For each={tracks}>
          {(item, idx) => (
            <box>
              {item.image ? (
                <image class="cover-img" file={item.image} pixelSize={idx.peek() === 0 ? 100 : 80} />
              ) : (
                <box class="cover-img" widthRequest={idx.peek() === 0 ? 100 : 80} heightRequest={idx.peek() === 0 ? 100 : 80} />
              )}
              <box class="track-details" orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER}>
                <label wrap maxWidthChars={40} class="gray2" label={`Track: ${item.track}`} xalign={0} />
                <label wrap maxWidthChars={40} class="gray3" label={`Artist: ${item.artist}`} xalign={0} />
                <label wrap maxWidthChars={40} class="gray3" label={`Album: ${item.album}`} xalign={0} />
                <label ellipsize={3} maxWidthChars={40} wrap class="gray3" label={idx.peek() === 0 ? `Duration: ${item.duration} | Plays: ${item.playcount} | Artist plays: ${item.artistPlaycount}` : `Plays: ${item.playcount} | Artist plays: ${item.artistPlaycount}`} xalign={0} />
              </box>
            </box>
          )}
        </For>
      </box>
    </window>
  )
}
