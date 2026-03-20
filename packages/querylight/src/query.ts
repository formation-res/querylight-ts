import { type PolygonCoordinates } from "./geo";
import { DocumentIndex, GeoFieldIndex, TextFieldIndex } from "./document-index";
import { type Hit, type Hits, QueryContext, andHits, applyBoost, geoFieldHits, ids, normalizedBoost, orHits, textFieldHits } from "./query-support";
import { type Query } from "./shared";

export enum OP {
  AND = "AND",
  OR = "OR"
}

export class BoolQuery implements Query {
  constructor(
    private readonly should: Query[] = [],
    private readonly must: Query[] = [],
    private readonly filter: Query[] = [],
    private readonly mustNot: Query[] = [],
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex, context: QueryContext = new QueryContext()): Hits {
    if (this.filter.length === 0 && this.should.length === 0 && this.must.length === 0 && this.mustNot.length === 0) {
      throw new Error("should specify at least one of filter, must, or should");
    }

    context.withFilterMode((filterContext) => {
      const excludedHits = this.mustNot.map((query) => query.hits(documentIndex, filterContext));
      context.exclude(excludedHits.length > 0 ? ids(excludedHits.reduce(orHits)) : []);

      const filtered = this.filter.map((query) => query.hits(documentIndex, filterContext));
      if (filtered.length > 0) {
        const reduced = filtered.reduce(andHits);
        context.include(ids(reduced));
      }
    });

    if (this.filter.length === 0 && this.should.length === 0 && this.must.length === 0 && this.mustNot.length > 0) {
      context.setIncludeIds([...documentIndex.ids()]);
      return applyBoost(context.hits(), normalizedBoost(this));
    }

    const mustHits = this.must.length === 0 && this.filter.length > 0
      ? context.hits()
      : (() => {
          const mappedMusts = this.must.map((query) => query.hits(documentIndex, context));
          if (mappedMusts.length > 0) {
            return this.filter.length > 0 ? [context.hits(), ...mappedMusts].reduce(andHits) : mappedMusts.reduce(andHits);
          }
          return [];
        })();

    if (this.must.length > 0) {
      context.setIncludeIds(ids(mustHits));
    }

    const mappedShoulds = this.should.map((query) => query.hits(documentIndex, context));
    const shouldHits = mappedShoulds.length > 0 ? mappedShoulds.reduce(orHits) : [];

    let result: Hits;
    if (this.must.length === 0 && this.should.length === 0) {
      result = mustHits;
    } else if (this.filter.length === 0 && this.should.length === 0) {
      result = mustHits;
    } else if (this.must.length === 0 && this.filter.length === 0) {
      result = shouldHits;
    } else if (this.filter.length === 0) {
      result = this.should.length === 0 ? mustHits : this.must.length === 0 ? shouldHits : andHits(mustHits, shouldHits);
    } else {
      result = shouldHits.length === 0 ? mustHits : andHits(mustHits, shouldHits);
    }

    return applyBoost(result, normalizedBoost(this));
  }

  highlightClauses(documentIndex: DocumentIndex) {
    return [
      ...this.should.flatMap((query) => query.highlightClauses?.(documentIndex) ?? []),
      ...this.must.flatMap((query) => query.highlightClauses?.(documentIndex) ?? [])
    ];
  }
}

export class TermQuery implements Query {
  constructor(
    private readonly field: string,
    private readonly text: string,
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const hits = textFieldHits(
      documentIndex,
      this.field,
      (fieldIndex) => (fieldIndex.termMatches(this.text) ?? []).map((match): Hit => [match.id, 1.0])
    );
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

export class RangeQuery implements Query {
  constructor(
    private readonly field: string,
    private readonly params: {
      lt?: string;
      lte?: string;
      gt?: string;
      gte?: string;
    } = {},
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const hits = textFieldHits(documentIndex, this.field, (fieldIndex) => fieldIndex.filterTermsByRange(this.params));
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

export class MatchQuery implements Query {
  constructor(
    private readonly field: string,
    private readonly text: string,
    private readonly operation: OP = OP.AND,
    private readonly prefixMatch = false,
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const hits = textFieldHits(
      documentIndex,
      this.field,
      (fieldIndex) => {
        const searchTerms = fieldIndex.queryAnalyzer.analyze(this.text);
        const collectedHits = new Map<string, number>();

        if (this.operation === OP.AND) {
          const termHits = searchTerms.map((term) => fieldIndex.searchTerm(term, this.prefixMatch)).sort((a, b) => a.length - b.length);
          if (termHits.length === 0 || termHits[0]!.length === 0) {
            return [];
          }
          for (const [id, score] of termHits[0]!) {
            collectedHits.set(id, score);
          }
          for (const nextHits of termHits.slice(1)) {
            const hitMap = new Map(nextHits);
            for (const [id, score] of [...collectedHits.entries()]) {
              const nextScore = hitMap.get(id);
              if (nextScore == null) {
                collectedHits.delete(id);
                continue;
              }
              collectedHits.set(id, score + nextScore);
            }
          }
        } else {
          const termHits = searchTerms.map((term) => fieldIndex.searchTerm(term, this.prefixMatch));
          for (const nextHits of termHits) {
            for (const [id, score] of nextHits) {
              collectedHits.set(id, score + (collectedHits.get(id) ?? 0));
            }
          }
        }

        return [...collectedHits.entries()].sort((a, b) => b[1] - a[1]);
      }
    );
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses() {
    return [{
      kind: "term" as const,
      field: this.field,
      text: this.text,
      operation: this.operation,
      prefixMatch: this.prefixMatch
    }];
  }
}

export class MatchPhrase implements Query {
  constructor(
    private readonly field: string,
    private readonly text: string,
    private readonly slop = 0,
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const hits = textFieldHits(documentIndex, this.field, (fieldIndex) => {
      const searchTerms = fieldIndex.queryAnalyzer.analyze(this.text);
      return fieldIndex.searchPhrase(searchTerms, this.slop);
    });
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses() {
    return [{
      kind: "phrase" as const,
      field: this.field,
      text: this.text,
      slop: this.slop
    }];
  }
}

export class PrefixQuery implements Query {
  constructor(
    private readonly field: string,
    private readonly prefix: string,
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const hits = textFieldHits(documentIndex, this.field, (fieldIndex) => fieldIndex.searchPrefix(this.prefix));
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses() {
    return [{
      kind: "term" as const,
      field: this.field,
      text: this.prefix,
      operation: OP.OR,
      prefixMatch: true
    }];
  }
}

export class MatchAll implements Query {
  constructor(public readonly boost: number | undefined = undefined) {}

  hits(documentIndex: DocumentIndex): Hits {
    return applyBoost([...documentIndex.ids()].map((id): Hit => [id, 1.0]), normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

export class GeoPointQuery implements Query {
  constructor(
    private readonly field: string,
    private readonly latitude: number,
    private readonly longitude: number,
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const hits = geoFieldHits(
      documentIndex,
      this.field,
      (fieldIndex) => fieldIndex.queryPoint(this.latitude, this.longitude).map((id): Hit => [id, 1.0])
    );
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}

export class GeoPolygonQuery implements Query {
  constructor(
    private readonly field: string,
    private readonly polygon: PolygonCoordinates,
    public readonly boost: number | undefined = undefined
  ) {}

  hits(documentIndex: DocumentIndex): Hits {
    const hits = geoFieldHits(
      documentIndex,
      this.field,
      (fieldIndex) => fieldIndex.queryPolygon(this.polygon).map((id): Hit => [id, 1.0])
    );
    return applyBoost(hits, normalizedBoost(this));
  }

  highlightClauses(): [] {
    return [];
  }
}
