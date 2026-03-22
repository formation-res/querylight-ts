import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Application, type JSONOutput } from "typedoc";
import type { DocEntry } from "./demo-data";

const API_DOC_SECTION = "API Reference";
const API_DOC_LEVEL: DocEntry["level"] = "foundation";
const API_GROUP_ORDER = [
  "Classes",
  "Functions",
  "Interfaces",
  "Type Aliases",
  "Enumerations"
] as const;

type ReflectionLookup = {
  byId: Map<number, JSONOutput.SomeReflection>;
  parentById: Map<number, number | null>;
  topLevelById: Map<number, JSONOutput.DeclarationReflection>;
  pageById: Map<number, string>;
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function slugify(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}

function commentText(parts: JSONOutput.CommentDisplayPart[] | undefined, lookup: ReflectionLookup): string {
  if (!parts || parts.length === 0) {
    return "";
  }

  return normalizeWhitespace(parts.map((part) => {
    switch (part.kind) {
      case "text":
        return part.text;
      case "code":
        return `\`${part.text}\``;
      case "inline-tag":
        if (typeof part.target === "number") {
          const href = linkForReflection(part.target, lookup);
          if (href) {
            return `[${part.text || reflectionName(part.target, lookup)}](${href})`;
          }
        }
        return part.text ? `\`${part.text}\`` : "";
      case "relative-link":
        return part.text;
      default:
        return "";
    }
  }).join(""));
}

function plainCommentText(parts: JSONOutput.CommentDisplayPart[] | undefined): string {
  if (!parts || parts.length === 0) {
    return "";
  }
  return normalizeWhitespace(parts.map((part) => part.text).join(""));
}

function reflectionName(id: number, lookup: ReflectionLookup): string {
  return lookup.byId.get(id)?.name ?? "API";
}

function linkForReflection(id: number, lookup: ReflectionLookup): string | null {
  const topLevel = lookup.topLevelById.get(id);
  if (!topLevel) {
    return null;
  }
  return lookup.pageById.get(topLevel.id) ?? null;
}

function renderType(type: JSONOutput.SomeType | undefined, lookup: ReflectionLookup): string {
  if (!type) {
    return "void";
  }

  switch (type.type) {
    case "intrinsic":
      return type.name;
    case "literal":
      return typeof type.value === "string" ? JSON.stringify(type.value) : String(type.value);
    case "array":
      return `${renderType(type.elementType, lookup)}[]`;
    case "union":
      return type.types.map((entry) => renderType(entry, lookup)).join(" | ");
    case "intersection":
      return type.types.map((entry) => renderType(entry, lookup)).join(" & ");
    case "reference": {
      const base = type.name;
      const args = type.typeArguments?.length
        ? `<${type.typeArguments.map((entry) => renderType(entry, lookup)).join(", ")}>`
        : "";
      return `${base}${args}`;
    }
    case "tuple":
      return `[${(type.elements ?? []).map((entry) => renderType(entry, lookup)).join(", ")}]`;
    case "namedTupleMember":
      return `${type.name}${type.isOptional ? "?" : ""}: ${renderType(type.element, lookup)}`;
    case "optional":
      return `${renderType(type.elementType, lookup)}?`;
    case "rest":
      return `...${renderType(type.elementType, lookup)}`;
    case "query":
      return `typeof ${renderType(type.queryType, lookup)}`;
    case "predicate":
      return `${type.asserts ? "asserts " : ""}${type.name}${type.targetType ? ` is ${renderType(type.targetType, lookup)}` : ""}`;
    case "typeOperator":
      return `${type.operator} ${renderType(type.target, lookup)}`;
    case "indexedAccess":
      return `${renderType(type.objectType, lookup)}[${renderType(type.indexType, lookup)}]`;
    case "conditional":
      return `${renderType(type.checkType, lookup)} extends ${renderType(type.extendsType, lookup)} ? ${renderType(type.trueType, lookup)} : ${renderType(type.falseType, lookup)}`;
    case "reflection": {
      if (type.declaration.signatures?.length) {
        return type.declaration.signatures.map((signature) => renderSignature(signature, lookup, "")).join(" | ");
      }
      const members = (type.declaration.children ?? [])
        .map((child) => `${child.name}${child.flags.isOptional ? "?" : ""}: ${renderType(child.type, lookup)}`);
      return members.length > 0 ? `{ ${members.join("; ")} }` : "{}";
    }
    case "templateLiteral":
      return `\`${type.head}${type.tail.map(([entry, text]) => `\${${renderType(entry, lookup)}}${text}`).join("")}\``;
    case "mapped":
      return `{ [${type.parameter} in ${renderType(type.parameterType, lookup)}]: ${renderType(type.templateType, lookup)} }`;
    case "inferred":
      return type.constraint ? `${type.name} extends ${renderType(type.constraint, lookup)}` : type.name;
    case "unknown":
      return type.name;
    default:
      return "unknown";
  }
}

function renderTypeParameters(typeParameters: JSONOutput.TypeParameterReflection[] | undefined, lookup: ReflectionLookup): string {
  if (!typeParameters || typeParameters.length === 0) {
    return "";
  }

  return `<${typeParameters.map((param) => {
    const constraint = param.type ? ` extends ${renderType(param.type, lookup)}` : "";
    const defaultType = param.default ? ` = ${renderType(param.default, lookup)}` : "";
    return `${param.name}${constraint}${defaultType}`;
  }).join(", ")}>`;
}

function renderParameter(parameter: JSONOutput.ParameterReflection, lookup: ReflectionLookup): string {
  const isRest = parameter.type?.type === "rest";
  const name = `${isRest ? "..." : ""}${parameter.name}${parameter.flags.isOptional ? "?" : ""}`;
  return `${name}: ${renderType(parameter.type, lookup)}`;
}

function renderSignature(
  signature: JSONOutput.SignatureReflection,
  lookup: ReflectionLookup,
  name: string,
  prefix = "function"
): string {
  const typeParameters = renderTypeParameters(signature.typeParameters, lookup);
  const params = (signature.parameters ?? []).map((parameter) => renderParameter(parameter, lookup)).join(", ");
  const returnType = renderType(signature.type, lookup);
  return `${prefix} ${name}${typeParameters}(${params}): ${returnType}`.trim();
}

function renderDeclaration(reflection: JSONOutput.DeclarationReflection, lookup: ReflectionLookup): string {
  const typeParameters = renderTypeParameters(reflection.typeParameters, lookup);

  if (reflection.signatures?.length) {
    return reflection.signatures.map((signature) => renderSignature(signature, lookup, reflection.name)).join("\n");
  }

  const groupTitle = reflection.groups?.find((group) => group.children?.includes(reflection.id))?.title;
  switch (groupTitle) {
    case "Enumerations":
      return `enum ${reflection.name}`;
    default:
      break;
  }

  if (reflection.kind === 128) {
    return `class ${reflection.name}${typeParameters}`;
  }
  if (reflection.kind === 256) {
    return `interface ${reflection.name}${typeParameters}`;
  }
  if (reflection.kind === 4194304) {
    return `type ${reflection.name}${typeParameters} = ${renderType(reflection.type, lookup)}`;
  }
  if (reflection.children?.length && reflection.children.every((child) => child.kind === 16)) {
    return `enum ${reflection.name}`;
  }
  return `${reflection.name}${typeParameters}`;
}

function collectLookup(project: JSONOutput.ProjectReflection): ReflectionLookup {
  const byId = new Map<number, JSONOutput.SomeReflection>();
  const parentById = new Map<number, number | null>();
  const topLevelById = new Map<number, JSONOutput.DeclarationReflection>();
  const pageById = new Map<number, string>();
  const topLevelChildren = project.children ?? [];

  const walk = (
    reflection: JSONOutput.SomeReflection,
    parentId: number | null,
    topLevel: JSONOutput.DeclarationReflection | null
  ): void => {
    byId.set(reflection.id, reflection);
    parentById.set(reflection.id, parentId);
    if (topLevel) {
      topLevelById.set(reflection.id, topLevel);
    }

    const children = "children" in reflection ? (reflection.children ?? []) : [];
    children.forEach((child) => walk(child, reflection.id, topLevel));

    if ("signatures" in reflection) {
      (reflection.signatures ?? []).forEach((signature) => walk(signature, reflection.id, topLevel));
    }
    if ("indexSignatures" in reflection) {
      (reflection.indexSignatures ?? []).forEach((signature) => walk(signature, reflection.id, topLevel));
    }
    if ("getSignature" in reflection) {
      asArray(reflection.getSignature).forEach((signature) => walk(signature, reflection.id, topLevel));
    }
    if ("setSignature" in reflection) {
      asArray(reflection.setSignature).forEach((signature) => walk(signature, reflection.id, topLevel));
    }
    if ("typeParameters" in reflection) {
      (reflection.typeParameters ?? []).forEach((parameter) => walk(parameter, reflection.id, topLevel));
    }
    if ("parameters" in reflection) {
      (reflection.parameters ?? []).forEach((parameter) => walk(parameter, reflection.id, topLevel));
    }
  };

  topLevelChildren.forEach((reflection) => {
    const relativeUrl = `/docs/api/${slugify(reflection.name)}/`;
    pageById.set(reflection.id, relativeUrl);
    walk(reflection, project.id, reflection);
  });

  return {
    byId,
    parentById,
    topLevelById,
    pageById
  };
}

function renderSignatureSection(
  reflection: JSONOutput.DeclarationReflection,
  lookup: ReflectionLookup
): string[] {
  const blocks: string[] = [];

  if (reflection.signatures?.length) {
    blocks.push("## Signatures");
    reflection.signatures.forEach((signature) => {
      blocks.push("```ts");
      blocks.push(renderSignature(signature, lookup, reflection.name));
      blocks.push("```");
      const signatureSummary = commentText(signature.comment?.summary, lookup);
      if (signatureSummary) {
        blocks.push(signatureSummary);
      }
      if (signature.parameters?.length) {
        blocks.push("### Parameters");
        signature.parameters.forEach((parameter) => {
          const description = commentText(parameter.comment?.summary, lookup);
          blocks.push(`- \`${renderParameter(parameter, lookup)}\`${description ? `: ${description}` : ""}`);
        });
      }
      const returns = reflection.comment?.blockTags?.find((tag) => tag.tag === "@returns")
        ?? signature.comment?.blockTags?.find((tag) => tag.tag === "@returns");
      if (returns) {
        blocks.push("### Returns");
        blocks.push(commentText(returns.content, lookup));
      }
    });
  }

  if (reflection.type) {
    blocks.push("## Type");
    blocks.push("```ts");
    blocks.push(renderType(reflection.type, lookup));
    blocks.push("```");
  }

  return blocks;
}

function renderMember(reflection: JSONOutput.DeclarationReflection, lookup: ReflectionLookup): string[] {
  const lines: string[] = [`### ${escapeMarkdown(reflection.name)}`];
  const comment = commentText(reflection.comment?.summary, lookup);

  if (reflection.signatures?.length) {
    reflection.signatures.forEach((signature) => {
      lines.push("```ts");
      lines.push(renderSignature(signature, lookup, reflection.name, ""));
      lines.push("```");
      const signatureSummary = commentText(signature.comment?.summary, lookup);
      if (signatureSummary) {
        lines.push(signatureSummary);
      }
      if (signature.parameters?.length) {
        lines.push("Parameters:");
        signature.parameters.forEach((parameter) => {
          const description = commentText(parameter.comment?.summary, lookup);
          lines.push(`- \`${renderParameter(parameter, lookup)}\`${description ? `: ${description}` : ""}`);
        });
      }
    });
  } else if (asArray(reflection.getSignature).length || asArray(reflection.setSignature).length) {
    const getter = asArray(reflection.getSignature)[0];
    const setter = asArray(reflection.setSignature)[0];
    lines.push("```ts");
    if (getter) {
      lines.push(`get ${reflection.name}(): ${renderType(getter.type, lookup)}`);
    }
    if (setter) {
      lines.push(`set ${reflection.name}(${(setter.parameters ?? []).map((parameter) => renderParameter(parameter, lookup)).join(", ")})`);
    }
    lines.push("```");
  } else if (reflection.type) {
    lines.push("```ts");
    lines.push(`${reflection.name}${reflection.flags.isOptional ? "?" : ""}: ${renderType(reflection.type, lookup)}`);
    lines.push("```");
  } else if (reflection.children?.every((child) => child.kind === 16)) {
    lines.push("```ts");
    lines.push(`enum ${reflection.name}`);
    lines.push("```");
  }

  if (comment) {
    lines.push(comment);
  }

  if (reflection.children?.length && reflection.children.every((child) => child.kind === 16)) {
    lines.push("Members:");
    reflection.children.forEach((child) => {
      const childSummary = commentText(child.comment?.summary, lookup);
      lines.push(`- \`${child.name}\`${child.defaultValue ? ` = ${child.defaultValue}` : ""}${childSummary ? `: ${childSummary}` : ""}`);
    });
  }

  return lines;
}

function renderMembersSection(reflection: JSONOutput.DeclarationReflection, lookup: ReflectionLookup): string[] {
  const members = (reflection.children ?? []).filter((child) => child.name !== "constructor");
  const constructors = (reflection.children ?? []).filter((child) => child.name === "constructor");
  const lines: string[] = [];

  if (constructors.length > 0) {
    lines.push("## Constructors");
    constructors.forEach((ctor) => {
      lines.push(...renderMember(ctor, lookup));
    });
  }

  if (members.length > 0) {
    lines.push("## Members");
    members.forEach((member) => {
      lines.push(...renderMember(member, lookup));
    });
  }

  return lines;
}

function renderRemarks(reflection: JSONOutput.DeclarationReflection, lookup: ReflectionLookup): string[] {
  const lines: string[] = [];
  const remarks = reflection.comment?.blockTags?.find((tag) => tag.tag === "@remarks");
  const examples = reflection.comment?.blockTags?.filter((tag) => tag.tag === "@example") ?? [];

  if (remarks) {
    lines.push("## Remarks");
    lines.push(commentText(remarks.content, lookup));
  }

  if (examples.length > 0) {
    lines.push("## Examples");
    examples.forEach((example) => {
      lines.push(commentText(example.content, lookup));
    });
  }

  return lines;
}

function inferGroupTitle(
  reflection: JSONOutput.DeclarationReflection,
  project: JSONOutput.ProjectReflection
): string {
  const group = project.groups?.find((entry) => entry.children?.includes(reflection.id));
  return group?.title ?? "API";
}

function buildRelatedApis(reflection: JSONOutput.DeclarationReflection, lookup: ReflectionLookup): string[] {
  const related = new Set<string>([reflection.name]);

  const collectFromType = (type: JSONOutput.SomeType | undefined): void => {
    if (!type) {
      return;
    }
    if (type.type === "reference" && typeof type.target === "number") {
      const linked = lookup.topLevelById.get(type.target);
      if (linked) {
        related.add(linked.name);
      }
      type.typeArguments?.forEach(collectFromType);
      return;
    }
    if ("elementType" in type && type.elementType) {
      collectFromType(type.elementType);
    }
    if ("types" in type && type.types) {
      type.types.forEach(collectFromType);
    }
    if ("typeArguments" in type && type.typeArguments) {
      type.typeArguments.forEach(collectFromType);
    }
    if (type.type === "reflection") {
      type.declaration.children?.forEach((child) => collectFromType(child.type));
      type.declaration.signatures?.forEach((signature) => {
        signature.parameters?.forEach((parameter) => collectFromType(parameter.type));
        collectFromType(signature.type);
      });
    }
  };

  collectFromType(reflection.type);
  reflection.signatures?.forEach((signature) => {
    signature.parameters?.forEach((parameter) => collectFromType(parameter.type));
    collectFromType(signature.type);
  });
  reflection.children?.forEach((child) => collectFromType(child.type));

  return [...related];
}

function summaryForReflection(reflection: JSONOutput.DeclarationReflection): string {
  const fromReflection = plainCommentText(reflection.comment?.summary);
  if (fromReflection) {
    return fromReflection;
  }

  const fromSignature = reflection.signatures
    ?.map((signature) => plainCommentText(signature.comment?.summary))
    .find(Boolean);
  if (fromSignature) {
    return fromSignature;
  }

  return `Generated API reference for ${reflection.name}.`;
}

function createApiDocEntry(
  reflection: JSONOutput.DeclarationReflection,
  lookup: ReflectionLookup,
  project: JSONOutput.ProjectReflection,
  index: number
): DocEntry {
  const summary = summaryForReflection(reflection);
  const groupTitle = inferGroupTitle(reflection, project);
  const sectionTag = slugify(groupTitle);
  const title = reflection.name;
  const markdownLines = [
    `# ${escapeMarkdown(title)}`,
    "",
    summary,
    "",
    "## Declaration",
    "",
    "```ts",
    renderDeclaration(reflection, lookup),
    "```",
    "",
    ...renderSignatureSection(reflection, lookup),
    ...renderMembersSection(reflection, lookup),
    ...renderRemarks(reflection, lookup)
  ].filter((line, lineIndex, lines) => !(line === "" && lines[lineIndex - 1] === ""));

  return {
    id: `api-${slugify(title)}`,
    section: API_DOC_SECTION,
    title,
    summary,
    tags: ["api-reference", sectionTag],
    apis: buildRelatedApis(reflection, lookup),
    level: API_DOC_LEVEL,
    order: index + 2,
    markdown: `${markdownLines.join("\n").trim()}\n`,
    body: normalizeWhitespace(markdownLines.join(" ")),
    wordCount: normalizeWhitespace(markdownLines.join(" ")).split(/\s+/).filter(Boolean).length,
    examples: [],
    path: `docs/api/${slugify(title)}.md`
  };
}

function buildApiIndexEntry(
  project: JSONOutput.ProjectReflection,
  lookup: ReflectionLookup
): DocEntry {
  const topLevelByGroup = new Map<string, JSONOutput.DeclarationReflection[]>();

  for (const groupTitle of API_GROUP_ORDER) {
    topLevelByGroup.set(groupTitle, []);
  }

  (project.children ?? []).forEach((reflection) => {
    const groupTitle = inferGroupTitle(reflection, project);
    const bucket = topLevelByGroup.get(groupTitle) ?? [];
    bucket.push(reflection);
    topLevelByGroup.set(groupTitle, bucket);
  });

  const lines = [
    "# API Reference",
    "",
    "Generated symbol-level documentation for the published `@tryformation/querylight-ts` API surface.",
    "",
    "Use this section for constructor signatures, interfaces, type aliases, and exported utility functions. Use the rest of the docs for guides and behavior-focused articles.",
    ""
  ];

  API_GROUP_ORDER.forEach((groupTitle) => {
    const entries = (topLevelByGroup.get(groupTitle) ?? []).sort((left, right) => left.name.localeCompare(right.name));
    if (entries.length === 0) {
      return;
    }
    lines.push(`## ${groupTitle}`);
    lines.push("");
    entries.forEach((entry) => {
      const href = lookup.pageById.get(entry.id) ?? `/docs/api/${slugify(entry.name)}/`;
      const summary = plainCommentText(entry.comment?.summary) || `Reference for ${entry.name}.`;
      lines.push(`- [${entry.name}](${href}): ${summary}`);
    });
    lines.push("");
  });

  const body = normalizeWhitespace(lines.join(" "));

  return {
    id: "api-reference",
    section: API_DOC_SECTION,
    title: "API Reference",
    summary: "Generated symbol-level API documentation for the published Querylight TS surface.",
    tags: ["api-reference", "reference", "tsdoc"],
    apis: ["DocumentIndex", "MatchQuery", "createSimpleTextSearchIndex"],
    level: API_DOC_LEVEL,
    order: 1,
    markdown: `${lines.join("\n").trim()}\n`,
    body,
    wordCount: body.split(/\s+/).filter(Boolean).length,
    examples: [],
    path: "docs/api.md"
  };
}

export async function buildApiDocEntries(rootDir: string): Promise<DocEntry[]> {
  const entryPoint = path.resolve(rootDir, "packages/querylight/src/index.ts");
  const tsconfig = path.resolve(rootDir, "packages/querylight/tsconfig.docs.json");
  const tmpFile = path.resolve(os.tmpdir(), `querylight-ts-typedoc-${process.pid}.json`);

  const app = await Application.bootstrapWithPlugins({
    entryPoints: [entryPoint],
    entryPointStrategy: "resolve",
    tsconfig,
    excludePrivate: true,
    treatWarningsAsErrors: false,
    intentionallyNotExported: ["Position", "BoundingBox"],
    sort: ["source-order"]
  });

  const project = await app.convert();
  if (!project) {
    throw new Error("TypeDoc did not return a project reflection.");
  }

  await app.generateJson(project, tmpFile);
  const serialized = JSON.parse(fs.readFileSync(tmpFile, "utf8")) as JSONOutput.ProjectReflection;
  fs.rmSync(tmpFile, { force: true });

  const lookup = collectLookup(serialized);
  const entries = (serialized.children ?? []).map((reflection, index) => createApiDocEntry(reflection, lookup, serialized, index));
  const groupedEntries = entries.sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
  return [buildApiIndexEntry(serialized, lookup), ...groupedEntries];
}
