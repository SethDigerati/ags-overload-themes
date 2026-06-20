import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed } from "ags"
import {
  netIface, netStatus, netSSID, netBitrate, netSignal,
  netDownSpeed, netUpSpeed, netDownTotal, netUpTotal,
  netLocalIp, netLatency, netLoss, netJitter,
} from "../data"

const { TOP, LEFT } = Astal.WindowAnchor

export default function Network() {
  return (
    <window
      visible
      name="network"
      class="Network"
      anchor={TOP | LEFT}
      marginTop={10}
      marginLeft={0}
      widthRequest={399}
      exclusivity={Astal.Exclusivity.NORMAL}
      application={app}
      resizable={false}
    >
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <label wrap xalign={0} class="section-header" label={createComputed(() => `NETWORK(${netIface()})`)} />
        <box>
          <label class="gray2" label="Status  : " widthRequest={70} xalign={1} />
          <label ellipsize={3} maxWidthChars={50} wrap hexpand xalign={0}
            label={createComputed(() => netStatus())}
            cssClasses={createComputed(() => [netStatus() === "ONLINE" ? "positive" : "negative"])} />
        </box>
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `SSID    : ${netSSID()}`)} />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `Signal  : ${netSignal()}%`)} />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `Local IP: ${netLocalIp()}`)} />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `   Down : ${netDownSpeed()}KiB/s`)} />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `     Up : ${netUpSpeed()}KiB/s`)} />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `Total DL: ${netDownTotal()}`)} />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `Total UL: ${netUpTotal()}`)} />
      </box>
    </window>
  )
}
