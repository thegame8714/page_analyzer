// CLI entry point for the analyzer, used by the landing-page-analyzer agent.
// Usage: npx tsx scripts/analyze.ts <url | localhost:port/path | file.html | folder>
//          [--product landing|evergreen] [--funnel auto|call|checkout] [--lang en|it] [--json]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeHtml, analyzePage } from "../src/lib/analyze";
import { AnalysisReport, FunnelMode, Lang, Product, pick } from "../src/lib/analyze/types";

function toMarkdown(r: AnalysisReport, lang: Lang): string {
  const t = (text: Parameters<typeof pick>[0]) => pick(text, lang);
  const lines: string[] = [];
  lines.push(`# ${r.product === "coaching" ? "Evergreen" : "Landing page"} report: ${r.finalUrl}`);
  lines.push(`Overall: ${r.overallScore}/100 (grade ${r.overallGrade})`, "");
  if (r.funnel) {
    lines.push(`Funnel: ${r.funnel.type === "call" ? "free call / application" : "direct purchase"} — ${t(r.funnel.reason)}`);
    r.funnel.steps.forEach((s, i) => lines.push(`  ${i + 1}. ${t(s.label)}${s.url ? ` <${s.url}>` : ""}`));
    lines.push("");
  }
  lines.push("| Category | Score | Grade |", "|---|---|---|");
  for (const c of r.categories) lines.push(`| ${t(c.name)} | ${c.score} | ${c.grade} |`);
  lines.push("", "## Top recommendations");
  r.topRecommendations.forEach((rec, i) => lines.push(`${i + 1}. [${t(rec.category)}] ${t(rec.detail)}`));
  for (const c of r.categories) {
    lines.push("", `## ${t(c.name)} (${c.score}/100)`, t(c.summary));
    for (const f of c.findings) {
      lines.push(`- [${f.status.toUpperCase()}] **${t(f.label)}**: ${t(f.detail)}`);
      for (const item of f.items ?? []) {
        lines.push(`    - ${t(item.text)}${item.href ? ` <${item.href}>` : ""}`);
      }
    }
  }
  return lines.join("\n");
}

// A path to an HTML file (or a folder containing index.html) is analyzed
// straight from disk, so a page can be tested before it's served anywhere.
function resolveLocalFile(target: string): string | null {
  const p = path.resolve(target);
  if (!fs.existsSync(p)) return null;
  if (fs.statSync(p).isFile()) return p;
  const index = path.join(p, "index.html");
  return fs.existsSync(index) ? index : null;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  // The CLI only ever runs on your own machine, so local targets are fine.
  process.env.ALLOW_LOCAL_URLS = "1";
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const product: Product = flag(args, "product") === "evergreen" ? "coaching" : "landing";
  const funnel = flag(args, "funnel");
  const mode: FunnelMode = funnel === "call" || funnel === "checkout" ? funnel : "auto";
  const lang: Lang = flag(args, "lang") === "it" ? "it" : "en";
  const valueFlags = new Set(["--product", "--funnel", "--lang"]);
  const target = args.find((a, i) => !a.startsWith("--") && !valueFlags.has(args[i - 1]));
  if (!target) {
    console.error(
      "Usage: npx tsx scripts/analyze.ts <url | localhost:port/path | file.html | folder> [--product landing|evergreen] [--funnel auto|call|checkout] [--lang en|it] [--json]"
    );
    process.exit(2);
  }
  try {
    const file = resolveLocalFile(target);
    const options = { product, mode };
    const report = file
      ? await analyzeHtml(fs.readFileSync(file, "utf8"), pathToFileURL(file).toString(), options)
      : await analyzePage(target, options);
    console.log(asJson ? JSON.stringify(report, null, 2) : toMarkdown(report, lang));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
