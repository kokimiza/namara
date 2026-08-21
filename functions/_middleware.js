const datedPath =
  /^\/(?:ja|en)\/(?:c|cpp|rust|haskell)\/(?:read|write|debug)\/(\d{4}-\d{2}-\d{2})(?:\.html)?\/?$/;

// "fix" was renamed to "debug"; permanently redirect old links so bookmarks
// and indexed search results keep working.
const legacyFixPath =
  /^\/(ja|en)\/(c|cpp|rust|haskell)\/fix(\.html)?(\/.*)?$/;

// There is no standalone "today" page on disk any more — only dated archive
// pages (/{locale}/{lang}/{type}/{date}) exist. Requesting the bare category
// URL (e.g. /en/c/debug) transparently serves whichever dated page matches
// today's date in Japan, so publishing a new day is just adding one new
// dated file — no copying the previous "today" file into an archive first.
const todayAliasPath =
  /^\/(ja|en)\/(c|cpp|rust|haskell)\/(read|write|debug)(?:\.html)?\/?$/;

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.pathname === "/") {
    const acceptLanguage =
      context.request.headers.get("Accept-Language") ?? "";
    const locale = acceptLanguage.toLowerCase().startsWith("ja") ? "ja" : "en";

    return Response.redirect(`${url.origin}/${locale}/c/read`, 302);
  }

  const legacyMatch = url.pathname.match(legacyFixPath);
  if (legacyMatch) {
    const [, locale, lang, , rest] = legacyMatch;
    const newPathname = `/${locale}/${lang}/debug${rest ?? ""}`;
    return Response.redirect(`${url.origin}${newPathname}${url.search}`, 301);
  }

  const pathname = url.pathname;
  const match = pathname.match(datedPath);

  if (match) {
    const today = todayInJapan();

    if (match[1] > today) {
      return new Response("Not Found", { status: 404 });
    }
  }

  const todayMatch = pathname.match(todayAliasPath);
  if (todayMatch) {
    const [, locale, lang, type] = todayMatch;
    const today = todayInJapan();
    const target = new URL(`/${locale}/${lang}/${type}/${today}`, url.origin);

    // Serves the dated page's bytes as-is at the bare category URL. Its own
    // <link rel="canonical"> already points at the dated URL, so this never
    // creates duplicate-content ambiguity — it's a transparent alias, not a
    // redirect (the address bar keeps showing the bare category URL).
    return context.env.ASSETS.fetch(new Request(target, context.request));
  }

  return context.next();
}

function todayInJapan() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}
