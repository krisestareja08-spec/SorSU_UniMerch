"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const BANNERS = [
  {
    id: 1,
    title: "Campus Collection Drop",
    subtitle: "New Bulan Campus merch — hoodies, shirts, tumblers",
    cta: "Shop Now",
    bg: "from-primary to-primary/80",
    badge: "New Arrivals",
  },
  {
    id: 2,
    title: "Org Promo Week",
    subtitle: "Student organisation shops — up to 30% off this week",
    cta: "Explore Deals",
    bg: "from-[#5a0000] to-primary",
    badge: "Limited Time",
  },
  {
    id: 3,
    title: "Uniform Pre-Orders Open",
    subtitle: "Faculty & staff uniforms — verified members only",
    cta: "Pre-Order",
    bg: "from-primary/90 to-[#3d0000]",
    badge: "Pre-Order",
  },
  {
    id: 4,
    title: "SorSU Foundation Day",
    subtitle: "Event tickets and commemorative items available now",
    cta: "Get Tickets",
    bg: "from-[#4a1000] to-primary/70",
    badge: "Events",
  },
]

export function BannerCarousel() {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function goTo(idx: number) {
    setCurrent((idx + BANNERS.length) % BANNERS.length)
  }

  useEffect(() => {
    if (paused) return
    timerRef.current = setTimeout(() => goTo(current + 1), 4000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [current, paused])

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {BANNERS.map((b) => (
          <div
            key={b.id}
            className={cn(
              "relative flex min-w-full flex-col justify-end bg-gradient-to-br p-6 sm:p-8",
              b.bg,
            )}
            style={{ minHeight: "10rem" }}
          >
            {/* Decorative gold circle */}
            <div className="absolute right-6 top-1/2 size-32 -translate-y-1/2 rounded-full bg-gold/10 sm:size-48" />
            <div className="absolute right-12 top-1/2 size-20 -translate-y-1/2 rounded-full bg-gold/8 sm:size-32" />

            <span className="mb-2 inline-flex w-fit items-center rounded-full border border-gold/40 bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold">
              {b.badge}
            </span>
            <h2 className="text-balance font-serif text-xl font-bold text-primary-foreground sm:text-2xl">
              {b.title}
            </h2>
            <p className="mt-1 text-sm text-primary-foreground/75">{b.subtitle}</p>
            <button className="mt-4 w-fit rounded-full bg-gold px-5 py-2 text-sm font-semibold text-primary shadow transition-transform hover:scale-105 active:scale-95">
              {b.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Arrow buttons */}
      <button
        onClick={() => goTo(current - 1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        aria-label="Previous banner"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        onClick={() => goTo(current + 1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        aria-label="Next banner"
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Gold dots */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={cn(
              "rounded-full transition-all",
              i === current ? "w-5 h-1.5 bg-gold" : "size-1.5 bg-primary-foreground/40 hover:bg-primary-foreground/70",
            )}
            aria-label={`Go to banner ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
