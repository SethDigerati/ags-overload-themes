import { Gtk } from "ags/gtk4"
import { createEffect } from "ags"
import Cairo from "gi://cairo"

export function Graph({ data, width, height, reversed, className }: { data: () => number[]; width: number; height: number; reversed?: boolean; className?: string }) {
  const area = new Gtk.DrawingArea()
  area.set_size_request(width, height)
  area.hexpand = true
  area.add_css_class("graph")
  if (className) area.add_css_class(className)

  area.set_draw_func((_self: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    const vals = data()
    if (vals.length < 2) return

    const n = vals.length
    const step = w / (n - 1)
    const max = Math.max(...vals, 1)
    const yPos = (v: number) => reversed ? (v / max) * h : h - (v / max) * h
    const yOrigin = reversed ? 0 : h

    cr.moveTo(0, yOrigin)
    for (let i = 0; i < n; i++) {
      cr.lineTo(i * step, yPos(vals[i]))
    }
    cr.lineTo((n - 1) * step, yOrigin)
    cr.closePath()

    const gradient = new Cairo.LinearGradient(0, 0, 0, h)
    if (reversed) {
      gradient.addColorStopRGBA(0, 0, 0, 0, 0)
      gradient.addColorStopRGBA(1, 0.875, 0.753, 0.051, 1)
    } else {
      gradient.addColorStopRGBA(0, 0.875, 0.753, 0.051, 1)
      gradient.addColorStopRGBA(1, 0, 0, 0, 0)
    }
    cr.setSource(gradient)
    cr.fill()

    cr.moveTo(0, yPos(vals[0]))
    for (let i = 1; i < n; i++) {
      cr.lineTo(i * step, yPos(vals[i]))
    }
    cr.setLineWidth(1.5)
    cr.setSourceRGBA(1, 1, 1, 0.5)
    cr.stroke()

    cr.moveTo(0, h - 0.5)
    cr.lineTo(w, h - 0.5)
    cr.setLineWidth(1)
    cr.setSourceRGBA(0.2, 0.2, 0.2, 0.9)
    cr.stroke()
  })

  createEffect(() => { data(); area.queue_draw() })

  return area
}
