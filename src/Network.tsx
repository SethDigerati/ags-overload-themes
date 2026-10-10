import { Gtk } from "ags/gtk4"
import { createComputed } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import {
  netIface, netStatus, netSSID, netBitrate, netSignal,
  netDownSpeed, netUpSpeed, netDownTotal, netUpTotal,
  netLocalIp, netLatency, netLoss, netJitter,
  netConnections, netInbound, netOutbound, netISP,
  netDownGraphData, netUpGraphData,
  setNetISP,
  formatSpeed,
} from "../data"
import { Graph } from "./Graph"
import { graphs } from "../config"

const netLabels = [
  "Status : ", "SSID : ", "Bitrate : ", "ISP : ", "Latency : ", "Loss : ",
  "Connections : ", "Total DL : ", "Down : ", "Up : ",
  "Local IP : ",
]
const netFieldWidth = Math.max(...netLabels.map(l => l.length)) * 7 + 10

const MAX_ISP_LEN = 50
const ISP_RATE_LIMIT_MSG = "Rate limit exceeded"

function sanitizeISP(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_ISP_LEN)
}

async function fetchISP() {
  try {
    const res = await fetch("https://ipinfo.io/org")
    if (res.status === 429) {
      if (ISP_RATE_LIMIT_MSG !== netISP()) setNetISP(ISP_RATE_LIMIT_MSG)
      console.error("isp fetch: rate limit exceeded (429)")
      return
    }
    if (!res.ok) {
      const msg = sanitizeISP(`Error ${res.status}`)
      if (msg && msg !== netISP()) setNetISP(msg)
      return
    }
    const raw = await res.text()
    if (!raw) return
    if (/rate.?limit/i.test(raw)) {
      if (ISP_RATE_LIMIT_MSG !== netISP()) setNetISP(ISP_RATE_LIMIT_MSG)
      return
    }
    const trimmed = raw.trim()
    if (trimmed.startsWith("{")) {
      // ipinfo returns JSON on errors (e.g. rate limit) — never show raw JSON
      try {
        const data = JSON.parse(trimmed)
        const title = data?.error?.title || data?.error || ""
        if (/rate.?limit/i.test(String(title))) {
          if (ISP_RATE_LIMIT_MSG !== netISP()) setNetISP(ISP_RATE_LIMIT_MSG)
        } else {
          const fallback = sanitizeISP(String(title || "ISP error"))
          if (fallback && fallback !== netISP()) setNetISP(fallback)
        }
      } catch {
        if (ISP_RATE_LIMIT_MSG !== netISP()) setNetISP(ISP_RATE_LIMIT_MSG)
      }
      return
    }
    const stripped = trimmed.replace(/^[Aa][Ss]\d+\s+/, "").replace(/^[A-Z]+\d+\s+/, "")
    const clean = sanitizeISP(stripped)
    if (clean && clean !== netISP()) setNetISP(clean)
  } catch (e) { console.error("isp fetch:", e) }
}

interval(600000, () => fetchISP().catch((e) => console.error("isp poll:", e)))
fetchISP().catch((e) => console.error("isp init:", e))

export function NetworkBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
      <label wrap xalign={0} ellipsize={3} maxWidthChars={50} class="section-header" label={createComputed(() => `NETWORK(${netIface()})`)} />
      <box class="hr-line" />
      <box>
        <label class="accent" label="Status : " widthRequest={netFieldWidth} xalign={1} />
        <label ellipsize={3} maxWidthChars={50} wrap hexpand xalign={0}
          label={createComputed(() => netStatus())}
          cssClasses={createComputed(() => [netStatus() === "ONLINE" ? "positive" : "negative"])} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={netFieldWidth} label="SSID : " />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0} hexpand
          label={createComputed(() => netSSID())} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={netFieldWidth} label="ISP : " />
        <label ellipsize={3} maxWidthChars={50} lines={1} singleLineMode class="gray2" xalign={0} hexpand
          label={createComputed(() => netISP())} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Bitrate : " />
        <label ellipsize={3} maxWidthChars={12} wrap class="gray2" xalign={0}
          label={createComputed(() => netBitrate())} />
        <label hexpand />
        <label class="accent" label="Signal : " xalign={1} />
        <label ellipsize={3} maxWidthChars={6} wrap class="gray2" xalign={0}
          label={createComputed(() => netSignal())} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Latency : " />
        <label class="gray2" label="(8.8.8.8)" xalign={0} />
        <label hexpand />
        <label ellipsize={3} maxWidthChars={30} wrap class="gray2" xalign={1}
          label={createComputed(() => netLatency())} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Loss : " />
        <label ellipsize={3} maxWidthChars={6} wrap class="gray2" xalign={0}
          label={createComputed(() => `${netLoss()}%`)} />
        <label hexpand />
        <label class="accent" label="Jitter : " xalign={1} />
        <label ellipsize={3} maxWidthChars={10} wrap class="gray2" xalign={0}
          label={createComputed(() => `${netJitter()}ms`)} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Connections : " />
        <label ellipsize={3} maxWidthChars={6} wrap class="gray2" xalign={0}
          label={createComputed(() => netConnections())} />
        <label hexpand />
        <label class="accent" label="Inbound : " xalign={0} />
        <label ellipsize={3} maxWidthChars={6} wrap class="gray2" xalign={0}
          label={createComputed(() => netInbound())} />
        <label hexpand />
        <label class="accent" label="Outbound : " xalign={1} />
        <label ellipsize={3} maxWidthChars={6} wrap class="gray2" xalign={0}
          label={createComputed(() => netOutbound())} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Total DL : " />
        <label ellipsize={3} maxWidthChars={12} wrap class="gray2" xalign={0}
          label={createComputed(() => netDownTotal())} />
        <label hexpand />
        <label class="accent" label="Total UL : " xalign={1} />
        <label ellipsize={3} maxWidthChars={12} wrap class="gray2" xalign={0}
          label={createComputed(() => netUpTotal())} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Down : " />
        <label ellipsize={3} maxWidthChars={20} wrap class="gray2" xalign={0} hexpand
          label={createComputed(() => formatSpeed(netDownSpeed()))} />
      </box>
      {graphs.networkDown && <Graph data={netDownGraphData} width={399} height={40} />}
      {graphs.networkUp && <Graph data={netUpGraphData} width={399} height={40} reversed />}
      <box>
        <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Up : " />
        <label ellipsize={3} maxWidthChars={20} wrap class="gray2" xalign={0} hexpand
          label={createComputed(() => formatSpeed(netUpSpeed()))} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Local IP : " />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0} hexpand
          label={createComputed(() => netLocalIp())} />
      </box>
    </box>
  )
}
