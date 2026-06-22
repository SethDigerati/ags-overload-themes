import { Gtk } from "ags/gtk4"
import { createState, createComputed, For } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import { env } from "../config"
const API_KEY = env.NEWS_API_KEY || ""
const API_SOURCE = "FreeNewsApi.io"

type Article = { title: string; source: string; publishedAt: string }
const [newsData, setNewsData] = createState<Record<string, Article[]>>({
  tech: [], science: [], space: [], climate: [],
})

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function fmtTime(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso.replace(" ", "T"))
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

type RenderItem = { type: "header"; label: string } | { type: "article"; source: string; time: string; title: string }

const items = createComputed(() => {
  const d = newsData()
  const labels: Record<string, string> = { tech: "TECH", science: "SCIENCE", space: "SPACE", climate: "CLIMATE" }
  const result: RenderItem[] = []
  for (const [cat, articles] of Object.entries(d)) {
    if (!articles.length) continue
    result.push({ type: "header", label: `── ${labels[cat] || cat} ──` })
    for (const a of articles) {
      result.push({ type: "article", source: a.source, time: fmtTime(a.publishedAt), title: a.title })
    }
  }
  return result
})

const categoryMap: Record<string, string> = {
  tech: "technology",
  science: "science",
  space: "space",
  climate: "environment",
}

const categories = Object.keys(categoryMap)

async function fetchCategory(cat: string) {
  if (!API_KEY) return
  try {
    const topic = categoryMap[cat]
    const res = await fetch(
      `https://api.freenewsapi.io/v1/news?language=en&topic=${topic}&page_size=2`,
      { headers: { "x-api-key": API_KEY } }
    )
    const data = await res.json()
    if (data?.error) { console.error(`news ${cat}:`, data.error); return }
    const articles = data?.data
    if (articles?.length) {
      const current = { ...newsData() }
      current[cat] = articles.slice(0, 2).map((a: any) => ({
        title: a.title || "N/A",
        source: a.publisher || "",
        publishedAt: a.published_at || "",
      }))
      setNewsData(current)
    }
  } catch (e) { console.error(`news ${cat}:`, e) }
}

let catIdx = 0
interval(300000, () => { fetchCategory(categories[catIdx % categories.length]).catch((e) => console.error("news poll:", e)); catIdx++ })

async function initAll() {
  for (const c of categories) {
    await fetchCategory(c)
    await new Promise(r => setTimeout(r, 1500))
  }
}
initAll()

export function NewsBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
      <label wrap xalign={0} class="section-header" label="NEWS" />
      <box class="hr-line" />
      <label wrap ellipsize={3} maxWidthChars={30} class="gray3" label={`SOURCE : ${API_SOURCE}`} xalign={0} />
      <For each={items}>
        {(item) =>
          item.type === "header"
            ? <label wrap ellipsize={3} maxWidthChars={30} class="accent" xalign={0.5} label={item.label} />
            : <box orientation={Gtk.Orientation.VERTICAL}>
                <box>
                  <label xalign={0} maxWidthChars={50} useMarkup class="gray1" label={`<b>[${esc(item.source)}]</b>`} />
                  <box hexpand valign={Gtk.Align.CENTER} class="hr-inline" />
                  <label ellipsize={3} maxWidthChars={8} class="gray3" label={`[${item.time}]`} />
                </box>
                <label wrap maxWidthChars={50} class="gray1" xalign={0} label={item.title} />
              </box>
        }
      </For>
    </box>
  )
}
