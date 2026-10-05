"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { cn } from "@/lib/utils"

export type HomeBanner = { id: string; title: string; subtitle: string | null; image_url: string | null; href: string; store: string | null }

const INTERVAL_MS = 5000
const GRADIENTS = ["from-primary to-primary/80", "from-[#5a0000] to-primary", "from-primary/90 to-[#3d0000]", "from-[#4a1000] to-primary/70"]

/** Shown when no store has a banner running */
const WELCOME: HomeBanner = {
  id: "welcome", title: "Welcome to UniMerch", subtitle: "Official campus merch, org shops and university supplies, all in one place.",
  image_url: null, href: "/marketplace/search", store: null,
}

/**
 * Homepage carousel of store banners (scripts/26 → store_banners, live between their start and
 * end dates). Auto-advances unless paused, hovered, focused, or the user prefers reduced motion.
 */
export function BannerCarousel({ banners }: { banners: HomeBanner[] }) {
  const slides = banners.length ? banners : [WELCOME]
  const [current, setCurrent] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReducedMotion(mq.matches)
    const t = setTimeout(sync, 0)
    mq.addEventListener("change", sync)
    return () => { clearTimeout(t); mq.removeEventListener("change", sync) }
  }, [])

  const playing = slides.length > 1 && !userPaused && !hovered && !reducedMotion
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => setCurrent((c) => (c + 1) % slides.length), INTERVAL_MS)
    return () => clearTimeout(t)
  }, [current, playing, slides.length])

  const goTo = (i: number) => setCurrent((i + slides.length) % slides.length)
  const index = current % slides.length

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Promotions"
      className="relative overflow-hidden rounded-2xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
    >
      <div className={cn("flex", !reducedMotion && "transition-transform duration-500 ease-in-out")} style={{ transform: `translateX(-${index * 100}%)` }} aria-live={playing ? "off" : "polite"}>
        {slides.map((b, i) => (
          <div
            key={b.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}: ${b.title}`}
            aria-hidden={i !== index}
            className={cn("relative flex min-h-40 min-w-full flex-col justify-end bg-linear-to-br p-6 sm:min-h-52 sm:p-8", GRADIENTS[i % GRADIENTS.length])}
          >
            {b.image_url ? (
              <>
                <Image src={b.image_url} alt="" fill priority={i === 0} className="object-cover" sizes="(max-width: 1280px) 100vw, 1280px" />
                <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/35 to-transparent" />
              </>
            ) : (
              <>
                <div className="absolute right-6 top-1/2 size-32 -translate-y-1/2 rounded-full bg-gold/10 sm:size-48" />
                <div className="absolute right-12 top-1/2 size-20 -translate-y-1/2 rounded-full bg-gold/8 sm:size-32" />
              </>
            )}
            <div className="relative max-w-xl">
              {b.store && (
                <span className="mb-2 inline-flex w-fit items-center rounded-full border border-gold/40 bg-black/25 px-2.5 py-0.5 text-xs font-semibold text-gold backdrop-blur-sm">
                  {b.store}
                </span>
              )}
              <h2 className="text-balance font-serif text-xl font-bold text-white sm:text-2xl">{b.title}</h2>
              {b.subtitle && <p className="mt-1 text-sm text-white/85">{b.subtitle}</p>}
              <Link href={b.href} tabIndex={i === index ? 0 : -1}
                className="mt-4 inline-block w-fit rounded-full bg-gold px-5 py-2 text-sm font-semibold text-primary shadow transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {b.store ? "Shop now" : "Start browsing"}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button type="button" onClick={() => goTo(index - 1)} aria-label="Previous banner"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/55">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => goTo(index + 1)} aria-label="Next banner"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/55">
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              {slides.map((b, i) => (
                <button key={b.id} type="button" onClick={() => goTo(i)} aria-label={`Show banner ${i + 1}`} aria-current={i === index}
                  className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-gold" : "w-1.5 bg-white/50 hover:bg-white/80")} />
              ))}
            </div>
            <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? "Play banners" : "Pause banners"}
              className="rounded-full bg-black/35 p-1.5 text-white backdrop-blur-sm hover:bg-black/55">
              {userPaused ? <Play className="size-3" /> : <Pause className="size-3" />}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
