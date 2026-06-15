import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed } from "ags"
import { cpuPerc, cpuModel, cpuFreq, cpuMaxFreq, cpuTemp, cpuLoads, corePercs } from "../data"

const { TOP, RIGHT } = Astal.WindowAnchor

export default function Cpu() {
  const cores = corePercs()

  return (
    <window visible name="cpu" class="Cpu" anchor={TOP | RIGHT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={400}>
      <box orientation={Gtk.Orientation.VERTICAL}>
        <label wrap class="section-header" label={createComputed(() => `CPU (${cpuTemp()}°C)`)} />
        <label wrap class="gray1" label={createComputed(() => cpuModel())} xalign={1} />
        <label wrap class="gray1" label={createComputed(() => `${cpuFreq()} / ${cpuMaxFreq()}`)} xalign={1} />
        <label wrap label={createComputed(() => `${cpuPerc()}%`)} xalign={1} />
        <levelbar value={createComputed(() => cpuPerc() / 100)} />
        <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
          {cores.length === 0 ? <label wrap class="gray3" label="No core data" /> : cores.map((c, i) => (
            <box>
              <label wrap class="gray2" label={`CPU${i + 1}:`} widthRequest={40} />
              <label wrap label={`${c}%`} xalign={1} />
              <levelbar value={c / 100} widthRequest={150} />
            </box>
          ))}
        </box>
        <label wrap class="gray3" label={createComputed(() => `Load: ${cpuLoads()}`)} xalign={1} />
      </box>
    </window>
  )
}
