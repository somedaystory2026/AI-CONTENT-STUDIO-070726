import { NextResponse } from "next/server";

function isGoogleOwnedUrl(url: string) {
  return /(^|\.)google\.|googleusercontent\.com|gstatic\.com|schema\.org|news\.google\.com|googletagmanager\.com|google-analytics\.com|doubleclick\.net|googlesyndication\.com|googleapis\.com/i.test(
    url
  );
}

function isBoilerplateUrl(url: string) {
  return /w3\.org|xmlns|apache\.org\/licenses|creativecommons\.org|schemas\.|fonts\.(googleapis|gstatic)\.com|use\.typekit\.net|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|angular\.dev|vuejs\.org|reactjs\.org|react\.dev|getbootstrap\.com|jquery\.com|webpack\.js\.org|\/license(s)?(\/|$|\?)/i.test(
    url
  );
}

function isLikelyAssetUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?|ttf)(\?|#|$)/i.test(url);
}

function isUsableArticleUrl(url: string) {
  return Boolean(url) && !isGoogleOwnedUrl(url) && !isBoilerplateUrl(url) && !isLikelyAssetUrl(url);
}

// Attribute-order independent tag attribute reader — HTML doesn't guarantee
// property/content (or rel/href) appear in any particular order, and a regex
// that assumes one order silently misses matches on sites that write it the
// other way around.
function readAttr(tag: string, attr: string) {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] || "";
}

function extractCanonicalUrl(html: string) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const key = readAttr(tag, "property") || readAttr(tag, "name");
    if (key.toLowerCase() !== "og:url") continue;
    const content = readAttr(tag, "content");
    if (content && isUsableArticleUrl(content)) return content;
  }

  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    if (readAttr(tag, "rel").toLowerCase() !== "canonical") continue;
    const href = readAttr(tag, "href");
    if (href && isUsableArticleUrl(href)) return href;
  }

  return "";
}

function normalize(url: string) {
  return url.replace(/&amp;/g, "&");
}

function stripGoogleParams(url: string) {
  try {
    const u = new URL(url.replace(/&amp;/g, "&"));
    u.searchParams.delete("oc");
    u.searchParams.delete("ceid");
    return u.toString();
  } catch {
    return url;
  }
}

function extractDirect(url: string) {
  try {
    const u = new URL(normalize(url));
    const direct = u.searchParams.get("url") || u.searchParams.get("q");
    if (direct?.startsWith("http")) return direct;
  } catch {}
  return extractDirectByRegex(url) || normalize(url);
}

// Mirrors the Make.com "Text parser" pipeline the user used previously:
// 1) regex out the url=...(&ct) parameter
// 2) manually unescape leftover %3D / %3F / %26 the way that scenario's
//    chained replace steps did, for links the URL API fails to parse cleanly.
function extractDirectByRegex(raw: string) {
  const match = raw.match(/url=(https?:\/\/.*?)(?=&ct|&|$)/i);
  if (!match) return "";
  let value = match[1];
  value = value.replace(/%3D/gi, "=").replace(/%3F/gi, "?").replace(/%26/gi, "&");
  try {
    value = decodeURIComponent(value);
  } catch {}
  return value;
}

function findArticleUrl(text: string) {
  const cleaned = text
    .replace(/\u003d/g, "=")
    .replace(/\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
  const matches = cleaned.match(/https?:\/\/[^"'\\<>\s]+/g) || [];
  return matches.find((candidate) => isUsableArticleUrl(candidate)) || "";
}

async function decodeGoogleNewsArticle(url: string) {
  try {
    const page = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 AI-Content-Studio",
        Accept: "text/html,application/xhtml+xml",
      },
    }).then((res) => res.text());

    const signature = page.match(/data-n-a-sg=["']([^"']+)["']/)?.[1];
    const timestamp = page.match(/data-n-a-ts=["']([^"']+)["']/)?.[1];
    if (!signature || !timestamp) return "";

    const payload = [["Fbv4je", JSON.stringify(["garturlreq", [["ko", "KR", ["FINANCE_TOP_INDICES", "WEB_TEST_1_0_0"], null, null, 1, 1, "KR:ko", null, 180, null, null, null, null, null, 0, null, null, [1608992183, 723341000]], "ko", "KR", 1, [2, 3, 4, 8], 1, 0, "655000234", 0, 0, null, 0], url, Number(timestamp), signature]), null, "generic"]];
    const body = "f.req=" + encodeURIComponent(JSON.stringify(payload));
    const decoded = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "Mozilla/5.0 AI-Content-Studio",
      },
      body,
    }).then((res) => res.text());

    const cleaned = decoded
      .replace(/\\u003d/g, "=")
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/");
    const matches = cleaned.match(/https?:\/\/[^"\\]+/g) || [];
    const article = matches.find((candidate) => isUsableArticleUrl(candidate));
    return article || "";
  } catch {
    return "";
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("url") || "";
  const force = searchParams.get("force") === "1";
  const direct = stripGoogleParams(extractDirect(input));
  if (!direct) return NextResponse.json({ success: false, url: "" }, { status: 400 });
  if (!isGoogleOwnedUrl(direct)) return NextResponse.json({ success: true, url: direct, fallback: false });

  const decoded = await decodeGoogleNewsArticle(direct);
  if (decoded && !isGoogleOwnedUrl(decoded)) {
    return NextResponse.json({ success: true, url: decoded, fallback: false });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(direct, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 AI-Content-Studio" },
    });
    clearTimeout(timer);
    if (res.url && !isGoogleOwnedUrl(res.url)) {
      return NextResponse.json({ success: true, url: res.url, fallback: false });
    }

    const html = await res.text().catch(() => "");
    const canonical = extractCanonicalUrl(html);
    if (canonical) {
      return NextResponse.json({ success: true, url: canonical, fallback: false });
    }

    const fromHtml = findArticleUrl(html);
    if (fromHtml) {
      return NextResponse.json({ success: true, url: fromHtml, fallback: false });
    }
  } catch {}

  return NextResponse.json({
    success: true,
    url: direct,
    fallback: true,
    message: "원문 복원 실패: Google News 암호화 링크이거나 언론사/Google이 서버 접근을 막았습니다. 잠시 후 재시도할 수 있습니다.",
  });
}
