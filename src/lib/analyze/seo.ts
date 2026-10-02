import { CheerioDoc, absoluteUrl, getHeadings, getJsonLdBlocks } from "./dom";
import { isLocalUrl } from "./normalizeUrl";
import { CategoryResult, Finding, FindingItem, gradeFromScore, scoreFromFindings } from "./types";

const MAX_ITEMS = 25;

export function analyzeSeo($: CheerioDoc, finalUrl: string): CategoryResult {
  const findings: Finding[] = [];

  const title = $("title").first().text().trim();
  if (!title) {
    findings.push({
      id: "title-missing",
      label: "Title tag",
      status: "fail",
      detail: "No <title> tag found. Every page needs a unique, descriptive title.",
      weight: 3,
    });
  } else if (title.length < 10 || title.length > 65) {
    findings.push({
      id: "title-length",
      label: "Title tag",
      status: "warn",
      detail: `Title is ${title.length} characters ("${title}"). Aim for 10-60 characters so it doesn't get truncated in search results.`,
      weight: 3,
    });
  } else {
    findings.push({
      id: "title-length",
      label: "Title tag",
      status: "pass",
      detail: `Title "${title}" is a good length (${title.length} chars).`,
      weight: 3,
    });
  }

  const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!metaDescription) {
    findings.push({
      id: "meta-description",
      label: "Meta description",
      status: "fail",
      detail: "No meta description found. Search engines will auto-generate a snippet instead.",
      weight: 3,
    });
  } else if (metaDescription.length < 50 || metaDescription.length > 165) {
    findings.push({
      id: "meta-description",
      label: "Meta description",
      status: "warn",
      detail: `Meta description is ${metaDescription.length} characters. Aim for 120-160 characters.`,
      weight: 3,
    });
  } else {
    findings.push({
      id: "meta-description",
      label: "Meta description",
      status: "pass",
      detail: `Meta description length is good (${metaDescription.length} chars).`,
      weight: 3,
    });
  }

  const headings = getHeadings($);
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    findings.push({
      id: "h1",
      label: "H1 heading",
      status: "fail",
      detail: "No H1 heading found. Add one clear H1 describing the page's main offer.",
      weight: 3,
    });
  } else if (h1s.length > 1) {
    findings.push({
      id: "h1",
      label: "H1 heading",
      status: "warn",
      detail: `Found ${h1s.length} H1 tags. Use exactly one H1 per page for clarity.`,
      weight: 3,
    });
  } else {
    findings.push({
      id: "h1",
      label: "H1 heading",
      status: "pass",
      detail: `Exactly one H1 found: "${h1s[0].text.slice(0, 80)}".`,
      weight: 3,
    });
  }

  let skipped = false;
  let prevLevel = 0;
  for (const h of headings) {
    if (prevLevel > 0 && h.level - prevLevel > 1) skipped = true;
    prevLevel = h.level;
  }
  findings.push({
    id: "heading-hierarchy",
    label: "Heading hierarchy",
    status: headings.length === 0 ? "warn" : skipped ? "warn" : "pass",
    detail:
      headings.length === 0
        ? "No headings found on the page."
        : skipped
        ? "Heading levels skip a level (e.g. H1 to H3), which hurts structure and accessibility."
        : `${headings.length} headings found with a logical hierarchy.`,
    weight: 1,
  });

  const canonical = $('link[rel="canonical"]').attr("href");
  findings.push({
    id: "canonical",
    label: "Canonical URL",
    status: canonical ? "pass" : "warn",
    detail: canonical
      ? `Canonical URL set to ${canonical}.`
      : "No canonical link tag. Add one to prevent duplicate-content issues.",
    weight: 1,
  });

  const viewport = $('meta[name="viewport"]').attr("content");
  findings.push({
    id: "viewport",
    label: "Mobile viewport tag",
    status: viewport ? "pass" : "fail",
    detail: viewport
      ? "Responsive viewport meta tag is present."
      : "Missing viewport meta tag — the page may not render well on mobile.",
    weight: 2,
  });

  const images = $("img");
  const totalImages = images.length;
  let missingAlt = 0;
  const missingAltItems: FindingItem[] = [];
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt && alt.trim()) return;
    missingAlt += 1;
    const src = $(el).attr("src") || $(el).attr("data-src");
    const resolved = src ? absoluteUrl(src, finalUrl) : null;
    if (missingAltItems.length >= MAX_ITEMS) return;
    let label = resolved ?? "Image with no src attribute";
    if (resolved) {
      try {
        const filename = new URL(resolved).pathname.split("/").pop();
        if (filename) label = filename;
      } catch {
        // keep full resolved URL as the label
      }
    }
    missingAltItems.push({ text: label, href: resolved ?? undefined });
  });
  if (missingAlt > MAX_ITEMS) {
    missingAltItems.push({ text: `…and ${missingAlt - MAX_ITEMS} more.` });
  }
  if (totalImages === 0) {
    findings.push({
      id: "image-alt",
      label: "Image alt text",
      status: "info",
      detail: "No images found on the page.",
      weight: 2,
    });
  } else {
    const coverage = 1 - missingAlt / totalImages;
    findings.push({
      id: "image-alt",
      label: "Image alt text",
      status: coverage === 1 ? "pass" : coverage >= 0.7 ? "warn" : "fail",
      detail: `${totalImages - missingAlt}/${totalImages} images have alt text (${Math.round(
        coverage * 100
      )}%).`,
      weight: 2,
      items: missingAltItems.length > 0 ? missingAltItems : undefined,
    });
  }

  const jsonLd = getJsonLdBlocks($);
  findings.push({
    id: "structured-data",
    label: "Structured data (JSON-LD)",
    status: jsonLd.length > 0 ? "pass" : "warn",
    detail:
      jsonLd.length > 0
        ? `${jsonLd.length} JSON-LD block(s) found, helping search engines understand the page.`
        : "No JSON-LD structured data found. Adding schema.org markup improves rich results.",
    weight: 2,
  });

  const ogTags = ["og:title", "og:description", "og:image"].filter(
    (p) => !!$(`meta[property="${p}"]`).attr("content")
  );
  findings.push({
    id: "open-graph",
    label: "Open Graph tags",
    status: ogTags.length === 3 ? "pass" : ogTags.length > 0 ? "warn" : "fail",
    detail: `${ogTags.length}/3 core Open Graph tags present (og:title, og:description, og:image). These control link previews on social shares.`,
    weight: 1,
  });

  const robots = $('meta[name="robots"]').attr("content") ?? "";
  const blocksIndexing = /noindex/i.test(robots);
  findings.push({
    id: "robots",
    label: "Indexability",
    status: blocksIndexing ? "fail" : "pass",
    detail: blocksIndexing
      ? `Robots meta tag contains "${robots}" — this page is blocked from search indexing.`
      : "Page is indexable (no noindex directive).",
    weight: 2,
  });

  const lang = $("html").attr("lang");
  findings.push({
    id: "lang",
    label: "Language attribute",
    status: lang ? "pass" : "warn",
    detail: lang
      ? `<html lang="${lang}"> is set.`
      : "Missing lang attribute on <html>, which helps search engines and screen readers.",
    weight: 1,
  });

  const isHttps = finalUrl.startsWith("https://");
  const isLocal = isLocalUrl(finalUrl);
  findings.push({
    id: "https",
    label: "HTTPS",
    // A local dev server is normally plain http — that says nothing about
    // how the deployed page will be served, so don't penalize it.
    status: isHttps ? "pass" : isLocal ? "info" : "fail",
    detail: isHttps
      ? "Page is served over HTTPS."
      : isLocal
      ? "Local page, so HTTPS isn't checked. Make sure the deployed site is served over HTTPS."
      : "Page is not served over HTTPS, which hurts trust and rankings.",
    weight: 2,
  });

  const score = scoreFromFindings(findings);
  return {
    key: "seo",
    name: "SEO",
    score,
    grade: gradeFromScore(score),
    summary: "Traditional on-page search engine optimization signals.",
    findings,
  };
}
