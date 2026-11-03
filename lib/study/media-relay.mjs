// Only the signed ESA -> Supabase envelope can request a COS read ticket.
// Video bytes travel directly from COS to ESA, never through Supabase.
export const MEDIA_RELAY_HEADER = "x-study-media-relay";
export const MEDIA_URL_HEADER = "x-study-media-url";
export const isMediaRequest = (request) =>
  request.method === "GET" &&
  /^\/api\/media\/[a-zA-Z0-9_-]+$/.test(new URL(request.url).pathname);

export async function relayCosMedia(request, ticket, send = fetch) {
  let url;
  try {
    url = new URL(ticket);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !/^[a-z0-9-]+-\d+\.cos\.ap-[a-z0-9-]+\.myqcloud\.com$/.test(
        url.hostname,
      ) ||
      !/^\/study-v2\/videos\/[a-zA-Z0-9_-]+\.mp4$/.test(url.pathname) ||
      url.pathname.split("/").at(-1) !==
        new URL(request.url).pathname.split("/").at(-1) + ".mp4" ||
      url.searchParams.get("q-sign-algorithm") !== "sha1" ||
      !url.searchParams.get("q-signature")
    )
      throw Error();
  } catch {
    return Response.json(
      { error: "视频地址校验失败，请重新加载。" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      let upstream;
      try {
        upstream = await send(url.href, {
          headers: request.headers.has("range")
            ? { Range: request.headers.get("range") }
            : {},
          redirect: "error",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (![200, 206, 416].includes(upstream.status)) {
        await upstream.body?.cancel();
        if (attempt === 0 && upstream.status >= 500) continue;
        break;
      }
      const headers = new Headers({
        "Content-Type": "video/mp4",
        "Content-Disposition": "inline",
        // Private browser cache only; authenticated media must not enter a shared cache.
        "Cache-Control":
          upstream.status === 416 ? "no-store" : "private, max-age=300",
        Vary: "Cookie, Authorization",
        "X-Content-Type-Options": "nosniff",
        "X-Study-Media-Route": "edge-cos",
      });
      for (const name of [
        "content-length",
        "content-range",
        "accept-ranges",
        "etag",
        "last-modified",
      ]) {
        if (upstream.headers.has(name))
          headers.set(name, upstream.headers.get(name));
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch {
      // Retry only before a response body has been exposed to the browser.
    }
  }
  return Response.json(
    { error: "视频连接暂时中断，请重新加载。" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
