import { Gtk } from "ags/gtk4"
import { createEffect } from "ags"
import Cairo from "gi://cairo"

// Values are 0-100 percentages, so anything under half a point is invisible.
const EPSILON = 0.5

export function Graph({ data, width, height, reversed, className }: { data: () => number[]; width: number; height: number; reversed?: boolean; className?: string }) {
  const area = new Gtk.DrawingArea()
  area.set_size_request(width, height)
  area.hexpand = true
  area.add_css_class("graph")
  if (className) area.add_css_class(className)

  // A Cairo pattern is context-independent, so one instance serves every
  // frame at a given size. Charts have a fixed height, which means the fill
  // gradient is built once per chart instead of once per frame.
  let gradKey = ""
  let gradFill: any = null
  function fillGradient(w: number, h: number): any {
    const key = `${w}x${h}x${reversed ? 1 : 0}`
    if (gradKey !== key || !gradFill) {
      const gradient = new Cairo.LinearGradient(0, 0, 0, h)
      if (reversed) {
        gradient.addColorStopRGBA(0, 0.875, 0.753, 0.051, 0)
        gradient.addColorStopRGBA(1, 0.875, 0.753, 0.051, 1)
      } else {
        gradient.addColorStopRGBA(0, 0.875, 0.753, 0.051, 1)
        gradient.addColorStopRGBA(1, 0.875, 0.753, 0.051, 0)
      }
      gradFill = gradient
      gradKey = key
    }
    return gradFill
  }

  area.set_draw_func((_self: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    const vals = data()
    if (vals.length < 2) return

    const n = vals.length
    const step = w / (n - 1)

    // Single pass for both the scale and the polyline points.
    let max = 1
    const ys = new Array<number>(n)
    for (let i = 0; i < n; i++) {
      const v = vals[i]
      if (v > max) max = v
    }
    const hOverMax = h / max
    for (let i = 0; i < n; i++) {
      ys[i] = reversed ? vals[i] * hOverMax : h - vals[i] * hOverMax
    }
    const yOrigin = reversed ? 0 : h

    cr.moveTo(0, yOrigin)
    for (let i = 0; i < n; i++) cr.lineTo(i * step, ys[i])
    cr.lineTo((n - 1) * step, yOrigin)
    cr.closePath()
    cr.setSource(fillGradient(w, h))
    cr.fill()
    // Drop the pattern reference from the context before it is reused for
    // the stroke, so nothing holds it past this call.
    cr.setSourceRGBA(1, 1, 1, 0)

    cr.moveTo(0, ys[0])
    for (let i = 1; i < n; i++) cr.lineTo(i * step, ys[i])
    cr.setLineWidth(1.5)
    cr.setSourceRGBA(1, 1, 1, 0.5)
    cr.stroke()

    const axisY = reversed ? 0.5 : h - 0.5
    cr.moveTo(0, axisY)
    cr.lineTo(w, axisY)
    cr.setLineWidth(1)
    cr.setSourceRGBA(0.2, 0.2, 0.2, 0.9)
    cr.stroke()
  })

  let lastFrame: number[] = []
  createEffect(() => {
    const vals = data()
    if (vals.length === lastFrame.length) {
      let same = true
      for (let i = 0; i < vals.length; i++) {
        if (Math.abs(vals[i] - lastFrame[i]) > EPSILON) { same = false; break }
      }
      if (same) return
    }
    lastFrame = vals
    area.queue_draw()
  })

  return area
}