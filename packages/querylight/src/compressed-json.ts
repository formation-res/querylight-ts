import { gzip, ungzip } from "pako";

/** Params for {@link serializeCompressedJson}. */
export interface SerializeCompressedJsonParams<T> {
  value: T;
}

/** Params for {@link deserializeCompressedJson}. */
export interface DeserializeCompressedJsonParams {
  compressed: Uint8Array | ArrayBuffer | ArrayLike<number>;
}

function normalizeCompressedBytes(compressed: Uint8Array | ArrayBuffer | ArrayLike<number>): Uint8Array {
  if (compressed instanceof Uint8Array) {
    return compressed;
  }
  if (compressed instanceof ArrayBuffer) {
    return new Uint8Array(compressed);
  }
  return Uint8Array.from(compressed);
}

/** Serializes any JSON-compatible value to gzipped UTF-8 bytes. */
export function serializeCompressedJson<T>({ value }: SerializeCompressedJsonParams<T>): Uint8Array {
  return gzip(new TextEncoder().encode(JSON.stringify(value)));
}

/** Restores a JSON value from gzipped UTF-8 bytes. */
export function deserializeCompressedJson<T>({ compressed }: DeserializeCompressedJsonParams): T {
  return JSON.parse(new TextDecoder().decode(ungzip(normalizeCompressedBytes(compressed)))) as T;
}
