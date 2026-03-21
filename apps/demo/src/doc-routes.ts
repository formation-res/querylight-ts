function posixDirname(value: string): string {
  const normalized = value.replace(/\/+$/, "");
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex === -1 ? "." : normalized.slice(0, slashIndex) || "/";
}

function normalizePosixPath(value: string): string {
  const isAbsolute = value.startsWith("/");
  const segments = value.split("/");
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (normalized.length > 0 && normalized[normalized.length - 1] !== "..") {
        normalized.pop();
      } else if (!isAbsolute) {
        normalized.push("..");
      }
      continue;
    }
    normalized.push(segment);
  }

  const joined = normalized.join("/");
  if (isAbsolute) {
    return `/${joined}`;
  }
  return joined || ".";
}

function joinPosixPath(...parts: string[]): string {
  return normalizePosixPath(parts.filter(Boolean).join("/"));
}

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
  const sourceDir = posixDirname(sourceRelative);
  const resolved = normalizedPath.startsWith("/")
    ? normalizedPath.replace(/^\//, "")
    : joinPosixPath(sourceDir, normalizedPath);

  const routePath = resolved === "index.md"
    ? "documentation-index"
    : resolved.replace(/\.md$/, "");

  return `/docs/${routePath}/${hash ? `#${hash}` : ""}`;
}
