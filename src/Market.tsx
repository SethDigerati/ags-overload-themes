import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed, For } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import { env } from "../config"

const { TOP, LEFT } = Astal.WindowAnchor

const coinIds = ["bitcoin", "ethereum", "solana", "ripple", "dogecoin", "cardano", "binancecoin", "tron", "avalanche-2", "chainlink", "polkadot", "litecoin"]
const coinNames = ["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "BNB", "TRX", "AVAX", "LINK", "DOT", "LTC"]

const [assets, setAssets] = createState<Array<{ name: string; cur: string; pct1h: string; pct1d: string; pct1w: string; pct1m: string; pct1y: string }>>(
  coinNames.slice(0, 6).map((n) => ({ name: n, cur: "...", pct1h: "0", pct1d: "0", pct1w: "0", pct1m: "0", pct1y: "0" }))
)
const [forex, setForex] = createState("")

async function fetchMarket() {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds.join(",")}&price_change_percentage=1h,24h,7d,30d,1y&order=market_cap_desc`,
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
      pct1m: (d.price_change_percentage_30d_in_currency ?? 0).toFixed(1),
      pct1y: (d.price_change_percentage_1y_in_currency ?? 0).toFixed(1),
    }))
    setAssets(updated.slice(0, 6))
    console.log("market: got", Math.min(updated.length, 6), "coins")
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
  if (n > 0) return (
    <box widthRequest={60} spacing={0}>
      <label wrap class="positive" label="▲" xalign={0} widthRequest={12} />
      <label wrap class="gray2" label={`${val}%`} xalign={0} />
    </box>
  )
  if (n < 0) return (
    <box widthRequest={60} spacing={0}>
      <label wrap class="negative" label="▼" xalign={0} widthRequest={12} />
      <label wrap class="gray2" label={`${Math.abs(n).toFixed(1)}%`} xalign={0} />
    </box>
  )
  return (
    <box widthRequest={60} spacing={0}>
      <label wrap class="gray2" label="─" xalign={0} widthRequest={12} />
      <label wrap class="gray2" label="0.0%" xalign={0} />
    </box>
  )
}

export default function MarketWidget() {
  return (
    <window visible name="market" class="Market" anchor={TOP | LEFT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={399} resizable={false}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <label wrap xalign={0} class="section-header" label="MARKET" />
        <box spacing={5}>
          <label wrap class="accent" label="ASSET" xalign={0} widthRequest={50} />
          <box widthRequest={60} spacing={0}>
            <box widthRequest={12} />
            <label wrap class="accent" label="1h" xalign={0} />
          </box>
          <box widthRequest={60} spacing={0}>
            <box widthRequest={12} />
            <label wrap class="accent" label="1d" xalign={0} />
          </box>
          <box widthRequest={60} spacing={0}>
            <box widthRequest={12} />
            <label wrap class="accent" label="1w" xalign={0} />
          </box>
          <box widthRequest={60} spacing={0}>
            <box widthRequest={12} />
            <label wrap class="accent" label="1m" xalign={0} />
          </box>
          <box widthRequest={60} spacing={0}>
            <box widthRequest={12} />
            <label wrap class="accent" label="1y" xalign={0} />
          </box>
        </box>
        <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
          <For each={assets}>
            {(item) => (
              <box widthRequest={399} spacing={5}>
                <label ellipsize={3} maxWidthChars={6} wrap xalign={0} class="gray2" label={item.name} widthRequest={50} />
                <Cell val={item.pct1h} />
                <Cell val={item.pct1d} />
                <Cell val={item.pct1w} />
                <Cell val={item.pct1m} />
                <Cell val={item.pct1y} />
              </box>
            )}
          </For>
        </box>
        <label ellipsize={3} maxWidthChars={15} wrap class="gray3" label={createComputed(() => forex())} xalign={0.5} />
      </box>
    </window>
  )
}
