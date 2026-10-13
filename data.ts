import { createState } from "ags"
import { interval, timeout } from "ags/time"
import { readFile, exec, setIfChanged, execAsyncFast } from "./src/util"
import UPower from "gi://UPowerGlib?version=1.0"
import { defaultInterface } from "./config"

function readSys(path: string): string {
  try { return readFile(path)?.trim() || "" }
  catch { return "" }
}

function run(cmd: string): string {
  try { return exec(["bash", "-c", cmd]) || "" }
  catch { return "" }
}

export const [cpuPerc, setCpuPerc] = createState(0)
export const [cpuPercNorm, setCpuPercNorm] = createState(0)
export const [cpuLoads, setCpuLoads] = createState("0.00 0.00 0.00")
export const [cpuModel, setCpuModel] = createState("N/A")
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

export const [gpuModel, setGpuModel] = createState("N/A")
export const [gpuDriver, setGpuDriver] = createState("N/A")
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
export const [storageDevices, setStorageDevices] = createState("")

export const [batteryPerc, setBatteryPerc] = createState(-1)
export const [batteryStatus, setBatteryStatus] = createState("N/A")
export const [batteryTech, setBatteryTech] = createState("N/A")
export const [batteryEnergy, setBatteryEnergy] = createState("N/A")
export const [batteryEnergyFull, setBatteryEnergyFull] = createState("N/A")
export const [batteryTime, setBatteryTime] = createState("N/A")

export const [kernel, setKernel] = createState("N/A")
export const [uptime, setUptime] = createState("N/A")

let prevCpuIdle = 0, prevCpuTotal = 0
let prevCoreIdle: number[] = []
let prevCoreTotal: number[] = []
let _prevRx = 0, _prevTx = 0, _prevDiskRead = 0, _prevDiskWrite = 0
const NCPUS = parseInt(run("nproc")) || 1
let _batteryPath = ""
let _card = ""
let _vendor = ""
const _thermalTypes: string[] = []

const cpuGraphBuf: number[] = INIT_GRAPH()
const netDownGraphBuf: number[] = INIT_GRAPH()
const netUpGraphBuf: number[] = INIT_GRAPH()
const diskReadGraphBuf: number[] = INIT_GRAPH()
const diskWriteGraphBuf: number[] = INIT_GRAPH()
function pushGraphBuf(buf: number[], val: number, get: () => number[], setter: (v: number[]) => void) {
  if (buf[buf.length - 1] === val) return
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
  const ls = exec("ls /sys/class/power_supply/ 2>/dev/null")
  for (const e of ls.split("\n")) {
    if (readSys(`/sys/class/power_supply/${e}/type`) === "Battery")
      return `/sys/class/power_supply/${e}`
  }
  return ""
}

function findDrmCard(): string {
  for (let i = 0; i < 8; i++) {
    const v = readSys(`/sys/class/drm/card${i}/device/vendor`)
    if (v) return `/sys/class/drm/card${i}`
  }
  return ""
}

function collectGpu() {
  if (!_card) return
  const cur = readSys(`${_card}/gt_cur_freq_mhz`) || readSys(`${_card}/gt_act_freq_mhz`) || ""
  if (cur) setGpuFreqCur(cur.trim())
  if (_vendor === "0x10de") {
    const smi = run("nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null").trim()
    const m = smi.match(/([\d.]+),\s*([\d.]+)/)
    if (m) { setGpuMemUsed(m[1]); setGpuMemTotal(m[2]) }
  } else if (_vendor === "0x1002") {
    const vramUsed = readSys(`${_card}/device/mem_info_vram_used`)
    if (vramUsed) setGpuMemUsed(String(Math.round(parseInt(vramUsed) / 1048576)))
  }
  const tz = run("for z in /sys/class/thermal/thermal_zone*; do [ -f $z/type ] && grep -qE 'amdgpu|i915|nouveau|nvidia|x86_pkg_temp' $z/type 2>/dev/null && cat $z/temp; done 2>/dev/null").trim()
  if (tz) { const t = parseFloat(tz.split("\n")[0]) / 1000; setGpuTemp(String(Math.round(t))) }
}

// ── Push battery updates from UPower signals (no poll) ──
const upClient = UPower.Client.new()
const _UP_BATTERY_KIND = Number((UPower as any)?.DeviceKind?.BATTERY ?? 2)
const _hookedBatteryIds = new Set<string>()
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

function hookBatterySignals(b: any) {
  try {
    const id = String(b.native_path ?? "")
    if (id && _hookedBatteryIds.has(id)) return
    if (id) _hookedBatteryIds.add(id)
    const resync = () => syncBattery(b)
    for (const sig of ["notify::percentage", "notify::state", "notify::energy", "notify::time-to-empty", "notify::time-to-full"]) {
      try { b.connect(sig, resync) } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

function syncBattery(dev?: any) {
  try {
    let b: any = dev
    if (b && !isUpBattery(b)) b = null
    if (!b) b = findUpowerBattery()
    if (!b) { setIfChanged(batteryPerc, setBatteryPerc, -1); return }
    hookBatterySignals(b)
    setIfChanged(batteryPerc, setBatteryPerc, Math.round(Number(b.percentage) || 0))
    setIfChanged(batteryStatus, setBatteryStatus, upStateLabel(Number(b.state)))
    const energy = Number(b.energy)
    if (Number.isFinite(energy)) setIfChanged(batteryEnergy, setBatteryEnergy, energy.toFixed(2))
    const state = Number(b.state)
    const tte = Number(b.time_to_empty) || 0
    const ttf = Number(b.time_to_full) || 0
    if (state === 2 && tte > 0) setIfChanged(batteryTime, setBatteryTime, formatUpTime(tte))
    else if ((state === 1 || state === 5) && ttf > 0) setIfChanged(batteryTime, setBatteryTime, formatUpTime(ttf))
    else if (tte > 0) setIfChanged(batteryTime, setBatteryTime, formatUpTime(tte))
    else if (ttf > 0) setIfChanged(batteryTime, setBatteryTime, formatUpTime(ttf))
  } catch (e) { console.error("battery sync:", e) }
}

try { upClient.connect("device-changed", (_c: any, dev: any) => syncBattery(dev)) } catch { /* no device-changed on this UPower: per-device notify covers changes */ }
upClient.connect("device-added", (_c: any, dev: any) => { _upBattery = null; syncBattery(dev) })
upClient.connect("device-removed", () => { _upBattery = null; syncBattery() })
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

function collectNetInfo() {
  const iface = netIface()
  const ssid = run(`iwgetid -r ${iface} 2>/dev/null`).trim()
  if (ssid) setNetSSID(ssid)
  const bitrate = run(`iwconfig ${iface} 2>/dev/null | grep -o 'Bit Rate[=:][0-9.]*' | grep -o '[0-9.]*'`).trim()
  if (bitrate) setNetBitrate(bitrate + " Mb/s")
  setNetLocalIp(run(`ip -4 addr show ${iface} 2>/dev/null | grep inet | awk '{print $2}' | cut -d/ -f1`).trim() || "N/A")
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

let _pingCache = { time: 0, latency: "N/A", loss: "0", jitter: "N/A" }
const PING_INTERVAL = 15000

function collectNetPing() {
  const now = Date.now()
  if (now - _pingCache.time < PING_INTERVAL) return
  _pingCache.time = now
  const out = run('ping -c 3 -q 8.8.8.8 2>/dev/null')
  if (!out) { setNetLatency("N/A"); setNetLoss("100"); setNetJitter("0.00"); return }
  const lossM = out.match(/([\d.]+)% packet loss/)
  const rttM = out.match(/[\d.]+\/([\d.]+)\/[\d.]+\/([\d.]+)/)
  if (lossM) { setNetLoss(lossM[1]); _pingCache.loss = lossM[1] }
  if (rttM) {
    setNetLatency(`${rttM[1]}ms ± ${rttM[2]}ms`)
    setNetJitter(rttM[2])
    _pingCache.latency = `${rttM[1]}ms ± ${rttM[2]}ms`
    _pingCache.jitter = rttM[2]
  } else {
    setNetLatency("N/A"); setNetJitter("0.00")
  }
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

async function collectDiskUsage() {
  const df = (await execAsyncFast(["bash", "-c", "df -h / 2>/dev/null | tail -1"])).trim()
  if (df) {
    const p = df.split(/\s+/)
    if (p.length >= 6) { setDiskTotal(p[1]); setDiskUsed(p[2]); setDiskFree(p[3]); setIfChanged(diskPerc, setDiskPerc, parseInt(p[4].replace("%", "")) || 0) }
  }
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

async function collectTopProcs() {
  const out = await execAsyncFast(["bash", "-c", "ps -eo pid,nlwp,%cpu,comm --sort=-%cpu --no-headers | head -10"])
  if (!out) return
  const lines = out.split("\n").filter(l => l.trim())
  setTopProcs(lines.map(line => {
    const parts = line.trim().split(/\s+/)
    const pid = parts[0]
    const threads = parts[1]
    const cpu = (parseFloat(parts[2]) / NCPUS).toFixed(1)
    const name = parts.slice(3).join(" ") || "?"
    return { pid: pid || "", name, threads: threads || "0", cpu: cpu || "0" }
  }))
}

async function collectTopMemProcs() {
  const out = await execAsyncFast(["bash", "-c", "ps -eo pid,%mem,vsize,rss,comm --sort=-%mem --no-headers | head -10"])
  if (!out) return
  const lines = out.split("\n").filter(l => l.trim())
  setTopMemProcs(lines.map(line => {
    const parts = line.trim().split(/\s+/)
    const pid = parts[0]
    const vsizeKB = parseInt(parts[2]) || 0
    const rssKB = parseInt(parts[3]) || 0
    const name = parts.slice(4).join(" ") || "?"
    return {
      pid: pid || "",
      name,
      vsize: vsizeKB > 0 ? formatBytes(vsizeKB * 1024) : "0",
      size: rssKB > 0 ? formatBytes(rssKB * 1024) : "0",
    }
  }))
}

// tick A (offset 0ms): cpu stat + mem + sys
function fastUpdateA() {
  try {
    const stat = readSys("/proc/stat")
    const p = calcCpuPerc(stat)
    setIfChanged(cpuPerc, setCpuPerc, p)
    setIfChanged(cpuPercNorm, setCpuPercNorm, p / 100)
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
    pushGraphBuf(cpuGraphBuf, cpuPerc(), cpuGraphData, setCpuGraphData)
    pushGraphBuf(netDownGraphBuf, netDownSpeed(), netDownGraphData, setNetDownGraphData)
    pushGraphBuf(netUpGraphBuf, netUpSpeed(), netUpGraphData, setNetUpGraphData)
    pushGraphBuf(diskReadGraphBuf, diskReadSpeed(), diskReadGraphData, setDiskReadGraphData)
    pushGraphBuf(diskWriteGraphBuf, diskWriteSpeed(), diskWriteGraphData, setDiskWriteGraphData)
  } catch (e) { console.error("fast update B:", e) }
}

let _fetching = false

async function slowUpdate() {
  if (_fetching) return
  _fetching = true
  try {
    collectTemps()
    collectGpu()
    collectNetConns()
    await collectTopProcs()
    await collectTopMemProcs()
    collectNetInfo()
    const f = readSys("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq")
    if (f) setCpuFreq((parseInt(f) / 1000000).toFixed(1) + "GHz")
    const l = readSys("/proc/loadavg")
    if (l) setCpuLoads(l.split(" ").slice(0, 3).join(" "))
  } catch (e) { console.error("slow update:", e) }
  finally { _fetching = false }
}

async function verySlowUpdate() {
  try {
    await collectDiskUsage()
  } catch (e) { console.error("very slow update:", e) }
}

// ── One-time hardware discovery ──
{
  const _bp = findBattery()
  if (_bp) {
    _batteryPath = _bp
    setBatteryTech(readSys(`${_bp}/technology`) || "N/A")
    const full = readSys(`${_bp}/energy_full`) || readSys(`${_bp}/charge_full`) || "1"
    setBatteryEnergyFull((parseInt(full) / 1000000).toFixed(2))
  }
  setKernel(run("uname -sr").trim())
  const cm = run("grep 'model name' /proc/cpuinfo | head -1 | sed 's/.*: //'").trim()
  if (cm) setCpuModel(cm)
  const mf = readSys("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq")
  if (mf) setCpuMaxFreq((parseInt(mf) / 1000000).toFixed(1) + "GHz")
  const c = findDrmCard()
  if (c) {
    _card = c
    const v = readSys(`${c}/device/vendor`)
    if (v) _vendor = v
    const gn = run("lspci 2>/dev/null | grep -i vga | head -1 | sed 's/.*://' | sed 's/(.*//'").trim()
    if (gn) setGpuModel(gn)
    const drv = run("ls -d /sys/bus/pci/drivers/*/ 2>/dev/null | grep -E 'i915|amdgpu|nouveau|nvidia' | head -1 | xargs basename 2>/dev/null").trim()
    if (drv) setGpuDriver(drv)
    const mf2 = readSys(`${c}/gt_max_freq_mhz`) || readSys(`${c}/gt_RP0_freq_mhz`) || ""
    if (mf2) setGpuFreqMax(mf2.trim())
    if (_vendor === "0x8086") {
      setGpuType("Integrated")
      const mem = run("lspci -v -s $(lspci 2>/dev/null | grep -i vga | head -1 | cut -d' ' -f1) 2>/dev/null | grep 'prefetchable' | head -1 | sed 's/.*\\[size=//;s/\\].*//'").trim()
      if (mem) { setGpuMemUsed("N/A"); setGpuMemTotal(mem) }
      else { setGpuMemUsed("N/A"); setGpuMemTotal("N/A") }
    } else if (_vendor === "0x10de") {
      setGpuType("Discrete")
    } else if (_vendor === "0x1002") {
      setGpuType("Discrete")
      const vt = readSys(`${c}/device/mem_info_vram_total`)
      if (vt) setGpuMemTotal(String(Math.round(parseInt(vt) / 1048576)))
    }
  }
  for (let i = 0; i < 10; i++) {
    const typ = readSys(`/sys/class/thermal/thermal_zone${i}/type`)
    if (!typ) break
    _thermalTypes.push(typ.trim().toLowerCase())
  }
  setStorageDevices(run(`lsblk -ro NAME,SIZE,TYPE,MOUNTPOINTS 2>/dev/null | awk 'function d(n){r="";for(i=1;i<=n;i++)r=r"-";return r} $3=="disk"||$3=="rom"{n="->"$1;n=n d(17-length(n));print n"("$2")"} $3=="part"{mnt=$4;if(length(mnt)>20)mnt=substr(mnt,1,17)"...";n="  \\u2514--"$1;n=n d(17-length(n));l=n"("$2")";if(mnt){p=d(27-length(l));print l p"--" mnt}else print l}'`).trim())
}

interval(1000, fastUpdateA)
timeout(500, () => interval(1000, fastUpdateB))
interval(5000, () => { slowUpdate().catch((e) => console.error("slow update:", e)) })
interval(30000, () => { verySlowUpdate().catch((e) => console.error("very slow update:", e)) })
interval(PING_INTERVAL, collectNetPing)
fastUpdateA()
fastUpdateB()
slowUpdate().catch((e) => console.error("slow init:", e))
verySlowUpdate().catch((e) => console.error("very slow init:", e))
