import { Gtk } from "ags/gtk4"
import { createComputed } from "ags"
import { interval } from "ags/time"

export default function MarqueeLabel({ text, widthRequest, className }: { text: () => string; widthRequest: number; className?: string }) {
  const ref: { current: Gtk.ScrolledWindow | null } = { current: null }

  interval(60, () => {
    const sw = ref.current
    if (!sw) return
    const adj = sw.get_hadjustment()
    if (!adj) return
    const upper = adj.get_upper()
    const page = adj.get_page_size()
    if (upper <= page + 1) return
    const val = adj.get_value()
    if (val >= upper - page) adj.set_value(0)
    else adj.set_value(val + 1)
  })

  return (
    <scrolledwindow
      $={(self: Gtk.ScrolledWindow) => { ref.current = self }}
      widthRequest={widthRequest}
      hscrollbarPolicy={Gtk.PolicyType.NEVER}
      vscrollbarPolicy={Gtk.PolicyType.NEVER}
    >
      <label xalign={0} label={createComputed(() => text())} cssClasses={className ? [className] : []} />
    </scrolledwindow>
  )
}
