import { Analyzer, EdgeNgramsTokenFilter, NgramTokenFilter } from "./analysis";
import { DocumentIndex, TextFieldIndex } from "./document-index";
import { BoolQuery, MatchPhrase, MatchQuery, OP } from "./query";
import { type Hits, RankingAlgorithm, reciprocalRankFusion } from "./shared";

export interface SimpleTextSearchRequest {
  query: string;
  from?: number;
  limit?: number;
}

export interface CreateSimpleTextSearchIndexOptions<T extends Record<string, unknown>> {
  documents: T[];
  primaryFields: (Extract<keyof T, string>)[];
  secondaryFields?: (Extract<keyof T, string>)[];
  idField?: Extract<keyof T, string>;
  ranking?: RankingAlgorithm;
}

export interface SimpleTextSearchIndex<T extends Record<string, unknown> = Record<string, unknown>> {
  documentIndex: DocumentIndex;
  fuzzyIndex: DocumentIndex;
  documents: T[];
  documentsById: Map<string, T>;
  idField: string;
  primaryFields: string[];
  secondaryFields: string[];
  ranking: RankingAlgorithm;
  primarySuggestField: string;
  secondarySuggestField: string;
  fuzzyField: string;
}

const SIMPLE_TEXT_SEARCH_PRIMARY_SUGGEST_FIELD = "__simpleTextSearchPrimarySuggest";
const SIMPLE_TEXT_SEARCH_SECONDARY_SUGGEST_FIELD = "__simpleTextSearchSecondarySuggest";
const SIMPLE_TEXT_SEARCH_FUZZY_FIELD = "__simpleTextSearchFuzzy";

function parseSimpleTextSearchInput(rawQuery: string): { queryText: string; quotedPhrase: string | null } {
  const quotedPhrase = rawQuery.match(/\"([^\"]+)\"/)?.[1] ?? null;
  return {
    queryText: rawQuery.replace(/"/g, "").trim(),
    quotedPhrase
  };
}

function coerceSearchableFieldValue(document: Record<string, unknown>, field: string): string[] {
  const value = document[field];
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  throw new Error(`field '${field}' should be a string or string[]`);
}

function ensureFieldList(name: string, fields: string[]): void {
  if (fields.length === 0) {
    throw new Error(`${name} should contain at least one field`);
  }
}

export function createSimpleTextSearchIndex<T extends Record<string, unknown>>(
  {
    documents,
    primaryFields,
    secondaryFields = [],
    idField = "id" as Extract<keyof T, string>,
    ranking = RankingAlgorithm.BM25
  }: CreateSimpleTextSearchIndexOptions<T>
): SimpleTextSearchIndex<T> {
  const normalizedPrimaryFields = [...new Set(primaryFields.map((field) => String(field)))];
  const normalizedSecondaryFields = [...new Set(
    secondaryFields
      .map((field) => String(field))
      .filter((field) => !normalizedPrimaryFields.includes(field))
  )];
  ensureFieldList("primaryFields", normalizedPrimaryFields);

  const edgeAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 10)]);
  const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
  const documentIndex = new DocumentIndex({
    ...Object.fromEntries(
      [...normalizedPrimaryFields, ...normalizedSecondaryFields].map((field) => [field, new TextFieldIndex(undefined, undefined, ranking)])
    ),
    [SIMPLE_TEXT_SEARCH_PRIMARY_SUGGEST_FIELD]: new TextFieldIndex(edgeAnalyzer, edgeAnalyzer, ranking),
    [SIMPLE_TEXT_SEARCH_SECONDARY_SUGGEST_FIELD]: new TextFieldIndex(edgeAnalyzer, edgeAnalyzer, ranking)
  });
  const fuzzyIndex = new DocumentIndex({
    [SIMPLE_TEXT_SEARCH_FUZZY_FIELD]: new TextFieldIndex(fuzzyAnalyzer, fuzzyAnalyzer, ranking)
  });
  const documentsById = new Map<string, T>();

  for (const document of documents) {
    const rawId = document[String(idField)];
    if (typeof rawId !== "string" || rawId.length === 0) {
      throw new Error(`id field '${String(idField)}' should be a non-empty string`);
    }

    const fields: Record<string, string[]> = {};
    const primaryTexts = normalizedPrimaryFields.flatMap((field) => {
      const values = coerceSearchableFieldValue(document, field);
      fields[field] = values;
      return values;
    });
    const secondaryTexts = normalizedSecondaryFields.flatMap((field) => {
      const values = coerceSearchableFieldValue(document, field);
      fields[field] = values;
      return values;
    });

    fields[SIMPLE_TEXT_SEARCH_PRIMARY_SUGGEST_FIELD] = [primaryTexts.join(" ")];
    fields[SIMPLE_TEXT_SEARCH_SECONDARY_SUGGEST_FIELD] = [secondaryTexts.join(" ")];
    documentIndex.index({ id: rawId, fields });
    fuzzyIndex.index({
      id: rawId,
      fields: {
        [SIMPLE_TEXT_SEARCH_FUZZY_FIELD]: [[...primaryTexts, ...secondaryTexts].join(" ")]
      }
    });
    documentsById.set(rawId, document);
  }

  return {
    documentIndex,
    fuzzyIndex,
    documents: [...documents],
    documentsById,
    idField: String(idField),
    primaryFields: normalizedPrimaryFields,
    secondaryFields: normalizedSecondaryFields,
    ranking,
    primarySuggestField: SIMPLE_TEXT_SEARCH_PRIMARY_SUGGEST_FIELD,
    secondarySuggestField: SIMPLE_TEXT_SEARCH_SECONDARY_SUGGEST_FIELD,
    fuzzyField: SIMPLE_TEXT_SEARCH_FUZZY_FIELD
  };
}

export function simpleTextSearch<T extends Record<string, unknown>>(
  index: SimpleTextSearchIndex<T>,
  { query, from = 0, limit = 20 }: SimpleTextSearchRequest
): Hits {
  const { queryText, quotedPhrase } = parseSimpleTextSearchInput(query);
  const trimmed = queryText.trim();
  if (trimmed.length === 0 || limit <= 0) {
    return [];
  }

  const branchLimit = Math.max(20, from + limit * 3);
  const phraseText = quotedPhrase ?? trimmed;
  const lexicalQuery = new BoolQuery({
    should: [
      ...index.primaryFields.map((field) => new MatchPhrase({ field, text: phraseText, slop: quotedPhrase ? 0 : 1, boost: 8 })),
      ...index.secondaryFields.map((field) => new MatchPhrase({ field, text: phraseText, slop: quotedPhrase ? 1 : 2, boost: 3 })),
      ...index.primaryFields.map((field) => new MatchQuery({ field, text: trimmed, operation: OP.AND, boost: 6 })),
      ...index.secondaryFields.map((field) => new MatchQuery({ field, text: trimmed, operation: OP.AND, boost: 2.5 })),
      new MatchQuery({ field: index.primarySuggestField, text: trimmed, operation: OP.OR, prefixMatch: true, boost: 4 }),
      ...(index.secondaryFields.length > 0
        ? [new MatchQuery({ field: index.secondarySuggestField, text: trimmed, operation: OP.OR, prefixMatch: true, boost: 2 })]
        : [])
    ]
  });
  const lexicalHits = index.documentIndex.searchRequest({ query: lexicalQuery, limit: branchLimit });
  const fuzzyHits = index.fuzzyIndex.searchRequest({
    query: new MatchQuery({ field: index.fuzzyField, text: trimmed, operation: OP.OR, boost: 1.5 }),
    limit: branchLimit
  });
  const fusedHits = reciprocalRankFusion([lexicalHits, fuzzyHits], { rankConstant: 20, weights: [3, 1] });
  return fusedHits.slice(from, Math.min(from + limit, fusedHits.length));
}
