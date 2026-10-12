/**
 * Shrinks a photo in the browser before it is uploaded. Phone cameras produce 3–8 MB / 4000px
 * pictures, and every buyer's phone would otherwise download that for a card shown at ~200px.
 * Resizes to `maxSide` and re-encodes as WebP (JPEG where WebP isn't supported). Falls back to the
 * original file when anything goes wrong or the result isn't smaller, so uploading never fails because of this.
 *
 * Use for product photos, logos, banners and chat pictures — NOT for receipts, ID documents or QR
 * codes, which must stay exactly as the person provided them.
 */
export async function compressImage(file: File, { maxSide = 1600, quality = 0.82 }: { maxSide?: number; quality?: number } = {}): Promise<File> {
  try {
    // Animated or vector images, and files that are already small, are left alone
    if (!file.type.startsWith("image/") || /gif|svg/.test(file.type) || file.size < 150 * 1024) return file
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file

    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
    let blob = await toBlob("image/webp")
    if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg") // browser can't write WebP
    if (!blob || blob.size >= file.size) return file

    const ext = blob.type === "image/webp" ? "webp" : "jpg"
    const base = file.name.replace(/\.[^.]+$/, "") || "photo"
    return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: file.lastModified })
  } catch {
    return file
  }
}
