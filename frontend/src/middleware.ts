import { NextRequest, NextResponse } from "next/server";

const locales = ["en", "rw"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const hasLocale = locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
  if (hasLocale) return NextResponse.next();

  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const locale = locales.includes(cookieLocale || "") ? cookieLocale! : "rw";

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"]
};
