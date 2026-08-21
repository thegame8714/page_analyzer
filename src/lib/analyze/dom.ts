import * as cheerio from "cheerio";

export type CheerioDoc = ReturnType<typeof cheerio.load>;

export function loadHtml(html: string): CheerioDoc {
  return cheerio.load(html);
}

const NOISE_SELECTORS = "script, style, noscript, template, svg";

// Inline elements render with no implied whitespace of their own — browsers
// (and copy/paste) butt their text directly against their neighbors. Pages
// commonly split a single word across two of these for partial styling (e.g.
// "<span>a</span><span>nd</span>" to color-highlight part of "and"), so
// padding every element boundary equally would fabricate a space that isn't
// really there and break the word apart. Only block-level boundaries get a
// synthetic space (matching how block elements act as implicit line breaks).
const INLINE_TAGS = new Set([
  "a", "span", "strong", "em", "b", "i", "u", "s", "sup", "sub", "mark",
  "small", "abbr", "cite", "code", "kbd", "q", "var", "time", "label",
  "font", "ins", "del", "bdi", "bdo", "wbr", "tt", "big", "samp", "output",
]);

/**
 * cheerio's .text() concatenates text nodes with no separator, so adjacent
 * block-level elements (e.g. two sibling <div>s) collapse into one run-on
 * word. Walk the tree and pad block-level boundaries with a space; leave
 * inline elements unpadded by default to match real rendered/copied text —
 * except when the preceding text already ends in punctuation, which means
 * this is a genuine break between separate units (e.g. a title and a
 * description each in their own <span>, glued together with no source
 * whitespace) rather than one word split across elements for styling.
 */
function textWithSpacing($: CheerioDoc, node: ReturnType<CheerioDoc>): string {
  let text = "";
  node.contents().each((_, child) => {
    if (child.type === "text") {
      text += (child as unknown as { data: string }).data;
    } else if (child.type === "tag") {
      const tag = child.tagName?.toLowerCase();
      if (tag === "br") {
        text += " ";
        return;
      }
      const inner = textWithSpacing($, $(child));
      if (tag && INLINE_TAGS.has(tag)) {
        const endsWithPunctuation = /[.!?:;,]$/.test(text);
        text += endsWithPunctuation ? ` ${inner}` : inner;
      } else {
        text += ` ${inner} `;
      }
    }
  });
  return text;
}

export function getVisibleText($: CheerioDoc): string {
  const clone = $.root().clone();
  clone.find(NOISE_SELECTORS).remove();
  return textWithSpacing($, clone).replace(/\s+/g, " ").trim();
}

export function getMainContentText($: CheerioDoc): string {
  const clone = $.root().clone();
  clone.find(`${NOISE_SELECTORS}, nav, footer, header, [role="navigation"]`).remove();
  return textWithSpacing($, clone).replace(/\s+/g, " ").trim();
}

const PROSE_SELECTOR = "p, li, blockquote, figcaption, h1, h2, h3, h4, h5, h6, td, th";

/**
 * Text for grammar/spell-checking should be actual written copy — paragraphs,
 * list items, headings — not the whole flattened page (nav links, button
 * labels, disjointed UI fragments), which reads as broken sentences to a
 * grammar checker and produces false positives. Each block is treated as its
 * own sentence-terminated unit; nested matches are skipped to avoid double
 * counting (e.g. a <p> inside a <li>).
 */
export function getProseText($: CheerioDoc): string {
  const clone = $.root().clone();
  clone.find(`${NOISE_SELECTORS}, nav, footer, header, [role="navigation"], button`).remove();
  const blocks: string[] = [];
  clone.find(PROSE_SELECTOR).each((_, el) => {
    if ($(el).find(PROSE_SELECTOR).length > 0) return;
    const t = textWithSpacing($, $(el)).replace(/\s+/g, " ").trim();
    if (t.length > 0) blocks.push(/[.!?:;,]$/.test(t) ? t : `${t}.`);
  });
  return blocks.join(" ");
}

export function getJsonLdBlocks($: CheerioDoc): unknown[] {
  const blocks: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // ignore invalid JSON-LD
    }
  });
  return blocks;
}

export function jsonLdTypes(blocks: unknown[]): string[] {
  const types: string[] = [];
  for (const b of blocks) {
    if (b && typeof b === "object") {
      const t = (b as Record<string, unknown>)["@type"];
      if (typeof t === "string") types.push(t);
      else if (Array.isArray(t)) types.push(...t.filter((x) => typeof x === "string"));
      const graph = (b as Record<string, unknown>)["@graph"];
      if (Array.isArray(graph)) types.push(...jsonLdTypes(graph));
    }
  }
  return types;
}

export function getHeadings($: CheerioDoc) {
  const headings: { level: number; text: string }[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const level = Number(el.tagName.substring(1));
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) headings.push({ level, text });
  });
  return headings;
}

export function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}
