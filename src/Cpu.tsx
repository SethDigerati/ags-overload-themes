import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed, For } from "ags"
import { cpuPerc, cpuPercNorm, cpuModel, cpuFreq, cpuMaxFreq, cpuTemp, coreBars } from "../data"

const { TOP, RIGHT } = Astal.WindowAnchor

export default function Cpu() {
  return (
    <window visible name="cpu" class="Cpu" anchor={TOP | RIGHT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={400}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={400}>
        <label wrap xalign={0} class="section-header" label={createComputed(() => `CPU (${cpuTemp()}°C)`)} />
        <label wrap class="gray1" label={createComputed(() => cpuModel())} xalign={0} />
        <box spacing={2}>
          <label wrap label={createComputed(() => `${cpuPerc()}%`)} xalign={0} />
          <levelbar widthRequest={250} heightRequest={10} valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} value={cpuPercNorm}
            cssClasses={createComputed(() => { const p = cpuPerc(); return ["cpu-bar", p >= 90 ? "cpu-red" : p >= 75 ? "cpu-orange" : "cpu-white"] })} />
          <label wrap class="gray1" label={createComputed(() => `${cpuFreq()}/${cpuMaxFreq()}`)} xalign={1} />
        </box>
        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={4} homogeneous={true}>
          <For each={coreBars}>{(bar) => {
            return (
              <box orientation={Gtk.Orientation.VERTICAL} spacing={2} halign={Gtk.Align.CENTER}>
                <box widthRequest={40} heightRequest={40} class="cpu-gauge">
                  <box widthRequest={40} heightRequest={bar.h} valign={Gtk.Align.END}
                    class={bar.cls} />
                </box>
                <label wrap class="gray2" label={`CPU${bar.idx}`} xalign={0.5} />
              </box>
            )
          }}</For>
        </box>
      </box>
    </window>
  )
}
