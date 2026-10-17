import { createState } from "ags"
import { interval, timeout } from "ags/time"
import { readFile, setIfChanged, execAsyncFast, execAsyncRaw } from "./src/util"
import UPower from "gi://UPowerGlib?version=1.0"
import Gio from "gi://Gio?version=2.0"
import GLib from "gi://GLib?version=2.0"
import { defaultInterface, rightColumnWidgets, leftColumnWidgets } from "./config"

const visible = new Set([...rightColumnWidgets, ...leftColumnWidgets])

const networkMonitor = Gio.NetworkMonitor.get_default()

export function getNetworkAvailable(): boolean {
  try { return networkMonitor.get_network_available() }
  catch { return true }
}

function readSys(path: string): string {
  try { return readFile(path)?.trim() || "" }
  catch { return "" }
}

function listDir(path: string): string[] {
  const out: string[] = []
  try {
    const dir = GLib.Dir.open(path, 0)
    if (!dir) return out
    try {
      let name = dir.read_name()
      while (name !== null) {
        if (name !== "." && name !== "..") out.push(name)
        name = dir.read_name()
      }
    } finally { dir.close() }
  } catch { /* ignore */ }
  return out
}

/** Reproduce the `awk` tree that lsblk output used to be piped through. */
function dashes(n: number): string {
  return n > 0 ? "-".repeat(n) : ""
}

function formatLsblk(out: string): string {
  const lines: string[] = []
  for (const raw of out.split("\n")) {
    const parts = raw.trim().split(/\s+/)
    if (parts.length < 3) continue
    const [name, size, type] = parts
    if (type === "disk" || type === "rom") {
      let n = `->${name}`
      n += dashes(17 - n.length)
      lines.push(`${n}(${size})`)
    } else if (type === "part") {
      let mnt = parts[3] || ""
      if (mnt.length > 20) mnt = `${mnt.slice(0, 17)}...`
      let n = `  └--${name}`
      n += dashes(17 - n.length)
      const l = `${n}(${size})`
      lines.push(mnt ? `${l}${dashes(27 - l.length)}--${mnt}` : l)
    }
  }
  return lines.join("\n")
}

export const [cpuPerc, setCpuPerc] = createState(0)
export const [cpuPercNorm, setCpuPercNorm] = createState(0)
export const [cpuLoads, setCpuLoads] = createState("0.00 0.00 0.00")
export const [cpuModel, setCpuModel] = createState("Loading...")
export const [cpuFreq, setCpuFreq] = createState("N/A")
export const [cpuMaxFreq, setCpuMaxFreq] = createState("N/A")
export const [cpuTemp, setCpuTemp] = createState("N/A")
export const [corePercs, setCorePercs] = createState<number[]>([])
export const [coreBars, setCoreBars] = createState<{ idx: number; h: number; cls: string }[]>([])
export const [coreRows, setCoreRows] = createState<{ idx: number; h: number; cls: string }[][]>([])
export const [topProcs, setTopProcs] = createState<Array<{ name: string; pid: string; threads: string; cpu: string }>>([])
export const [topMemProcs, setTopMemProcs] = createState<Array<{ name: string; pid: string; vsize: string; size: string }>>([])
const MAX_GRAPH = 60
const INIT_GRAPH = (): number[] => new Array(MAX_GRAPH).fill(0)
export const [cpuGraphData, setCpuGraphData] = createState<number[]>(INIT_GRAPH())
export const [netDownGraphData, setNetDownGraphData] = createState<number[]>(INIT_GRAPH())
export const [netUpGraphData, setNetUpGraphData] = createState<number[]>(INIT_GRAPH())
export const [diskReadGraphData, setDiskReadGraphData] = createState<number[]>(INIT_GRAPH())
export const [diskWriteGraphData, setDiskWriteGraphData] = createState<number[]>(INIT_GRAPH())

export const [memPerc, setMemPerc] = createState(0)
export const [memUsed, setMemUsed] = createState("0")
export const [memFree, setMemFree] = createState("0")
export const [memTotal, setMemTotal] = createState("0")
export const [memEasyFree, setMemEasyFree] = createState("0")
export const [swapPerc, setSwapPerc] = createState(0)
export const [swapUsed, setSwapUsed] = createState("0")
export const [swapFree, setSwapFree] = createState("0")
export const [swapMax, setSwapMax] = createState("0")

export const [gpuModel, setGpuModel] = createState("Loading...")
export const [gpuDriver, setGpuDriver] = createState("Loading...")
export const [gpuType, setGpuType] = createState("N/A")
export const [gpuMemUsed, setGpuMemUsed] = createState("0")
export const [gpuMemTotal, setGpuMemTotal] = createState("0")
export const [gpuFreqCur, setGpuFreqCur] = createState("N/A")
export const [gpuFreqMax, setGpuFreqMax] = createState("N/A")
export const [gpuTemp, setGpuTemp] = createState("N/A")

export const [netIface, setNetIface] = createState(defaultInterface)
export const [netStatus, setNetStatus] = createState("OFFLINE")
export const [netSSID, setNetSSID] = createState("N/A")
export const [netBitrate, setNetBitrate] = createState("N/A")
export const [netSignal, setNetSignal] = createState("0")
export const [netDownSpeed, setNetDownSpeed] = createState(0)
export const [netUpSpeed, setNetUpSpeed] = createState(0)
export const [netDownTotal, setNetDownTotal] = createState("0")
export const [netUpTotal, setNetUpTotal] = createState("0")
export const [netLocalIp, setNetLocalIp] = createState("N/A")
export const [netLatency, setNetLatency] = createState("N/A")
export const [netLoss, setNetLoss] = createState("0")
export const [netJitter, setNetJitter] = createState("N/A")
export const [netISP, setNetISP] = createState("N/A")
export const [netConnections, setNetConnections] = createState("0")
export const [netInbound, setNetInbound] = createState("0")
export const [netOutbound, setNetOutbound] = createState("0")

export const [diskUsed, setDiskUsed] = createState("0")
export const [diskFree, setDiskFree] = createState("0")
export const [diskTotal, setDiskTotal] = createState("0")
export const [diskPerc, setDiskPerc] = createState(0)
export const [diskReadSpeed, setDiskReadSpeed] = createState(0)
export const [diskWriteSpeed, setDiskWriteSpeed] = createState(0)
export const [storageDevices, setStorageDevices] = createState("Loading...")

export const [batteryPerc, setBatteryPerc] = createState(-1)
export const [batteryStatus, setBatteryStatus] = createState("N/A")
export const [batteryTech, setBatteryTech] = createState("N/A")
export const [batteryEnergy, setBatteryEnergy] = createState("N/A")
export const [batteryEnergyFull, setBatteryEnergyFull] = createState("N/A")
export const [batteryTime, setBatteryTime] = createState("N/A")

export const [kernel, setKernel] = createState("Loading...")
export const [uptime, setUptime] = createState("N/A")

/** Flips true once the one-time hardware discovery finishes. */
export const [hwReady, setHwReady] = createState(false)

let prevCpuIdle = 0, prevCpuTotal = 0
let prevCoreIdle: number[] = []
let prevCoreTotal: number[] = []
let _prevRx = 0, _prevTx = 0, _prevDiskRead = 0, _prevDiskWrite = 0
const NCPUS = (() => {
  try { return GLib.get_num_processors() || 1 } catch { return 1 }
})()
let _batteryPath = ""
let _card = ""
let _vendor = ""
const _thermalTypes: string[] = []

const cpuGraphBuf: number[] = INIT_GRAPH()
const netDownGraphBuf: number[] = INIT_GRAPH()
const netUpGraphBuf: number[] = INIT_GRAPH()
const diskReadGraphBuf: number[] = INIT_GRAPH()
const diskWriteGraphBuf: number[] = INIT_GRAPH()
function pushGraphBuf(buf: number[], val: number, setter: (v: number[]) => void) {
  buf.push(val)
  buf.shift()
  setter([...buf])
}

function calcCpuPerc(stat: string): number {
  if (!stat) return 0
  const parts = stat.split("\n")[0].trim().split(/\s+/)
  const vals = parts.slice(1).map(Number)
  if (vals.length < 4) return 0
  const idle = vals[3] + (vals[4] || 0)
  const total = vals.reduce((a, b) => a + b, 0)
  if (prevCpuTotal === 0) { prevCpuIdle = idle; prevCpuTotal = total; return 0 }
  const dIdle = idle - prevCpuIdle
  const dTotal = total - prevCpuTotal
  prevCpuIdle = idle; prevCpuTotal = total
  return dTotal ? Math.round((1 - dIdle / dTotal) * 100) : 0
}

function calcCorePercs(stat: string): number[] {
  if (!stat) return []
  const cores: number[] = []
  const idle: number[] = []
  const total: number[] = []
  for (const line of stat.split("\n")) {
    if (!line.startsWith("cpu") || line.startsWith("cpu ")) continue
    const vals = line.trim().split(/\s+/).slice(1).map(Number)
    if (vals.length >= 4) {
      idle.push(vals[3] + (vals[4] || 0))
      total.push(vals.reduce((a, b) => a + b, 0))
    }
  }
  if (prevCoreIdle.length === 0 || prevCoreTotal.length === 0 || prevCoreIdle.length !== idle.length) {
    prevCoreIdle = idle; prevCoreTotal = total; return idle.map(() => 0)
  }
  for (let i = 0; i < idle.length; i++) {
    const dIdle = idle[i] - prevCoreIdle[i]
    const dTotal = total[i] - prevCoreTotal[i]
    cores.push(dTotal ? Math.round((1 - dIdle / dTotal) * 100) : 0)
  }
  prevCoreIdle = idle; prevCoreTotal = total
  return cores
}

function parseMem() {
  const mem = readSys("/proc/meminfo")
  if (!mem) return
  const d: Record<string, number> = {}
  for (const l of mem.split("\n")) { const m = l.match(/^(\w+):\s+(\d+)/); if (m) d[m[1]] = parseInt(m[2]) * 1024 }
  if (!d.MemTotal) return
  const total = d.MemTotal
  const free = d.MemFree + (d.Buffers || 0) + (d.Cached || 0)
  const used = total - free
  const perc = Math.round((used / total) * 100)
  setIfChanged(memPerc, setMemPerc, perc); setMemTotal(formatBytes(total)); setMemUsed(formatBytes(used)); setMemFree(formatBytes(free))
  setMemEasyFree(formatBytes(free + (d.SReclaimable || 0)))
  if (d.SwapTotal && d.SwapTotal > 0) {
    const su = d.SwapTotal - d.SwapFree
    setIfChanged(swapPerc, setSwapPerc, Math.round((su / d.SwapTotal) * 100))
    setSwapUsed(formatBytes(su)); setSwapFree(formatBytes(d.SwapFree)); setSwapMax(formatBytes(d.SwapTotal))
  }
}

function findBattery(): string {
  for (const e of listDir("/sys/class/power_supply")) {
    if (readSys(`/sys/class/power_supply/${e}/type`) === "Battery")
      return `/sys/class/power_supply/${e}`
  }
  return ""
}

/** The DRM card's sysfs path plus its PCI address (e.g. `0000:00:02.0`). */
function findDrmCard(): { path: string; pci: string } | null {
  for (let i = 0; i < 8; i++) {
    const base = `/sys/class/drm/card${i}`
    if (!readSys(`${base}/device/vendor`)) continue
    let pci = ""
    try {
      const name = (GLib.file_read_link(`${base}/device`) || "").split("/").pop() || ""
      if (/^[0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-9a-f]$/i.test(name)) pci = name
    } catch { /* no PCI address exposed */ }
    return { path: base, pci }
  }
  return null
}

/** Kernel driver bound to a PCI device, via its `device/driver` symlink. */
function readDriverName(devicePath: string): string {
  try {
    const link = GLib.file_read_link(`${devicePath}/driver`) || ""
    return link.split("/").filter(Boolean).pop() || ""
  } catch { return "" }
}

const GPU_THERMAL_HINTS = ["amdgpu", "i915", "nouveau", "nvidia", "x86_pkg_temp"]

function readGpuThermal(): number | null {
  for (const entry of listDir("/sys/class/thermal")) {
    if (!entry.startsWith("thermal_zone")) continue
    const base = `/sys/class/thermal/${entry}`
    const type = readSys(`${base}/type`).toLowerCase()
    if (!GPU_THERMAL_HINTS.some(h => type.includes(h))) continue
    const t = parseFloat(readSys(`${base}/temp`))
    if (Number.isFinite(t)) return t / 1000
  }
  return null
}

let _gpuBusy = false

async function collectGpuAsync(): Promise<void> {
  if (!_card || _gpuBusy) return
  _gpuBusy = true
  try {
    const cur = readSys(`${_card}/gt_cur_freq_mhz`) || readSys(`${_card}/gt_act_freq_mhz`) || ""
    if (cur) setGpuFreqCur(cur.trim())
    if (_vendor === "0x10de") {
      const smi = await execAsyncFast([
        "nvidia-smi", "--query-gpu=memory.used,memory.total",
        "--format=csv,noheader,nounits",
      ])
      const m = smi.match(/([\d.]+),\s*([\d.]+)/)
      if (m) { setGpuMemUsed(m[1]); setGpuMemTotal(m[2]) }
    } else if (_vendor === "0x1002") {
      const vramUsed = readSys(`${_card}/device/mem_info_vram_used`)
      if (vramUsed) setGpuMemUsed(String(Math.round(parseInt(vramUsed) / 1048576)))
    }
    const t = readGpuThermal()
    if (t !== null) setGpuTemp(String(Math.round(t)))
  } catch (e) { console.error("collect gpu:", e) }
  finally { _gpuBusy = false }
}

// ── Push battery updates from UPower signals (no poll) ──
let upClient: any = null
try { upClient = UPower.Client.new() } catch { upClient = null }
const _UP_BATTERY_KIND = Number((UPower as any)?.DeviceKind?.BATTERY ?? 2)
const _hookedBatteries = new Set<object>()
let _upBattery: any = null

function upStateLabel(state: number): string {
  switch (state) {
    case 1: return "Charging"
    case 2: return "Discharging"
    case 3: return "Empty"
    case 4: return "Full"
    case 5: return "Not charging"
    case 6: return "Discharging"
    default: return "Unknown"
  }
}

function formatUpTime(secs: number): string {
  const h = secs / 3600
  return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`
}

function isUpBattery(d: any): boolean {
  try {
    if (Number(d.kind) !== _UP_BATTERY_KIND) return false
    if (d.is_present === false) return false
    return true
  } catch { return false }
}

function findUpowerBattery(): any {
  if (!upClient) return null
  try {
    if (_upBattery && isUpBattery(_upBattery)) return _upBattery
  } catch { /* stale ref */ }
  _upBattery = null
  try {
    // get_devices() keeps objects alive; get_devices2() hands back
    // already-finalized wrappers on this UPower, so avoid it.
    const devs: any[] = upClient.get_devices?.() ?? []
    for (const d of devs || []) {
      if (isUpBattery(d)) { _upBattery = d; return d }
    }
  } catch { /* ignore */ }
  try {
    const disp = upClient.get_display_device?.()
    if (disp && isUpBattery(disp)) { _upBattery = disp; return disp }
  } catch { /* ignore */ }
  return null
}

function readBatteryFullWh(base: string): string {
  const ef = readSys(`${base}/energy_full`)
  if (ef) {
    const n = parseInt(ef)
    if (Number.isFinite(n) && n > 0) return (n / 1000000).toFixed(2)
  }
  // Some batteries only expose charge in µAh; convert with the measured or
  // design voltage: Wh = µAh × µV / 1e12.
  const cf = readSys(`${base}/charge_full`)
  const volt = readSys(`${base}/voltage_now`) || readSys(`${base}/voltage_min_design`)
  const c = parseInt(cf)
  const v = parseInt(volt)
  if (Number.isFinite(c) && c > 0 && Number.isFinite(v) && v > 0) return ((c * v) / 1e12).toFixed(2)
  return ""
}

function hookBatterySignals(b: any) {
  try {
    if (_hookedBatteries.has(b)) return
    _hookedBatteries.add(b)
    const resync = () => syncBattery(b)
    for (const sig of ["notify::percentage", "notify::state", "notify::energy", "notify::energy-full", "notify::time-to-empty", "notify::time-to-full"]) {
      try { b.connect(sig, resync) } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

function syncBattery(dev?: any) {
  try {
    let b: any = dev
    if (b && !isUpBattery(b)) b = null
    if (!b) b = findUpowerBattery()
    if (!b) {
      try {
        if (!_batteryPath) _batteryPath = findBattery()
        if (_batteryPath) {
          const cap = readSys(`${_batteryPath}/capacity`)
          if (cap) setIfChanged(batteryPerc, setBatteryPerc, parseInt(cap) || 0)
          const st = readSys(`${_batteryPath}/status`)
          if (st) setIfChanged(batteryStatus, setBatteryStatus, st)
          const fullWh = readBatteryFullWh(_batteryPath)
          if (fullWh) setIfChanged(batteryEnergyFull, setBatteryEnergyFull, fullWh)
          if (cap || st) return
        }
      } catch { /* sysfs fallback best-effort */ }
      setIfChanged(batteryPerc, setBatteryPerc, -1); return
    }
    hookBatterySignals(b)
    setIfChanged(batteryPerc, setBatteryPerc, Math.round(Number(b.percentage) || 0))
    setIfChanged(batteryStatus, setBatteryStatus, upStateLabel(Number(b.state)))
    const energy = Number(b.energy)
    if (Number.isFinite(energy)) setIfChanged(batteryEnergy, setBatteryEnergy, energy.toFixed(2))
    const energyFull = Number(b.energy_full)
    if (Number.isFinite(energyFull) && energyFull > 0) {
      setIfChanged(batteryEnergyFull, setBatteryEnergyFull, energyFull.toFixed(2))
    }
    const state = Number(b.state)
    const tte = Number(b.time_to_empty) || 0
    const ttf = Number(b.time_to_full) || 0
    if (state === 2 && tte > 0) setIfChanged(batteryTime, setBatteryTime, formatUpTime(tte))
    else if ((state === 1 || state === 5) && ttf > 0) setIfChanged(batteryTime, setBatteryTime, formatUpTime(ttf))
    else if (tte > 0) setIfChanged(batteryTime, setBatteryTime, formatUpTime(tte))
    else if (ttf > 0) setIfChanged(batteryTime, setBatteryTime, formatUpTime(ttf))
  } catch (e) { console.error("battery sync:", e) }
}

if (upClient) {
  try { upClient.connect("device-changed", (_c: any, dev: any) => syncBattery(dev)) } catch { /* no device-changed on this UPower: per-device notify covers changes */ }
  try { upClient.connect("device-added", (_c: any, dev: any) => { _upBattery = null; syncBattery(dev) }) } catch { /* older UPower without device-added */ }
  try { upClient.connect("device-removed", () => { _upBattery = null; syncBattery() }) } catch { /* older UPower without device-removed */ }
}
syncBattery()

function collectNet() {
  const iface = netIface()
  setNetStatus(readSys(`/sys/class/net/${iface}/operstate`) === "up" ? "ONLINE" : "OFFLINE")
  const dev = readSys("/proc/net/dev")
  if (!dev) return
  for (const l of dev.split("\n")) {
    if (!l.trim().startsWith(iface + ":")) continue
    const p = l.trim().split(/\s+/)
    const rx = parseInt(p[1]) || 0; const tx = parseInt(p[9]) || 0
    if (_prevRx === 0) { _prevRx = rx; _prevTx = tx; return }
    setIfChanged(netDownSpeed, setNetDownSpeed, Math.max(0, Math.round((rx - _prevRx) / 1024)))
    setIfChanged(netUpSpeed, setNetUpSpeed, Math.max(0, Math.round((tx - _prevTx) / 1024)))
    setNetDownTotal((rx / 1073741824).toFixed(2) + "GiB")
    setNetUpTotal((tx / 1073741824).toFixed(2) + "GiB")
    _prevRx = rx; _prevTx = tx
    break
  }
  const wl = readSys("/proc/net/wireless")
  if (wl) {
    for (const l of wl.split("\n")) {
      if (!l.trim().startsWith(iface + ":")) continue
      const p = l.trim().split(/\s+/)
      if (p.length >= 4) {
        const link = parseInt(p[2]) || 0
        setNetSignal(`${link}/70`)
      }
      break
    }
  }
}

let _netInfoBusy = false

async function collectNetInfoAsync(): Promise<void> {
  if (_netInfoBusy) return
  _netInfoBusy = true
  try {
    const iface = netIface()
    // `iw link` alone prints usage on some iw builds; `iw dev <if> link`
    // always works and reports the negotiated tx bitrate in a stable format.
    const [ssid, link, addr] = await Promise.all([
      execAsyncFast(["iwgetid", "-r", iface]),
      execAsyncFast(["iw", "dev", iface, "link"]),
      execAsyncFast(["ip", "-4", "addr", "show", iface]),
    ])

    const name = ssid.trim()
    if (name) setNetSSID(name)

    const rate = link.match(/tx bitrate:\s*([\d.]+)\s*(M|K|G)Bit\/s/i)
    if (rate) {
      const mul = rate[2].toUpperCase() === "G" ? 1000 : rate[2].toUpperCase() === "K" ? 0.001 : 1
      const mbit = parseFloat(rate[1]) * mul
      setNetBitrate(`${mbit.toFixed(mul === 1 ? 1 : 2)} Mb/s`)
    }

    const ip = addr.match(/inet\s+([\d.]+)/)
    setNetLocalIp(ip ? ip[1] : "N/A")
  } catch (e) { console.error("collect net info:", e) }
  finally { _netInfoBusy = false }
}

function collectNetConns() {
  const tcp = readSys("/proc/net/tcp")
  if (!tcp) return
  let total = 0, inbound = 0, outbound = 0
  for (const l of tcp.split("\n")) {
    const p = l.trim().split(/\s+/)
    if (p.length < 4 || p[0] === "sl") continue
    total++
    const localPort = parseInt(p[1].split(":")[1], 16)
    if (localPort <= 32767) inbound++
    else outbound++
  }
  setNetConnections(String(total))
  setNetInbound(String(inbound))
  setNetOutbound(String(outbound))
}

let _pingTime = 0
let _pingBusy = false
const PING_INTERVAL = 15000

export async function collectNetPingAsync(): Promise<void> {
  if (_pingBusy) return
  try { if (!getNetworkAvailable()) return } catch { /* assume online */ }
  const now = Date.now()
  if (now - _pingTime < PING_INTERVAL) return
  _pingTime = now
  _pingBusy = true
  try {
    // `-w` caps the whole run at 2s. `ping` exits non-zero on partial packet
    // loss but still prints valid rtt/loss figures, so the stdout is read
    // regardless of the exit status.
    const { out } = await execAsyncRaw(["ping", "-c", "2", "-w", "2", "-q", "8.8.8.8"])
    if (!out) { setNetLatency("N/A"); setNetLoss("100"); setNetJitter("0.00"); return }
    const lossM = out.match(/([\d.]+)% packet loss/)
    const rttM = out.match(/[\d.]+\/([\d.]+)\/[\d.]+\/([\d.]+)/)
    if (lossM) setNetLoss(lossM[1])
    if (rttM) {
      setNetLatency(`${rttM[1]}ms ± ${rttM[2]}ms`)
      setNetJitter(rttM[2])
    } else {
      setNetLatency("N/A"); setNetJitter("0.00")
    }
  } catch (e) { console.error("ping:", e) }
  finally { _pingBusy = false }
}

/** Kept for src/Network.tsx, which fires this when connectivity returns. */
export function collectNetPing(): void {
  void collectNetPingAsync()
}

function collectDiskSpeeds() {
  const stat = readSys("/proc/diskstats")
  if (stat) {
    for (const l of stat.split("\n")) {
      const p = l.trim().split(/\s+/)
      if (p.length >= 14 && p[2] !== "loop" && !p[2].startsWith("ram") && !p[2].startsWith("zram") && /^[a-z]/.test(p[2])) {
        const r = parseInt(p[5]) || 0; const w = parseInt(p[9]) || 0
        if (_prevDiskRead === 0) { _prevDiskRead = r; _prevDiskWrite = w; break }
        setIfChanged(diskReadSpeed, setDiskReadSpeed, Math.max(0, Math.round((r - _prevDiskRead) * 512 / 1024)))
        setIfChanged(diskWriteSpeed, setDiskWriteSpeed, Math.max(0, Math.round((w - _prevDiskWrite) * 512 / 1024)))
        _prevDiskRead = r; _prevDiskWrite = w; break
      }
    }
  }
}

async function collectDiskUsage(): Promise<void> {
  // `-P -B1` gives POSIX one-line-per-filesystem output in raw bytes, so the
  // numbers can be formatted with the same helper the memory rows use.
  const out = await execAsyncFast(["df", "-P", "-B1", "/"])
  if (!out) return
  const line = out.split("\n").find(l => l.trim().endsWith(" /")) || ""
  const p = line.trim().split(/\s+/)
  if (p.length < 6) return
  setDiskTotal(formatBytes(parseInt(p[1]) || 0))
  setDiskUsed(formatBytes(parseInt(p[2]) || 0))
  setDiskFree(formatBytes(parseInt(p[3]) || 0))
  setIfChanged(diskPerc, setDiskPerc, parseInt(p[4].replace("%", "")) || 0)
}

function collectSys() {
  const ut = readSys("/proc/uptime")
  if (ut) { const s = parseInt(ut.split(" ")[0]); const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60); setUptime(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`) }
}

function collectTemps() {
  for (let i = 0; i < _thermalTypes.length; i++) {
    const raw = readSys(`/sys/class/thermal/thermal_zone${i}/temp`)
    if (raw) {
      const t = parseFloat(raw) / 1000
      const tl = _thermalTypes[i]
      if (tl.includes("x86_pkg") || tl.includes("cpu")) setCpuTemp(String(Math.round(t)))
      else if (tl.includes("acpitz")) { if (cpuTemp() === "N/A") setCpuTemp(String(Math.round(t))) }
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + "GiB"
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + "MiB"
  return (bytes / 1024).toFixed(0) + " KiB"
}

export function formatSpeed(kib: number): string {
  if (kib >= 1048576) return (kib / 1048576).toFixed(2) + "GiB/s"
  if (kib >= 1024) return (kib / 1024).toFixed(1) + "MiB/s"
  return Math.round(kib) + "KiB/s"
}

const TOP_N = 10

interface ParsedProc {
  pid: string
  threads: string
  cpuNum: number
  cpu: string
  memNum: number
  vsize: string
  size: string
  name: string
}

// One ps invocation feeds both the CPU and the Memory task tables.
//
// Both lists are cut from the same snapshot, so the two tables can never
// disagree with each other, and we fork ps once per tick instead of twice.
async function collectProcesses(): Promise<void> {
  if (!visible.has("CpuBox") && !visible.has("MemoryBox")) return

  // No --sort: letting procps sort forces it to materialise and sort the whole
  // table before printing, and (see below) it makes ps far more likely to
  // report a bogus CPU figure for itself. Sorting 300 parsed rows here is
  // microseconds and keeps the columns identical between the two tables.
  const out = await execAsyncFast([
    "ps", "-eo", "pid,nlwp,%cpu,%mem,vsize,rss,comm", "--no-headers",
  ])
  if (!out) return

  const procs: ParsedProc[] = []
  for (const line of out.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 7) continue

    // comm is the last column and may itself contain spaces
    const name = parts.slice(6).join(" ") || "?"

    // ps reports its %CPU as (its own CPU time) / (its own elapsed time).
    // Because it lives for only a few milliseconds that ratio is a multiple of
    // a whole core — measured on this box, 13 of 25 invocations claimed 100% or
    // 200% — and with --sort=-%cpu it therefore put itself at the top of the
    // very table we were about to read. Never surface the collector or its
    // helpers; they are measurement artefacts, not real load.
    if (name === "ps" || name === "top" || name === "sleep") continue

    const cpuNum = parseFloat(parts[2]) || 0
    const memNum = parseFloat(parts[3]) || 0
    const vsizeKB = parseInt(parts[4]) || 0
    const rssKB = parseInt(parts[5]) || 0

    procs.push({
      pid: parts[0] || "",
      threads: parts[1] || "0",
      cpuNum,
      // normalise across cores: ps reports up to 100 * NCPUS
      cpu: (cpuNum / NCPUS).toFixed(1),
      memNum,
      vsize: vsizeKB > 0 ? formatBytes(vsizeKB * 1024) : "0",
      size: rssKB > 0 ? formatBytes(rssKB * 1024) : "0",
      name,
    })
  }
  if (!procs.length) return

  if (visible.has("CpuBox")) {
    procs.sort((a, b) => b.cpuNum - a.cpuNum)
    setTopProcs(procs.slice(0, TOP_N).map((p) => ({
      pid: p.pid,
      name: p.name,
      threads: p.threads,
      cpu: p.cpu,
    })))
  }

  if (visible.has("MemoryBox")) {
    procs.sort((a, b) => b.memNum - a.memNum)
    setTopMemProcs(procs.slice(0, TOP_N).map((p) => ({
      pid: p.pid,
      name: p.name,
      vsize: p.vsize,
      size: p.size,
    })))
  }
}

// tick A (offset 0ms): cpu stat + mem + sys
function fastUpdateA() {
  try {
    const stat = readSys("/proc/stat")
    const p = calcCpuPerc(stat)
    setIfChanged(cpuPerc, setCpuPerc, p)
    setIfChanged(cpuPercNorm, setCpuPercNorm, p / 100)
    pushGraphBuf(cpuGraphBuf, p, setCpuGraphData)
    const cores = calcCorePercs(stat)
    setCorePercs(cores)
    const bars = cores.map((c, idx) => ({
      idx, h: Math.max(1, Math.round((c / 100) * 20)),
      cls: c >= 85 ? "cpu-yellow" : "cpu-white",
    }))
    setCoreBars(bars)
    const rows: typeof bars[] = []
    for (let i = 0; i < Math.min(bars.length, 32); i += 8) {
      rows.push(bars.slice(i, i + 8))
      if (rows.length >= 4) break
    }
    setCoreRows(rows)
    collectSys()
    parseMem()
  } catch (e) { console.error("fast update A:", e) }
}

// tick B (offset 500ms): net + disk speeds + graph pushes
function fastUpdateB() {
  try {
    collectNet()
    collectDiskSpeeds()
    pushGraphBuf(netDownGraphBuf, netDownSpeed(), setNetDownGraphData)
    pushGraphBuf(netUpGraphBuf, netUpSpeed(), setNetUpGraphData)
    pushGraphBuf(diskReadGraphBuf, diskReadSpeed(), setDiskReadGraphData)
    pushGraphBuf(diskWriteGraphBuf, diskWriteSpeed(), setDiskWriteGraphData)
  } catch (e) { console.error("fast update B:", e) }
}

let _fetching = false

async function slowUpdate(): Promise<void> {
  if (_fetching) return
  _fetching = true
  try {
    if (visible.has("CpuBox") || visible.has("SystemBox")) {
      collectTemps()
      const f = readSys("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq")
      if (f) setCpuFreq((parseInt(f) / 1000000).toFixed(1) + "GHz")
      const l = readSys("/proc/loadavg")
      if (l) setCpuLoads(l.split(" ").slice(0, 3).join(" "))
    }
    if (visible.has("GpuBox")) await collectGpuAsync()
    if (visible.has("NetworkBox")) {
      collectNetConns()
      await collectNetInfoAsync()
    }
    if (visible.has("CpuBox") || visible.has("MemoryBox")) {
      await collectProcesses()
    }
  } catch (e) { console.error("slow update:", e) }
  finally { _fetching = false }
}

async function verySlowUpdate() {
  try {
    if (!visible.has("MemoryBox")) return
    await collectDiskUsage()
  } catch (e) { console.error("very slow update:", e) }
}

// ── One-time hardware discovery ──
// Everything here runs off the critical path: the module finishes evaluating
// with "Loading..." placeholders in place and the UI paints immediately.
async function initHardwareAsync(): Promise<void> {
  const _bp = findBattery()
  if (_bp) {
    _batteryPath = _bp
    setBatteryTech(readSys(`${_bp}/technology`) || "N/A")
    const fullWh = readBatteryFullWh(_bp)
    if (fullWh) setBatteryEnergyFull(fullWh)
  }

  const release = readSys("/proc/sys/kernel/osrelease")
  setKernel(release ? `Linux ${release}` : "N/A")

  const model = readSys("/proc/cpuinfo").match(/^model name\s*:\s*(.+)$/m)
  if (model) setCpuModel(model[1].trim())

  const mf = readSys("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq")
  if (mf) setCpuMaxFreq((parseInt(mf) / 1000000).toFixed(1) + "GHz")

  const card = findDrmCard()
  if (card) {
    _card = card.path
    _vendor = readSys(`${card.path}/device/vendor`) || ""
    const drv = readDriverName(`${card.path}/device`)
    if (drv) setGpuDriver(drv)
    const mf2 = readSys(`${card.path}/gt_max_freq_mhz`) || readSys(`${card.path}/gt_RP0_freq_mhz`) || ""
    if (mf2) setGpuFreqMax(mf2.trim())

    // A single `lspci -v` covers both the device name and, on Intel, the
    // prefetchable memory window.
    let info = ""
    if (card.pci) info = await execAsyncFast(["lspci", "-v", "-s", card.pci])
    const name = info.match(/VGA compatible controller:\s*(.+)/i)
    if (name) setGpuModel(name[1].replace(/\s*\(rev.*$/i, "").trim())

    if (_vendor === "0x8086") {
      setGpuType("Integrated")
      // Anchored on the bit width so the "non-prefetchable" BAR, which lspci
      // prints first, is not mistaken for the shared-memory window.
      const mem = info.match(/\(\d+-bit, prefetchable\)\s*\[size=([\d.]+[KMGT]?)\]/i)
      setGpuMemUsed("N/A")
      setGpuMemTotal(mem ? mem[1] : "N/A")
    } else if (_vendor === "0x10de") {
      setGpuType("Discrete")
    } else if (_vendor === "0x1002") {
      setGpuType("Discrete")
      const vt = readSys(`${card.path}/device/mem_info_vram_total`)
      if (vt) setGpuMemTotal(String(Math.round(parseInt(vt) / 1048576)))
    }
  }

  for (let i = 0; i < 10; i++) {
    const typ = readSys(`/sys/class/thermal/thermal_zone${i}/type`)
    if (!typ) break
    _thermalTypes.push(typ.trim().toLowerCase())
  }

  const blocks = await execAsyncFast(["lsblk", "-ro", "NAME,SIZE,TYPE,MOUNTPOINTS"])
  setStorageDevices(formatLsblk(blocks) || "N/A")

  // Temperatures and GPU stats depend on the discovery above
  collectTemps()
  await collectGpuAsync()
  setHwReady(true)
}

interval(1000, fastUpdateA)
timeout(500, () => interval(1000, fastUpdateB))
interval(5000, () => { slowUpdate().catch((e) => console.error("slow update:", e)) })
interval(30000, () => { verySlowUpdate().catch((e) => console.error("very slow update:", e)) })
interval(PING_INTERVAL, collectNetPing)
fastUpdateA()
fastUpdateB()
initHardwareAsync().catch((e) => console.error("hardware init:", e))
slowUpdate().catch((e) => console.error("slow init:", e))
verySlowUpdate().catch((e) => console.error("very slow init:", e))
collectNetPing()
