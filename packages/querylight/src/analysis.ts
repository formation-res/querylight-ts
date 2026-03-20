export interface TextFilter {
  filter(text: string): string;
}

export interface AnalyzedToken {
  term: string;
  startOffset: number;
  endOffset: number;
  position: number;
}

export class LowerCaseTextFilter implements TextFilter {
  filter(text: string): string {
    return text.toLowerCase();
  }
}

export interface Tokenizer {
  tokenize(text: string): string[];
}

export class KeywordTokenizer implements Tokenizer {
  tokenize(text: string): string[] {
    return [text];
  }
}

export class SplittingTokenizer implements Tokenizer {
  private readonly re = /\s+/m;

  tokenize(text: string): string[] {
    return text.split(this.re).filter((token) => token.trim().length > 0);
  }
}

export interface TokenFilter {
  filter(tokens: string[]): string[];
}

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

export class ElisionTextFilter implements TextFilter {
  private readonly elisionRe = /['’]/g;

  filter(text: string): string {
    return text.replace(this.elisionRe, "");
  }
}

export class InterpunctionTextFilter implements TextFilter {
  private readonly interpunctionRe = /[\\\]\['"!,.@#$%^&*()_+\-={}|><`~±§?;:/]/g;

  filter(text: string): string {
    return text.replace(this.interpunctionRe, " ").trim();
  }
}

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
