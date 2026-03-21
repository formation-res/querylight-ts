import path from "node:path";

export function docSourcePathToRelativePath(sourcePath: string, docId: string): string {
  const normalized = sourcePath.replace(/^docs\//, "");
  if (normalized === "index.md") {
    return `${docId}.md`;
  }
  return normalized;
}

export function docSourcePathToUrl(sourcePath: string, docId: string): string {
  const relativePath = docSourcePathToRelativePath(sourcePath, docId);
  const withoutExtension = relativePath.replace(/\.md$/, "");
  return `/docs/${withoutExtension}/`;
}

export function resolveDocLink(sourcePath: string, targetPath: string): string {
  if (/^(https?:|mailto:|tel:|#)/.test(targetPath)) {
    return targetPath;
  }

  const [pathname, hash = ""] = targetPath.split("#");
  const normalizedPath = pathname.trim();
  if (!normalizedPath.endsWith(".md")) {
    return targetPath;
  }

  const sourceRelative = sourcePath.replace(/^docs\//, "");
  const sourceDir = path.posix.dirname(sourceRelative);
  const resolved = normalizedPath.startsWith("/")
    ? normalizedPath.replace(/^\//, "")
    : path.posix.normalize(path.posix.join(sourceDir, normalizedPath));

  const routePath = resolved === "index.md"
    ? "documentation-index"
    : resolved.replace(/\.md$/, "");

  return `/docs/${routePath}/${hash ? `#${hash}` : ""}`;
}
