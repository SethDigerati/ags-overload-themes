import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed, For } from "ags"
import { cpuPerc, cpuPercNorm, cpuModel, cpuFreq, cpuMaxFreq, cpuTemp, coreRows } from "../data"

const { TOP, RIGHT } = Astal.WindowAnchor

export default function Cpu() {
  return (
    <window visible name="cpu" class="Cpu" anchor={TOP | RIGHT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={399} resizable={false}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <label wrap xalign={0} ellipsize={3} maxWidthChars={50} class="section-header" label={createComputed(() => `CPU (${cpuTemp()}°C)`)} />
        <box class="hr-line" />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray1" label={createComputed(() => cpuModel())} xalign={0} />
        <box spacing={2}>
          <label wrap ellipsize={3} maxWidthChars={6} label={createComputed(() => `${cpuPerc()}%`)} xalign={0} />
          <levelbar hexpand heightRequest={10} valign={Gtk.Align.CENTER} value={cpuPercNorm}
            cssClasses={createComputed(() => { const p = cpuPerc(); return ["cpu-bar", p >= 85 ? "cpu-yellow" : "cpu-white"] })} />
          <label wrap ellipsize={3} maxWidthChars={20} class="gray1" label={createComputed(() => `${cpuFreq()}/${cpuMaxFreq()}`)} xalign={1} />
        </box>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
          <For each={coreRows}>{(row) => (
            <box orientation={Gtk.Orientation.HORIZONTAL} spacing={4} homogeneous={true}>
              {row.map((bar) => (
                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} halign={Gtk.Align.CENTER}>
                  <box widthRequest={22} heightRequest={22} class="cpu-gauge" overflow={Gtk.Overflow.HIDDEN}>
                    <box hexpand={true} heightRequest={bar.h} valign={Gtk.Align.END}
                      class={bar.cls} />
                  </box>
                  <label wrap ellipsize={3} maxWidthChars={5} class="gray2" label={`CPU${bar.idx}`} xalign={0.5} />
                </box>
              ))}
            </box>
          )}</For>
        </box>
      </box>
    </window>
  )
}
