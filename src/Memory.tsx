import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed } from "ags"
import {
  memPerc, memUsed, memFree, memTotal, memEasyFree, memBarClass,
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
        <label wrap class="section-header" label="RAM" />
        <label ellipsize={3} maxWidthChars={50} class="gray1" xalign={1}
          label={createComputed(() => `Used: ${memUsed()} (${memPerc()}%) → ${memEasyFree()} Free / ${memTotal()}`)} />
        <levelbar value={createComputed(() => memPerc() / 100)}
          cssClasses={createComputed(() => [memBarClass()])} />
        <label wrap class="section-header" label="SWAP" />
        <label ellipsize={3} maxWidthChars={50} class="gray1" xalign={1}
          label={createComputed(() => `Used: ${swapUsed()} (${swapPerc()}%) → ${swapFree()} Free / ${swapMax()}`)} />
        <levelbar value={createComputed(() => swapPerc() / 100)} />
        <label wrap class="section-header" label="STORAGE DEVICES" />
        <label ellipsize={3} maxWidthChars={50} class="gray3" label={createComputed(() => storageDevices() || "N/A")} />
        <label wrap class="section-header" label="DISK" />
        <label ellipsize={3} maxWidthChars={50} class="gray1" xalign={1}
          label={createComputed(() => `Used: ${diskUsed()} (${diskPerc()}%) → ${diskFree()} Free / ${diskTotal()}`)} />
        <levelbar value={createComputed(() => diskPerc() / 100)} />
        <box>
          <label wrap class="gray2" label="Read:" widthRequest={60} />
          <label ellipsize={3} maxWidthChars={50} label={createComputed(() => `${diskReadSpeed()} KB/s`)} xalign={1} />
        </box>
        <box>
          <label wrap class="gray2" label="Write:" widthRequest={60} />
          <label ellipsize={3} maxWidthChars={50} label={createComputed(() => `${diskWriteSpeed()} KB/s`)} xalign={1} />
        </box>
      </box>
    </window>
  )
}
