import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { buildDashboardDataPayload, type DashboardDataPayload } from "./dashboard-data";
import { buildDemoDataPayload, type DemoDataPayload, type DocEntry } from "./demo-data";
import { serializeHeadingPath } from "../src/semantic";
import { docSourcePathToRelativePath, docSourcePathToUrl } from "../src/doc-routes";

const filePath = fileURLToPath(import.meta.url);
const buildDir = path.dirname(filePath);
const appDir = path.resolve(buildDir, "..");
const workspaceRoot = path.resolve(appDir, "../..");
const generatedDocsDir = path.resolve(appDir, "content/docs");
const staticDataDir = path.resolve(appDir, "static/data");
const publicDataDir = path.resolve(appDir, "public/data");
const dashboardSnapshotPath = path.resolve(buildDir, "fixtures/dashboard-data.snapshot.json");

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function rewriteHeadingAnchors(markdown: string): string {
  const lines = markdown.split("\n");
  const rewritten: string[] = [];
  let currentH2: string | null = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      currentH2 = h2[1]!.trim();
      const id = `chunk-anchor-${serializeHeadingPath([currentH2])}`;
      rewritten.push(`<h2 id="${escapeHtml(id)}">${escapeHtml(currentH2)}</h2>`);
      continue;
    }

    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      const currentH3 = h3[1]!.trim();
      const id = `chunk-anchor-${serializeHeadingPath([currentH2, currentH3].filter((value): value is string => Boolean(value)))}`;
      rewritten.push(`<h3 id="${escapeHtml(id)}">${escapeHtml(currentH3)}</h3>`);
      continue;
    }

    rewritten.push(line);
  }

  return rewritten.join("\n");
}

function rewriteDocLinks(markdown: string, docsByPath: Map<string, DocEntry>, sourcePath: string): string {
  return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text: string, href: string) => {
    if (/^(https?:|mailto:|tel:|#)/.test(href)) {
      return match;
    }

    const [pathname, hash = ""] = href.split("#");
    if (!pathname.endsWith(".md")) {
      return match;
    }

    const sourceRelative = sourcePath.replace(/^docs\//, "");
    const sourceDir = path.posix.dirname(sourceRelative);
    const resolvedPath = pathname.startsWith("/")
      ? pathname.replace(/^\//, "")
      : path.posix.normalize(path.posix.join(sourceDir, pathname));
    const targetDoc = docsByPath.get(path.posix.join("docs", resolvedPath));
    if (!targetDoc) {
      return match;
    }

    const targetUrl = `${docSourcePathToUrl(targetDoc.path, targetDoc.id)}${hash ? `#${hash}` : ""}`;
    return `[${text}](${targetUrl})`;
  });
}

function toFrontmatter(doc: DocEntry): string {
  const lines = [
    "---",
    `title: "${doc.title.replaceAll("\"", "\\\"")}"`,
    `description: "${doc.summary.replaceAll("\"", "\\\"")}"`,
    `doc_id: "${doc.id}"`,
    `doc_section: "${doc.section}"`,
    `doc_level: "${doc.level}"`,
    `doc_order: ${doc.order}`,
    `doc_source_path: "${doc.path}"`,
    `doc_url: "${docSourcePathToUrl(doc.path, doc.id)}"`,
    `url: "${docSourcePathToUrl(doc.path, doc.id)}"`,
    `tags: [${doc.tags.map((tag) => `"${tag.replaceAll("\"", "\\\"")}"`).join(", ")}]`,
    `apis: [${doc.apis.map((api) => `"${api.replaceAll("\"", "\\\"")}"`).join(", ")}]`,
    "---",
    ""
  ];
  return lines.join("\n");
}

function cleanGeneratedDocsDir(): void {
  fs.rmSync(generatedDocsDir, { recursive: true, force: true });
  fs.mkdirSync(generatedDocsDir, { recursive: true });
}

function writeDocsContent(payload: DemoDataPayload): void {
  const docsByPath = new Map(payload.docs.map((doc) => [doc.path, doc]));
  cleanGeneratedDocsDir();

  payload.docs.forEach((doc) => {
    const relativePath = docSourcePathToRelativePath(doc.path, doc.id);
    const outputPath = path.resolve(generatedDocsDir, relativePath);
    const rewrittenBody = rewriteHeadingAnchors(rewriteDocLinks(doc.markdown, docsByPath, doc.path));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${toFrontmatter(doc)}${rewrittenBody.trim()}\n`, "utf8");
  });
}

function writeDemoPayload(payload: DemoDataPayload): void {
  const docs = payload.docs.map((doc) => ({
    ...doc,
    url: docSourcePathToUrl(doc.path, doc.id)
  }));

  fs.mkdirSync(staticDataDir, { recursive: true });
  fs.rmSync(path.resolve(staticDataDir, "demo-data.json"), { force: true });
  fs.rmSync(path.resolve(publicDataDir, "demo-data.json"), { force: true });
  const serialized = JSON.stringify({ ...payload, docs });
  fs.writeFileSync(path.resolve(staticDataDir, "demo-data.json.gz"), gzipSync(serialized));
}

function writeDashboardPayload(payload: DashboardDataPayload): void {
  fs.mkdirSync(staticDataDir, { recursive: true });
  fs.writeFileSync(path.resolve(staticDataDir, "dashboard-data.json"), JSON.stringify(payload), "utf8");
}

function loadDashboardPayloadSnapshot(): DashboardDataPayload {
  return JSON.parse(fs.readFileSync(dashboardSnapshotPath, "utf8")) as DashboardDataPayload;
}

const demoPayload = await buildDemoDataPayload(workspaceRoot);
const dashboardPayload = await buildDashboardDataPayload().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Using committed dashboard snapshot because live dataset refresh failed: ${message}`);
  return loadDashboardPayloadSnapshot();
});

writeDocsContent(demoPayload);
writeDemoPayload(demoPayload);
writeDashboardPayload(dashboardPayload);
