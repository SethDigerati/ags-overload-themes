import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed } from "ags"
import {
  memPerc, memUsed, memFree, memTotal, memEasyFree,
  swapPerc, swapUsed, swapFree, swapMax,
  diskPerc, diskUsed, diskFree, diskTotal,
  diskReadSpeed, diskWriteSpeed,
  storageDevices,
} from "../data"

const { TOP, RIGHT } = Astal.WindowAnchor

export default function Memory() {
  return (
    <window
      visible
      name="memory"
      class="Memory"
      anchor={TOP | RIGHT}
      marginRight={0}
      widthRequest={400}
      exclusivity={Astal.Exclusivity.NORMAL}
      application={app}
    >
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={400}>
        <label wrap xalign={0} class="section-header" label="RAM" />
        <box>
          <label ellipsize={3} maxWidthChars={30} class="gray1" xalign={0} hexpand
            label={createComputed(() => `Used: ${memUsed()} (${memPerc()}%)`)} />
          <label ellipsize={3} maxWidthChars={25} class="gray1" xalign={1}
            label={createComputed(() => `${memEasyFree()} Free / ${memTotal()}`)} />
        </box>
        <levelbar heightRequest={10} value={createComputed(() => memPerc() / 100)}
          cssClasses={createComputed(() => { const p = memPerc(); return ["cpu-bar", p >= 90 ? "cpu-red" : p >= 75 ? "cpu-yellow" : "cpu-white"] })} />
        <label wrap xalign={0} class="section-header" label="SWAP" />
        <box>
          <label ellipsize={3} maxWidthChars={30} class="gray1" xalign={0} hexpand
            label={createComputed(() => `Used: ${swapUsed()} (${swapPerc()}%)`)} />
          <label ellipsize={3} maxWidthChars={25} class="gray1" xalign={1}
            label={createComputed(() => `${swapFree()} Free / ${swapMax()}`)} />
        </box>
        <levelbar heightRequest={10} value={createComputed(() => swapPerc() / 100)}
          cssClasses={createComputed(() => { const p = swapPerc(); return ["cpu-bar", p >= 90 ? "cpu-red" : p >= 75 ? "cpu-yellow" : "cpu-white"] })} />
        <label wrap xalign={0} class="section-header" label="STORAGE DEVICES" />
        <label xalign={0} class="gray3" label={createComputed(() => storageDevices() || "N/A")} />
        <label wrap xalign={0} class="section-header" label="DISK" />
        <box>
          <label ellipsize={3} maxWidthChars={30} class="gray1" xalign={0} hexpand
            label={createComputed(() => `Used: ${diskUsed()} (${diskPerc()}%)`)} />
          <label ellipsize={3} maxWidthChars={25} class="gray1" xalign={1}
            label={createComputed(() => `${diskFree()} Free / ${diskTotal()}`)} />
        </box>
        <levelbar heightRequest={10} value={createComputed(() => diskPerc() / 100)}
          cssClasses={createComputed(() => { const p = diskPerc(); return ["cpu-bar", p >= 90 ? "cpu-red" : p >= 75 ? "cpu-yellow" : "cpu-white"] })} />
        <box>
          <label wrap class="gray2" label="Read:" widthRequest={60} />
          <label ellipsize={3} maxWidthChars={50} label={createComputed(() => `${diskReadSpeed()}KB/s`)} xalign={1} />
        </box>
        <box>
          <label wrap class="gray2" label="Write:" widthRequest={60} />
          <label ellipsize={3} maxWidthChars={50} label={createComputed(() => `${diskWriteSpeed()}KB/s`)} xalign={1} />
        </box>
      </box>
    </window>
  )
}
