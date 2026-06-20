import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import { env } from "../config"

const { BOTTOM, LEFT } = Astal.WindowAnchor
const API_KEY = env.NEWS_API_KEY || ""

type Article = { title: string; source: string }
const [newsData, setNewsData] = createState<Record<string, Article[]>>({
  tech: [], science: [], space: [], climate: [],
})

const newsText = createComputed(() => {
  const d = newsData()
  let text = ""
  const labels: Record<string, string> = { tech: "TECH", science: "SCIENCE", space: "SPACE", climate: "CLIMATE" }
  for (const [cat, articles] of Object.entries(d)) {
    text += `── ${labels[cat] || cat} ──\n`
    for (const a of articles) text += `${a.source}: ${a.title}\n`
    text += "\n"
  }
  return text
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

export default function NewsWidget() {
  return (
    <window visible name="news" class="News" anchor={BOTTOM | LEFT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={399} resizable={false}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <label wrap xalign={0} class="section-header" label="NEWS" />
        <label wrap class="gray3" label="SOURCE: FreeNewsApi.io" xalign={1} />
        <label wrap maxWidthChars={50} class="gray1" label={newsText} xalign={0} />
      </box>
    </window>
  )
}
