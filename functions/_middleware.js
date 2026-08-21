const datedPath =
  /^\/(?:ja|en)\/(?:c|cpp|rust|haskell)\/(?:read|write|debug)\/(\d{4}-\d{2}-\d{2})(?:\.html)?\/?$/;

// "fix" was renamed to "debug"; permanently redirect old links so bookmarks
// and indexed search results keep working.
const legacyFixPath =
  /^\/(ja|en)\/(c|cpp|rust|haskell)\/fix(\.html)?(\/.*)?$/;

export function onRequest(context) {
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