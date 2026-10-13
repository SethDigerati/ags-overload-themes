import { Gtk } from "ags/gtk4"
import { createComputed, For } from "ags"
import { cpuPerc, cpuPercNorm, cpuModel, cpuFreq, cpuMaxFreq, cpuTemp, corePercs, coreRows, topProcs, cpuGraphData } from "../data"
import { Graph } from "./Graph"
import { Levelbar } from "./Levelbar"
import { graphs } from "../config"

export function CpuBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
      <label wrap xalign={0} ellipsize={3} maxWidthChars={50} class="section-header" label={createComputed(() => `CPU (${cpuTemp()}°C)`)} />
      <box class="hr-line" />
      <label ellipsize={3} maxWidthChars={50} wrap class="gray1" label={createComputed(() => cpuModel())} xalign={0} />
      <box spacing={2}>
        <label wrap ellipsize={3} maxWidthChars={6} label={createComputed(() => `${cpuPerc()}%`)} xalign={0} />
        <Levelbar value={cpuPercNorm} />
        <label wrap ellipsize={3} maxWidthChars={20} class="gray1" label={createComputed(() => `${cpuFreq()}/${cpuMaxFreq()}`)} xalign={1} />
      </box>
      {graphs.cpu && <Graph data={cpuGraphData} width={399} height={50} className="cpu-graph" />}
      <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
        <For each={coreRows} id={(row) => row[0]?.idx ?? -1}>{(row) => (
          <box orientation={Gtk.Orientation.HORIZONTAL} spacing={4} homogeneous={true}>
            {row.map((bar) => {
              const idx = bar.idx
              return (
                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} halign={Gtk.Align.CENTER}>
                  <box widthRequest={22} heightRequest={22} class="cpu-gauge" overflow={Gtk.Overflow.HIDDEN}>
                    <box hexpand={true} valign={Gtk.Align.END}
                      heightRequest={createComputed(() => Math.max(1, Math.round(((corePercs()[idx] ?? 0) / 100) * 20)))}
                      cssClasses={createComputed(() => [(corePercs()[idx] ?? 0) >= 85 ? "cpu-yellow" : "cpu-white"])} />
                  </box>
                  <label wrap ellipsize={3} maxWidthChars={5} class="gray2" label={`CPU${idx + 1}`} xalign={0.5} />
                </box>
              )
            })}
          </box>
        )}</For>
      </box>
      <box class="hr-line" />
      <box spacing={5}>
        <label class="accent" label="Task" xalign={0} hexpand />
        <label class="accent" label="PID" xalign={0} widthRequest={50} />
        <label class="accent" label="Threads" xalign={0} widthRequest={55} />
        <label class="accent" label="Size%" xalign={1} widthRequest={55} />
      </box>
      <box class="hr-line" />
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <For each={topProcs}>{(item) => (
          <box widthRequest={399} spacing={5}>
            <label ellipsize={3} maxWidthChars={22} wrap class="gray2" label={item.name} xalign={0} hexpand />
            <label ellipsize={3} maxWidthChars={6} wrap class="gray2" label={item.pid} xalign={0} widthRequest={50} />
            <label ellipsize={3} maxWidthChars={4} wrap class="gray2" label={item.threads} xalign={0} widthRequest={55} />
            <label ellipsize={3} maxWidthChars={6} wrap class="gray2" label={createComputed(() => `${item.cpu}%`)} xalign={1} widthRequest={55} />
          </box>
        )}</For>
      </box>
      <box class="hr-line" />
    </box>
  )
}
