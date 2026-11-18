// The temporary voice recorder has been removed. This blocks the old path.
export function onRequest() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
