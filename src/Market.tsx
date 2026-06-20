import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed, For } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import { env } from "../config"

const { TOP, LEFT } = Astal.WindowAnchor

const coinIds = ["bitcoin", "ethereum", "solana", "ripple", "dogecoin", "cardano", "binancecoin", "tron", "avalanche-2", "chainlink", "polkadot", "litecoin"]
const coinNames = ["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "BNB", "TRX", "AVAX", "LINK", "DOT", "LTC"]

const [assets, setAssets] = createState<Array<{ name: string; cur: string; pct1h: string; pct1d: string; pct1w: string }>>(
  coinNames.map((n) => ({ name: n, cur: "...", pct1h: "0", pct1d: "0", pct1w: "0" }))
)
const [forex, setForex] = createState("")

async function fetchMarket() {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds.join(",")}&price_change_percentage=1h,24h,7d&order=market_cap_desc`,
      { headers: { "User-Agent": "ags-overload-themes/1.0" } }
    )
    const data = await res.json()
    if (!data?.length) return
    const updated = data.map((d: any, i: number) => ({
      name: coinNames[i] || d.symbol.toUpperCase(),
      cur: d.current_price ? `$${d.current_price.toLocaleString()}` : "N/A",
      pct1h: (d.price_change_percentage_1h_in_currency ?? 0).toFixed(1),
      pct1d: (d.price_change_percentage_24h ?? 0).toFixed(1),
      pct1w: (d.price_change_percentage_7d_in_currency ?? 0).toFixed(1),
    }))
    setAssets(updated)
    console.log("market: got", updated.length, "coins")
  } catch (e) { console.error("market fetch:", e) }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD")
    const data = await res.json()
    if (data?.rates) {
      const eur = data.rates.EUR?.toFixed(2)
      const jpy = data.rates.JPY?.toFixed(0)
      setForex(eur && jpy ? `1 USD = ${eur} EUR | 1 USD = ${jpy} JPY` : "")
    }
  } catch (e) { console.error("market forex:", e) }
}

interval(240000, () => fetchMarket().catch((e) => console.error("market poll:", e)))
fetchMarket().catch((e) => console.error("market init:", e))

function Cell({ val }: { val: string }) {
  const n = parseFloat(val)
  if (n > 0) return <label wrap class="positive" label={`▲${val}%`} xalign={1} />
  if (n < 0) return <label wrap class="negative" label={`▼${Math.abs(n).toFixed(1)}%`} xalign={1} />
  return <label wrap class="gray2" label="─0.0%" xalign={1} />
}

export default function MarketWidget() {
  return (
    <window visible name="market" class="Market" anchor={TOP | LEFT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={399} resizable={false}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <label wrap xalign={0} class="section-header" label="MARKET" />
        <box>
          <label wrap label="ASSET" widthRequest={50} />
          <label wrap class="gray2" label="1h" xalign={1} widthRequest={55} />
          <label wrap class="gray2" label="1d" xalign={1} widthRequest={55} />
          <label wrap class="gray2" label="1w" xalign={1} widthRequest={55} />
        </box>
        <For each={assets}>
          {(item) => (
            <box>
              <label ellipsize={3} maxWidthChars={6} wrap xalign={0} class="section-header" label={item.name} widthRequest={50} />
              <Cell val={item.pct1h} />
              <Cell val={item.pct1d} />
              <Cell val={item.pct1w} />
            </box>
          )}
        </For>
        <label ellipsize={3} maxWidthChars={15} wrap class="gray3" label={createComputed(() => forex())} xalign={1} />
      </box>
    </window>
  )
}
