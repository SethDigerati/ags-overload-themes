import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed } from "ags"
import { cpuPerc, cpuModel, cpuFreq, cpuMaxFreq, cpuTemp, cpuLoads, corePercs } from "../data"

const { TOP, RIGHT } = Astal.WindowAnchor

export default function Cpu() {
  const cores = corePercs()

  return (
    <window visible name="cpu" class="Cpu" anchor={TOP | RIGHT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={400}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={400}>
        <label wrap xalign={0} class="section-header" label={createComputed(() => `CPU (${cpuTemp()}°C)`)} />
        <label wrap class="gray1" label={createComputed(() => cpuModel())} xalign={0} />
        <box>
          <label wrap label={createComputed(() => `${cpuPerc()}%`)} widthRequest={50} xalign={0} />
          <levelbar widthRequest={210} value={createComputed(() => cpuPerc() / 100)}
            cssClasses={createComputed(() => { const p = cpuPerc(); return ["cpu-bar", p >= 90 ? "cpu-red" : p >= 75 ? "cpu-orange" : "cpu-white"] })} />
          <label wrap class="gray1" label={createComputed(() => `${cpuFreq()} / ${cpuMaxFreq()}`)} xalign={1} />
        </box>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
          {cores.length === 0 ? <label wrap class="gray3" label="No core data" /> : cores.map((c, i) => (
            <box>
              <label wrap class="gray2" label={`CPU${i + 1}:`} widthRequest={40} />
              <label wrap label={`${c}%`} xalign={0} />
              <levelbar value={c / 100} widthRequest={150} cssClasses={[c >= 90 ? "cpu-red" : c >= 75 ? "cpu-orange" : "cpu-white"]} />
            </box>
          ))}
        </box>
        <label wrap class="gray3" label={createComputed(() => `Load: ${cpuLoads()}`)} xalign={0} />
      </box>
    </window>
  )
}
