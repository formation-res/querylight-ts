import {
  Analyzer,
  DocumentIndex,
  KeywordTokenizer,
  RankingAlgorithm,
  TextFieldIndex,
  type Document
} from "../src/index";

export interface SampleObject {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

export function sampleObject(
  title: string,
  description: string,
  tags: string[] = [],
  id = `${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}${title}`
): SampleObject {
  return { id, title, description, tags };
}

export function toDoc(sample: SampleObject): Document {
  return {
    id: sample.id,
    fields: {
      title: [sample.title],
      description: [sample.description],
      tags: sample.tags
    }
  };
}

export function testIndex(algorithm: RankingAlgorithm = RankingAlgorithm.TFIDF): DocumentIndex {
  const documentIndex = new DocumentIndex({
    title: new TextFieldIndex(undefined, undefined, algorithm),
    description: new TextFieldIndex(undefined, undefined, algorithm),
    tags: new TextFieldIndex(undefined, undefined, algorithm)
  });

  [
    sampleObject(
      "Lorem ipsum",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      [],
      "lorem"
    ),
    sampleObject(
      "Hamlet",
      'A famous play by Shakespeare that contains a nice edge case for search engines "To Be, Or Not To Be" consisting of stop words.',
      [],
      "hamlet"
    ),
    sampleObject(
      "querylight",
      "querylight is an alternative to both solr and elasticsearch that does not use lucene.",
      [],
      "querylight"
    ),
    sampleObject(
      "Apache Solr & Lucene",
      "An alternative to Elasticsearch that lives in the same OSS project as Apache Lucene, which is used by both but not by querylight.",
      [],
      "solr"
    ),
    sampleObject(
      "Elasticsearch, you know for search",
      "Elasticsearch is something you should consider using instead of querylight. Unless you need offline search of course.",
      [],
      "es"
    )
  ].map(toDoc).forEach((doc) => documentIndex.index(doc));

  return documentIndex;
}

export function quotesIndex(algorithm: RankingAlgorithm = RankingAlgorithm.TFIDF): DocumentIndex {
  const documentIndex = new DocumentIndex({
    title: new TextFieldIndex(undefined, undefined, algorithm),
    description: new TextFieldIndex(undefined, undefined, algorithm),
    tags: new TextFieldIndex(new Analyzer([], new KeywordTokenizer()))
  });

  [
    sampleObject("George Orwell, 1984", "War is peace. Freedom is slavery. Ignorance is strength.", ["book"]),
    sampleObject(
      "Jane Austen, Pride and Prejudice",
      "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
      ["book"]
    ),
    sampleObject("F. Scott Fitzgerald, The Great Gatsby", "So we beat on, boats against the current, borne back ceaselessly into the past.", ["book"]),
    sampleObject("William Shakespeare, Hamlet", "To be, or not to be: that is the question.", ["book"]),
    sampleObject(
      "Douglas Adams, The Hitchhiker's Guide to the Galaxy",
      "The ships hung in the sky in much the same way that bricks don't.",
      ["book", "science fiction", "funny"]
    ),
    sampleObject("Douglas Adams, The Hitchhiker's Guide to the Galaxy", "Don't Panic.", ["book"]),
    sampleObject("Douglas Adams, The Restaurant at the End of the Universe", "Time is an illusion. Lunchtime doubly so.", ["book", "science fiction", "funny"]),
    sampleObject(
      "Douglas Adams, Last Chance to See",
      "Human beings, who are almost unique in having the ability to learn from the experience of others, are also remarkable for their apparent disinclination to do so.",
      ["book", "science fiction", "funny"]
    ),
    sampleObject("Terry Gilliam and Terry Jones, Monty Python and the Holy Grail", "Tis but a scratch.", ["movie", "funny"]),
    sampleObject("Terry Gilliam and Terry Jones, Monty Python and the Holy Grail", "Nobody expects the Spanish Inquisition!", ["movie", "funny"]),
    sampleObject(
      "Terry Gilliam and Terry Jones, Monty Python and the Holy Grail",
      "Your mother was a hamster and your father smelt of elderberries.",
      ["movie", "funny"]
    ),
    sampleObject("Terry Gilliam and Terry Jones, Monty Python's Life of Brian", "He's not the Messiah, he's a very naughty boy!", ["movie", "funny"]),
    sampleObject(
      "Philip K. Dick, Do Androids Dream of Electric Sheep?",
      "You will be required to do wrong no matter where you go. It is the basic condition of life, to be required to violate your own identity.",
      ["book", "science fiction"]
    ),
    sampleObject(
      "Orson Scott Card, Ender's Game",
      "In the moment when I truly understand my enemy, understand him well enough to defeat him, then in that very moment, I also love him.",
      ["book", "science fiction"]
    )
  ].map(toDoc).forEach((doc) => documentIndex.index(doc));

  return documentIndex;
}
