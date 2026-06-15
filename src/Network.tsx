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
      widthRequest={400}
      exclusivity={Astal.Exclusivity.NORMAL}
      application={app}
    >
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={400}>
        <label wrap class="section-header" label={createComputed(() => `NETWORK(${netIface()})`)} />
        <box>
          <label wrap class="gray2" label="Status:" widthRequest={70} />
          <label wrap label={createComputed(() => netStatus())}
            cssClasses={createComputed(() => [netStatus() === "ONLINE" ? "positive" : "negative"])} />
        </box>
        <box>
          <label wrap class="gray2" label="SSID:" widthRequest={70} />
          <label wrap label={createComputed(() => netSSID())} xalign={1} />
        </box>
        <box>
          <label wrap class="gray2" label="Signal:" widthRequest={70} />
          <label wrap label={createComputed(() => `${netSignal()}%`)} xalign={1} />
        </box>
        <box>
          <label wrap class="gray2" label="Local IP:" widthRequest={70} />
          <label wrap label={createComputed(() => netLocalIp())} xalign={1} />
        </box>
        <label wrap class="gray2" label={createComputed(() => `Down: ${netDownSpeed()} KiB/s`)} xalign={1} />
        <label wrap class="gray2" label={createComputed(() => `Up: ${netUpSpeed()} KiB/s`)} xalign={1} />
        <box>
          <label wrap class="gray2" label="Total DL:" widthRequest={70} />
          <label wrap label={createComputed(() => netDownTotal())} xalign={1} />
        </box>
        <box>
          <label wrap class="gray2" label="Total UL:" widthRequest={70} />
          <label wrap label={createComputed(() => netUpTotal())} xalign={1} />
        </box>
      </box>
    </window>
  )
}
