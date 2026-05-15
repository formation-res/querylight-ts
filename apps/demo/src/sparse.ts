import type { SparseVector } from "@tryformation/querylight-ts";

export const SPARSE_MODEL_ID = "opensearch-project/opensearch-neural-sparse-encoding-doc-v3-distill";
export const SPARSE_DOCUMENT_TOP_TOKENS = 128;

export type SparseModelInfo = {
  modelId: string;
  queryEncoding: "tokenizer-token-weights";
  documentEncoding: "masked-lm-max-log1p-relu";
  documentTopTokens: number;
  vocabularySize: number;
};

export type SparseDocumentVectorRecord = {
  docId: string;
  vector: SparseVector;
};

export type SparsePayload = {
  model: SparseModelInfo;
  documents: SparseDocumentVectorRecord[];
};

export type SparseQueryWeights = {
  tokenWeights: number[];
};

type SparseDocSource = {
  title: string;
  summary: string;
  body: string;
};

type SparseQueryEncoder = {
  encode(text: string): Promise<SparseVector>;
};

let sparseQueryEncoderPromise: Promise<SparseQueryEncoder> | null = null;

export function createSparseDocumentText(doc: SparseDocSource): string {
  return [doc.title, doc.summary, doc.body].filter(Boolean).join("\n\n");
}

export function buildSparseQueryVector(tokenIds: number[], tokenWeights: number[]): SparseVector {
  const sparseVector: SparseVector = {};

  for (const tokenId of new Set(tokenIds)) {
    const weight = tokenWeights[tokenId] ?? 0;
    if (weight > 0) {
      sparseVector[String(tokenId)] = weight;
    }
  }

  return sparseVector;
}

export async function encodeSparseQuery(text: string, modelId: string, tokenWeights: number[]): Promise<SparseVector> {
  sparseQueryEncoderPromise ??= createSparseQueryEncoder(modelId, tokenWeights);
  try {
    const encoder = await sparseQueryEncoderPromise;
    return await encoder.encode(text);
  } catch (error) {
    sparseQueryEncoderPromise = null;
    throw error;
  }
}

async function createSparseQueryEncoder(modelId: string, tokenWeights: number[]): Promise<SparseQueryEncoder> {
  const { AutoTokenizer } = await import("@huggingface/transformers");
  const tokenizer = await AutoTokenizer.from_pretrained(modelId);

  return {
    async encode(text: string): Promise<SparseVector> {
      const features = await tokenizer([text], {
        truncation: true,
        return_attention_mask: false,
        return_token_type_ids: false
      });
      return buildSparseQueryVector(normalizeTokenIds(features.input_ids), tokenWeights);
    }
  };
}

function normalizeTokenIds(value: unknown): number[] {
  if (value && typeof value === "object" && "data" in value) {
    const data = (value as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data.map((item) => Number(item)).filter(Number.isFinite);
    }
    if (ArrayBuffer.isView(data)) {
      return Array.from(data as ArrayLike<number>, (item) => Number(item)).filter(Number.isFinite);
    }
  }
  if (!Array.isArray(value)) {
    return [];
  }
  if (value.length === 0) {
    return [];
  }
  if (Array.isArray(value[0])) {
    return (value[0] as unknown[]).map((item) => Number(item)).filter(Number.isFinite);
  }
  return value.map((item) => Number(item)).filter(Number.isFinite);
}
