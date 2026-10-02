// CLI entry point for the analyzer, used by the landing-page-analyzer agent.
// Usage: npx tsx scripts/analyze.ts <url | localhost:port/path | file.html | folder> [--json]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeHtml, analyzeLandingPage } from "../src/lib/analyze";
import type { AnalysisReport } from "../src/lib/analyze/types";

function toMarkdown(r: AnalysisReport): string {
  const lines: string[] = [];
  lines.push(`# Landing page report: ${r.finalUrl}`);
  lines.push(`Overall: ${r.overallScore}/100 (grade ${r.overallGrade})`, "");
  lines.push("| Category | Score | Grade |", "|---|---|---|");
  for (const c of r.categories) lines.push(`| ${c.name} | ${c.score} | ${c.grade} |`);
  lines.push("", "## Top recommendations");
  r.topRecommendations.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
  for (const c of r.categories) {
    lines.push("", `## ${c.name} (${c.score}/100)`, c.summary);
    for (const f of c.findings) {
      lines.push(`- [${f.status.toUpperCase()}] **${f.label}**: ${f.detail}`);
      for (const item of f.items ?? []) {
        lines.push(`    - ${item.text}${item.href ? ` <${item.href}>` : ""}`);
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

async function main() {
  // The CLI only ever runs on your own machine, so local targets are fine.
  process.env.ALLOW_LOCAL_URLS = "1";
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const url = args.find((a) => !a.startsWith("--"));
  if (!url) {
    console.error("Usage: npx tsx scripts/analyze.ts <url | localhost:port/path | file.html | folder> [--json]");
    process.exit(2);
  }
  try {
    const file = resolveLocalFile(url);
    const report = file
      ? await analyzeHtml(fs.readFileSync(file, "utf8"), pathToFileURL(file).toString())
      : await analyzeLandingPage(url);
    console.log(asJson ? JSON.stringify(report, null, 2) : toMarkdown(report));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
