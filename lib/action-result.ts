import { unstable_rethrow } from "next/navigation"

/**
 * Server actions report problems by RETURNING them, not throwing: in production React replaces a
 * thrown Server Action message with "Minified React error #441", so people never see the reason.
 *
 *   server:  export async function save(fd: FormData) { return attempt(() => saveImpl(fd)) }
 *   client:  unwrap(await save(fd))            // re-throws the real message in the browser
 *   forms:   <ActionForm action={save}>…       // shows the message under the form
 */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

export async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    // redirect() / notFound() work by throwing; let Next.js handle those
    unstable_rethrow(err)
    console.error(err)
    return { ok: false, error: err instanceof Error && err.message ? err.message : "Something went wrong. Please try again." }
  }
}

/** Client side: the action's data, or throw its message so existing try/catch code keeps working. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}
