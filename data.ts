import { createState } from "ags"
import { interval } from "ags/time"
import { readFile, exec } from "./src/util"
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
export const [batteryEnergyDesign, setBatteryEnergyDesign] = createState("N/A")
export const [batteryTime, setBatteryTime] = createState("N/A")

export const [kernel, setKernel] = createState("N/A")
export const [uptime, setUptime] = createState("N/A")
export const [nodename, setNodename] = createState("")

let prevCpuIdle = 0, prevCpuTotal = 0
let prevCoreIdle: number[] = []
let prevCoreTotal: number[] = []
let _prevRx = 0, _prevTx = 0, _prevDiskRead = 0, _prevDiskWrite = 0

function calcCpuPerc(): number {
  const stat = readSys("/proc/stat")
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

function calcCorePercs(): number[] {
  const stat = readSys("/proc/stat")
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
    prevCoreIdle = idle
    prevCoreTotal = total
    return idle.map(() => 0)
  }
  for (let i = 0; i < idle.length; i++) {
    const dIdle = idle[i] - prevCoreIdle[i]
    const dTotal = total[i] - prevCoreTotal[i]
    cores.push(dTotal ? Math.round((1 - dIdle / dTotal) * 100) : 0)
  }
  prevCoreIdle = idle
  prevCoreTotal = total
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
  setMemPerc(perc); setMemTotal(formatBytes(total)); setMemUsed(formatBytes(used)); setMemFree(formatBytes(free))
  setMemEasyFree(formatBytes(free + (d.SReclaimable || 0)))
  if (d.SwapTotal && d.SwapTotal > 0) {
    const su = d.SwapTotal - d.SwapFree
    setSwapPerc(Math.round((su / d.SwapTotal) * 100))
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
  const card = findDrmCard()
  if (!card) return
  const vendor = readSys(`${card}/device/vendor`)
  if (!vendor) return
  const name = run("lspci 2>/dev/null | grep -i vga | head -1 | sed 's/.*://' | sed 's/(.*//'").trim()
  if (name) setGpuModel(name)
  const drv = run("ls -d /sys/bus/pci/drivers/*/ 2>/dev/null | grep -E 'i915|amdgpu|nouveau|nvidia' | head -1 | xargs basename 2>/dev/null").trim()
  if (drv) setGpuDriver(drv)
  if (vendor === "0x8086") { setGpuType("Integrated")
    const mem = run("lspci -v -s $(lspci 2>/dev/null | grep -i vga | head -1 | cut -d' ' -f1) 2>/dev/null | grep 'prefetchable' | head -1 | sed 's/.*\\[size=//;s/\\].*//'").trim()
    if (mem) { setGpuMemUsed("N/A"); setGpuMemTotal(mem) }
    else { setGpuMemUsed("N/A"); setGpuMemTotal("N/A") }
  }
  else if (vendor === "0x10de") { setGpuType("Discrete")
    const smi = run("nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null").trim()
    const m = smi.match(/([\d.]+),\s*([\d.]+)/)
    if (m) { setGpuMemUsed(m[1]); setGpuMemTotal(m[2]) }
  }
  else if (vendor === "0x1002") { setGpuType("Discrete")
    const vramUsed = readSys(`${card}/device/mem_info_vram_used`)
    const vramTotal = readSys(`${card}/device/mem_info_vram_total`)
    if (vramUsed && vramTotal) {
      setGpuMemUsed(String(Math.round(parseInt(vramUsed) / 1048576)))
      setGpuMemTotal(String(Math.round(parseInt(vramTotal) / 1048576)))
    }
  }
  const cur = readSys(`${card}/gt_cur_freq_mhz`) || readSys(`${card}/gt_act_freq_mhz`) || ""
  const max = readSys(`${card}/gt_max_freq_mhz`) || readSys(`${card}/gt_RP0_freq_mhz`) || ""
  if (cur) setGpuFreqCur(cur.trim())
  if (max) setGpuFreqMax(max.trim())
  const tz = run("for z in /sys/class/thermal/thermal_zone*; do [ -f $z/type ] && grep -qE 'amdgpu|i915|nouveau|nvidia|x86_pkg_temp' $z/type 2>/dev/null && cat $z/temp; done 2>/dev/null").trim()
  if (tz) { const t = parseFloat(tz.split("\n")[0]) / 1000; setGpuTemp(String(Math.round(t))) }
}

function collectBattery() {
  const b = findBattery()
  if (!b) { setBatteryPerc(-1); return }
  setBatteryTech(readSys(`${b}/technology`) || "N/A")
  setBatteryStatus(readSys(`${b}/status`) || "N/A")
  const now = readSys(`${b}/energy_now`) || readSys(`${b}/charge_now`) || "0"
  const full = readSys(`${b}/energy_full`) || readSys(`${b}/charge_full`) || "1"
  const design = readSys(`${b}/energy_full_design`) || readSys(`${b}/charge_full_design`) || "0"
  setBatteryEnergy((parseInt(now) / 1000000).toFixed(2))
  setBatteryEnergyFull((parseInt(full) / 1000000).toFixed(2))
  setBatteryEnergyDesign((parseInt(design) / 1000000).toFixed(2))
  setBatteryPerc(Math.round((parseInt(now) / parseInt(full)) * 100))
  const pwr = parseInt(readSys(`${b}/power_now`) || "0")
  if (pwr > 0) { const h = parseInt(now) / pwr; setBatteryTime(`${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`) }
}

function collectNet() {
  const iface = netIface()
  setNetStatus(readSys(`/sys/class/net/${iface}/operstate`) === "up" ? "ONLINE" : "OFFLINE")
  const ssid = run(`iwgetid -r ${iface} 2>/dev/null`).trim()
  if (ssid) setNetSSID(ssid)
  const dev = readSys("/proc/net/dev")
  if (!dev) return
  for (const l of dev.split("\n")) {
    if (!l.trim().startsWith(iface + ":")) continue
    const p = l.trim().split(/\s+/)
    const rx = parseInt(p[1]) || 0; const tx = parseInt(p[9]) || 0
    if (_prevRx === 0) { _prevRx = rx; _prevTx = tx; return }
    setNetDownSpeed(Math.max(0, Math.round((rx - _prevRx) / 1024)))
    setNetUpSpeed(Math.max(0, Math.round((tx - _prevTx) / 1024)))
    setNetDownTotal((rx / 1073741824).toFixed(2) + "GiB")
    setNetUpTotal((tx / 1073741824).toFixed(2) + "GiB")
    _prevRx = rx; _prevTx = tx
    break
  }
  setNetLocalIp(run(`ip -4 addr show ${iface} 2>/dev/null | grep inet | awk '{print $2}' | cut -d/ -f1`).trim() || "N/A")
}

function collectDisk() {
  const df = run("df -h / 2>/dev/null | tail -1").trim()
  if (df) {
    const p = df.split(/\s+/)
    if (p.length >= 6) { setDiskTotal(p[1]); setDiskUsed(p[2]); setDiskFree(p[3]); setDiskPerc(parseInt(p[4].replace("%", "")) || 0) }
  }
  const stat = readSys("/proc/diskstats")
  if (stat) {
    for (const l of stat.split("\n")) {
      const p = l.trim().split(/\s+/)
      if (p.length >= 14 && p[2] !== "loop" && !p[2].startsWith("ram") && !p[2].startsWith("zram") && /^[a-z]/.test(p[2])) {
        const r = parseInt(p[5]) || 0; const w = parseInt(p[9]) || 0
        if (_prevDiskRead === 0) { _prevDiskRead = r; _prevDiskWrite = w; continue }
        setDiskReadSpeed(Math.max(0, Math.round((r - _prevDiskRead) * 512 / 1024)))
        setDiskWriteSpeed(Math.max(0, Math.round((w - _prevDiskWrite) * 512 / 1024)))
        _prevDiskRead = r; _prevDiskWrite = w; break
      }
    }
  }
  setStorageDevices(run(`lsblk -ro NAME,SIZE,TYPE,MOUNTPOINTS 2>/dev/null | awk '$3=="disk"||$3=="rom"{print "\\u2500"$1"-------("$2")"}; $3=="part"{mnt=$4; if(length(mnt)>20) mnt=substr(mnt,1,17) "..."; if(mnt) print "     \\u2514"$1"-----("$2")--" mnt; else print "     \\u2514"$1"-----("$2")"}'`).trim())
}

function collectSys() {
  const ut = readSys("/proc/uptime")
  if (ut) { const s = parseInt(ut.split(" ")[0]); const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60); setUptime(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`) }
  setKernel(run("uname -r").trim())
  setNodename(readSys("/proc/sys/kernel/hostname") || run("hostname").trim() || "")
  setCpuModel(run("grep 'model name' /proc/cpuinfo | head -1 | sed 's/.*: //'").trim() || "N/A")
  const f = readSys("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq")
  if (f) setCpuFreq((parseInt(f) / 1000000).toFixed(1) + "GHz")
  const mf = readSys("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq")
  if (mf) setCpuMaxFreq((parseInt(mf) / 1000000).toFixed(1) + "GHz")
  const l = readSys("/proc/loadavg")
  if (l) setCpuLoads(l.split(" ").slice(0, 3).join(" "))
}

function collectTemps() {
  for (let i = 0; i < 10; i++) {
    const raw = readSys(`/sys/class/thermal/thermal_zone${i}/temp`)
    const typ = readSys(`/sys/class/thermal/thermal_zone${i}/type`)
    if (raw && typ) {
      const t = parseFloat(raw) / 1000
      const tl = typ.trim().toLowerCase()
      if (tl.includes("x86_pkg") || tl.includes("cpu")) setCpuTemp(String(Math.round(t)))
      else if (tl.includes("acpitz")) { if (cpuTemp() === "N/A") setCpuTemp(String(Math.round(t))) }
    } else break
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + "GiB"
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + "MiB"
  return (bytes / 1024).toFixed(0) + " KiB"
}

function updateAll() {
  try {
    const p = calcCpuPerc()
    setCpuPerc(p)
    setCpuPercNorm(p / 100)
    const cores = calcCorePercs()
    setCorePercs(cores)
    const bars = cores.map((c, idx) => ({
      idx,
      h: Math.max(1, Math.round((c / 100) * 22)),
      cls: c >= 90 ? "cpu-red" : c >= 75 ? "cpu-yellow" : "cpu-white",
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
    collectBattery()
    collectTemps()
    collectGpu()
    collectNet()
    collectDisk()
  } catch (e) { console.error("data update:", e) }
}

interval(1000, updateAll)
updateAll()
