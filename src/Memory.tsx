import { Gtk } from "ags/gtk4"
import { createComputed, For } from "ags"
import {
  memPerc, memUsed, memFree, memTotal, memEasyFree,
  swapPerc, swapUsed, swapFree, swapMax,
  diskPerc, diskUsed, diskFree, diskTotal,
  diskReadSpeed, diskWriteSpeed,
  diskReadGraphData, diskWriteGraphData,
  storageDevices,
  formatSpeed,
  topMemProcs,
} from "../data"
import { Graph } from "./Graph"
import { graphs } from "../config"

export function MemoryBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
      <label wrap xalign={0} class="section-header" label="RAM" />
      <box class="hr-line" />
      <box spacing={5}>
        <label class="accent" label="Task" xalign={0} hexpand />
        <label class="accent" label="PID" xalign={0} widthRequest={55} />
        <label class="accent" label="VSIZE" xalign={0} widthRequest={70} />
        <label class="accent" label="SIZE" xalign={1} widthRequest={70} />
      </box>
      <box class="hr-line" />
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <For each={topMemProcs}>{(item) => (
          <box widthRequest={399} spacing={5}>
            <label ellipsize={3} maxWidthChars={20} wrap class="gray2" label={item.name} xalign={0} hexpand />
            <label ellipsize={3} maxWidthChars={6} wrap class="gray2" label={item.pid} xalign={0} widthRequest={55} />
            <label ellipsize={3} maxWidthChars={9} wrap class="gray2" label={item.vsize} xalign={0} widthRequest={70} />
            <label ellipsize={3} maxWidthChars={9} wrap class="gray2" label={item.size} xalign={1} widthRequest={70} />
          </box>
        )}</For>
      </box>
      <box class="hr-line" />
      <box>
        <label class="gray1" xalign={0} label="Used: " />
        <label ellipsize={3} maxWidthChars={30} class="gray1" xalign={0} hexpand
          label={createComputed(() => `${memUsed()} (${memPerc()}%)`)} />
        <label ellipsize={3} maxWidthChars={25} class="gray1" xalign={1}
          label={createComputed(() => `${memEasyFree()} Free / ${memTotal()}`)} />
      </box>
      <levelbar hexpand heightRequest={10} value={createComputed(() => memPerc() / 100)}
        cssClasses={createComputed(() => { const p = memPerc(); return ["cpu-bar", p >= 90 ? "cpu-red" : p >= 75 ? "cpu-yellow" : "cpu-white"] })} />
      <label wrap xalign={0} class="section-header" label="SWAP" />
      <box class="hr-line" />
      <box>
        <label class="gray1" xalign={0} label="Used: " />
        <label ellipsize={3} maxWidthChars={30} class="gray1" xalign={0} hexpand
          label={createComputed(() => `${swapUsed()} (${swapPerc()}%)`)} />
        <label ellipsize={3} maxWidthChars={25} class="gray1" xalign={1}
          label={createComputed(() => `${swapFree()} Free / ${swapMax()}`)} />
      </box>
      <levelbar hexpand heightRequest={10} value={createComputed(() => swapPerc() / 100)}
        cssClasses={createComputed(() => { const p = swapPerc(); return ["cpu-bar", p >= 90 ? "cpu-red" : p >= 75 ? "cpu-yellow" : "cpu-white"] })} />
      <label wrap xalign={0} class="section-header" label="DISK" />
      <box class="hr-line" />
      <box>
        <label class="gray1" xalign={0} label="Used: " />
        <label ellipsize={3} maxWidthChars={30} class="gray1" xalign={0} hexpand
          label={createComputed(() => `${diskUsed()} (${diskPerc()}%)`)} />
        <label ellipsize={3} maxWidthChars={25} class="gray1" xalign={1}
          label={createComputed(() => `${diskFree()} Free / ${diskTotal()}`)} />
      </box>
      <levelbar hexpand heightRequest={10} value={createComputed(() => diskPerc() / 100)}
        cssClasses={createComputed(() => { const p = diskPerc(); return ["cpu-bar", p >= 90 ? "cpu-red" : p >= 75 ? "cpu-yellow" : "cpu-white"] })} />
      <box>
        <label class="accent" xalign={1} widthRequest={70} label="Read : " />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0} hexpand
          label={createComputed(() => formatSpeed(diskReadSpeed()))} />
      </box>
      {graphs.diskRead && <Graph data={diskReadGraphData} width={399} height={40} />}
      {graphs.diskWrite && <Graph data={diskWriteGraphData} width={399} height={40} reversed />}
      <box>
        <label class="accent" xalign={1} widthRequest={70} label="Write : " />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0} hexpand
          label={createComputed(() => formatSpeed(diskWriteSpeed()))} />
      </box>
      <label wrap xalign={0} class="section-header" label="STORAGE DEVICES" />
      <box class="hr-line" />
      <label xalign={0} ellipsize={3} maxWidthChars={55} class="gray3" label={createComputed(() => storageDevices() || "N/A")} />
    </box>
  )
}
