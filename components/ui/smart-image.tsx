import NextImage, { type ImageProps } from "next/image"

// The project's Supabase Storage host: its public photos are the ones the optimizer may fetch
const STORAGE_HOST = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host } catch { return "" }
})()

/** Photos in the project's Storage and the app's own files are resized and served as WebP. */
export function canOptimize(src: ImageProps["src"]) {
  if (typeof src !== "string") return true // a static import
  if (src.startsWith("/")) return !src.startsWith("//")
  try {
    const url = new URL(src)
    return !!STORAGE_HOST && url.host === STORAGE_HOST && url.pathname.startsWith("/storage/v1/object/public/")
  } catch {
    return false
  }
}

/**
 * next/image, optimized only where that's safe: product photos, logos and banners in Storage are
 * downloaded at the size they're shown instead of full size. Anything else (Google profile photos,
 * other sites, local previews) is shown as it is, so an unlisted host never breaks an image.
 */
export default function Image(props: ImageProps) {
  return <NextImage {...props} unoptimized={props.unoptimized ?? !canOptimize(props.src)} />
}
