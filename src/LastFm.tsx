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
  duration: string; playcount: string; image: string;
}>>([])

async function fetchLastfm() {
  if (!API_KEY || !USERNAME) return
  try {
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${USERNAME}&api_key=${API_KEY}&format=json&limit=3`
    )
    const data = await res.json()
    if (!data?.recenttracks?.track) return
    const items = Array.isArray(data.recenttracks.track) ? data.recenttracks.track : [data.recenttracks.track]
    setNowPlaying(items[0]?.["@attr"]?.nowplaying === "true" ? "▶ Playing" : "⏸ Paused")
    const result: Array<{ artist: string; track: string; album: string; duration: string; playcount: string; image: string }> = []
    for (let i = 0; i < Math.min(3, items.length); i++) {
      const t = items[i]
      const img = t.image?.find((img: any) => img.size === "extralarge")?.["#text"] || ""
      if (img) {
        try {
          const imgRes = await fetch(img)
          const imgBytes = await imgRes.bytes()
          if (imgBytes) writeFile(`${DATA_DIR}/cover${i}.jpg`, imgBytes.toArray())
        } catch (e) { console.error("lastfm image download:", e) }
      }
      result.push({
        artist: t.artist?.["#text"] || "Unknown",
        track: t.name || "Unknown",
        album: t.album?.["#text"] || "Unknown",
        duration: "-",
        playcount: "-",
        image: img ? `${DATA_DIR}/cover${i}.jpg` : "",
      })
    }
    if (result[0]) {
      try {
        const info = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(result[0].artist)}&track=${encodeURIComponent(result[0].track)}&api_key=${API_KEY}&format=json`
        )
        const infoData = await info.json()
        if (infoData?.track?.duration) {
          const secs = Math.floor(parseInt(infoData.track.duration) / 1000)
          result[0].duration = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`
        }
        if (infoData?.track?.userplaycount) result[0].playcount = infoData.track.userplaycount
      } catch (e) { console.error("lastfm track info:", e) }
    }
    setTracks(result)
  } catch (e) { console.error("lastfm fetch:", e) }
}

interval(5000, () => fetchLastfm().catch((e) => console.error("lastfm poll:", e)))
fetchLastfm().catch((e) => console.error("lastfm init:", e))

export default function LastFmWidget() {
  return (
    <window visible name="lastfm" class="LastFm" anchor={TOP | LEFT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={399} resizable={false}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <label wrap xalign={0} class="section-header" label="LAST.FM" />
        <label ellipsize={3} maxWidthChars={40} wrap class="accent" label={createComputed(() => nowPlaying())} xalign={1} />
        <For each={tracks}>
          {(item, idx) => (
            <box>
              {item.image ? (
                <image file={item.image} pixelSize={80} />
              ) : (
                <box widthRequest={80} heightRequest={80} />
              )}
              <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                <label wrap maxWidthChars={40} class="gray2" label={`Track: ${item.track}`} xalign={0} />
                <label wrap maxWidthChars={40} class="gray3" label={`Artist: ${item.artist}`} xalign={0} />
                <label wrap maxWidthChars={40} class="gray3" label={`Album: ${item.album}`} xalign={0} />
                {idx.peek() === 0 && (
                  <label ellipsize={3} maxWidthChars={40} wrap class="gray3" label={`Duration: ${item.duration} | Plays: ${item.playcount}`} xalign={0} />
                )}
              </box>
            </box>
          )}
        </For>
      </box>
    </window>
  )
}
