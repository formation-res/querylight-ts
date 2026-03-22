/** Text preprocessor applied before tokenization. */
export interface TextFilter {
  filter(text: string): string;
}

/** Token with original source offsets for highlighting and phrase work. */
export interface AnalyzedToken {
  term: string;
  startOffset: number;
  endOffset: number;
  position: number;
}

/** Lowercases input text before tokenization. */
export class LowerCaseTextFilter implements TextFilter {
  filter(text: string): string {
    return text.toLowerCase();
  }
}

/** Tokenizer that turns raw text into token strings. */
export interface Tokenizer {
  tokenize(text: string): string[];
}

/** Tokenizer that keeps the full input as a single token. */
export class KeywordTokenizer implements Tokenizer {
  tokenize(text: string): string[] {
    return [text];
  }
}

/** Whitespace tokenizer for ordinary text analysis. */
export class SplittingTokenizer implements Tokenizer {
  private readonly re = /\s+/m;

  tokenize(text: string): string[] {
    return text.split(this.re).filter((token) => token.trim().length > 0);
  }
}

/** Token postprocessor applied after tokenization. */
export interface TokenFilter {
  filter(tokens: string[]): string[];
}

/** Produces character n-grams from token streams. */
export class NgramTokenFilter implements TokenFilter {
  constructor(public readonly ngramSize: number) {}

  filter(tokens: string[]): string[] {
    const joined = tokens.join("");
    if (joined.trim().length === 0) {
      return [];
    }
    if (joined.length < this.ngramSize) {
      return [joined];
    }
    return [...new Set(Array.from({ length: joined.length - this.ngramSize + 1 }, (_, i) => joined.slice(i, i + this.ngramSize)))];
  }
}

/** Produces edge n-grams from the start and end of each token. */
export class EdgeNgramsTokenFilter implements TokenFilter {
  constructor(
    public readonly minLength: number,
    public readonly maxLength: number
  ) {}

  filter(tokens: string[]): string[] {
    const results: string[] = [];
    for (const token of tokens) {
      if (token.length <= this.minLength) {
        results.push(token);
        continue;
      }
      const maxLength = Math.min(this.maxLength, token.length);
      for (let length = this.minLength; length <= maxLength; length += 1) {
        results.push(token.slice(0, length));
        results.push(token.slice(token.length - length));
      }
    }
    return [...new Set(results)];
  }
}

/** Removes apostrophes and elision markers. */
export class ElisionTextFilter implements TextFilter {
  private readonly elisionRe = /['’]/g;

  filter(text: string): string {
    return text.replace(this.elisionRe, "");
  }
}

/** Replaces punctuation with spaces before tokenization. */
export class InterpunctionTextFilter implements TextFilter {
  private readonly interpunctionRe = /[\\\]\['"!,.@#$%^&*()_+\-={}|><`~±§?;:/]/g;

  filter(text: string): string {
    return text.replace(this.interpunctionRe, " ").trim();
  }
}

/** Configurable analyzer pipeline used by text indexes and query parsing. */
export class Analyzer {
  constructor(
    public readonly textFilters: TextFilter[] = [
      new LowerCaseTextFilter(),
      new ElisionTextFilter(),
      new InterpunctionTextFilter()
    ],
    public readonly tokenizer: Tokenizer = new SplittingTokenizer(),
    public readonly tokenFilters: TokenFilter[] = []
  ) {}

  analyze(text: string): string[] {
    let filtered = text;
    for (const filter of this.textFilters) {
      filtered = filter.filter(filtered);
    }
    let tokens = this.tokenizer.tokenize(filtered);
    for (const filter of this.tokenFilters) {
      tokens = filter.filter(tokens);
    }
    return tokens;
  }

  analyzeWithOffsets(text: string): AnalyzedToken[] {
    const rawTokens = this.tokenizer.tokenize(text);
    const analyzedTokens: AnalyzedToken[] = [];
    let searchStart = 0;

    for (const rawToken of rawTokens) {
      const startOffset = text.indexOf(rawToken, searchStart);
      if (startOffset < 0) {
        continue;
      }
      const endOffset = startOffset + rawToken.length;
      searchStart = endOffset;

      let term = rawToken;
      for (const filter of this.textFilters) {
        term = filter.filter(term);
      }
      if (term.trim().length === 0) {
        continue;
      }

      analyzedTokens.push({
        term,
        startOffset,
        endOffset,
        position: analyzedTokens.length
      });
    }

    return analyzedTokens;
  }
}
