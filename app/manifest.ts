import type { MetadataRoute } from "next"

/** Web app manifest: lets UniMerch be installed to the home screen / desktop as an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "UniMerch — Sorsogon State University",
    short_name: "UniMerch",
    description: "The official campus marketplace of Sorsogon State University.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fbf8f3",
    theme_color: "#7a1f2b",
    categories: ["shopping", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My Orders", url: "/marketplace/orders", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Messages", url: "/marketplace/messages", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Cart", url: "/marketplace/cart", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  }
}
