import {
  CpuVectorScorer,
  type AsyncVectorScorer,
  type Hits,
  type PreparedVector,
  type VectorScorer
} from "@tryformation/querylight-ts";

type SemanticVectorBackend = "webgpu" | "cpu";

const GPU_BUFFER_USAGE = {
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
} as const;

const GPU_MAP_MODE = {
  READ: 0x0001
} as const;

const COMPUTE_SHADER = `
struct Params {
  dimensions: u32,
  count: u32,
  padding0: u32,
  padding1: u32,
}

@group(0) @binding(0) var<storage, read> query: array<f32>;
@group(0) @binding(1) var<storage, read> candidates: array<f32>;
@group(0) @binding(2) var<storage, read_write> scores: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let candidateIndex = gid.x;
  if (candidateIndex >= params.count) {
    return;
  }

  var score = 0.0;
  let base = candidateIndex * params.dimensions;
  for (var i = 0u; i < params.dimensions; i = i + 1u) {
    score = score + query[i] * candidates[base + i];
  }
  scores[candidateIndex] = score;
}
`;

type GpuLike = {
  requestAdapter(): Promise<{
    requestDevice(): Promise<any>;
  } | null>;
};

export async function createSemanticVectorScorer(): Promise<{ scorer: VectorScorer; backend: SemanticVectorBackend }> {
  const cpu = new CpuVectorScorer();
  const gpu = (navigator as Navigator & { gpu?: GpuLike }).gpu;

  if (!gpu) {
    return { scorer: cpu, backend: "cpu" };
  }

  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return { scorer: cpu, backend: "cpu" };
    }

    const device = await adapter.requestDevice();
    return { scorer: new WebGpuVectorScorer(device, cpu), backend: "webgpu" };
  } catch {
    return { scorer: cpu, backend: "cpu" };
  }
}

class WebGpuVectorScorer implements VectorScorer, AsyncVectorScorer {
  private readonly pipeline: any;
  private gpuAvailable = true;

  constructor(
    private readonly device: any,
    private readonly cpuFallback: CpuVectorScorer
  ) {
    this.pipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: {
        module: this.device.createShaderModule({ code: COMPUTE_SHADER }),
        entryPoint: "main"
      }
    });

    void this.device.lost.then(() => {
      this.gpuAvailable = false;
    });
  }

  prepare(vector: ArrayLike<number>, dimensions: number): PreparedVector {
    return this.cpuFallback.prepare(vector, dimensions);
  }

  bestScore(query: PreparedVector, candidates: ReadonlyArray<PreparedVector>): number {
    return this.cpuFallback.bestScore(query, candidates);
  }

  async rankCandidatesAsync(query: PreparedVector, candidatesById: ReadonlyMap<string, ReadonlyArray<PreparedVector>>, k: number): Promise<Hits> {
    if (!this.gpuAvailable || k <= 0 || candidatesById.size === 0) {
      return rankOnCpu(this.cpuFallback, query, candidatesById, k);
    }

    const flattened = flattenCandidates(candidatesById, query.length);
    if (flattened.ids.length === 0) {
      return [];
    }

    try {
      const scores = await this.scoreOnGpu(query, flattened.vectors, flattened.ids.length);
      const bestById = new Map<string, number>();
      for (let i = 0; i < flattened.ids.length; i += 1) {
        const id = flattened.ids[i]!;
        const score = scores[i] ?? Number.NEGATIVE_INFINITY;
        const current = bestById.get(id);
        if (current == null || score > current) {
          bestById.set(id, score);
        }
      }
      return selectTopHits(bestById, k);
    } catch {
      this.gpuAvailable = false;
      return rankOnCpu(this.cpuFallback, query, candidatesById, k);
    }
  }

  private async scoreOnGpu(query: PreparedVector, candidates: Float32Array, candidateCount: number): Promise<Float32Array> {
    const queryBuffer = this.createBuffer(query, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST);
    const candidateBuffer = this.createBuffer(candidates, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST);
    const scoreBufferSize = candidateCount * Float32Array.BYTES_PER_ELEMENT;
    const scoreBuffer = this.device.createBuffer({
      size: scoreBufferSize,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
    });
    const readBuffer = this.device.createBuffer({
      size: scoreBufferSize,
      usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ
    });
    const params = new Uint32Array([query.length, candidateCount, 0, 0]);
    const paramsBuffer = this.createBuffer(params, GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: queryBuffer } },
        { binding: 1, resource: { buffer: candidateBuffer } },
        { binding: 2, resource: { buffer: scoreBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(candidateCount / 64));
    pass.end();
    commandEncoder.copyBufferToBuffer(scoreBuffer, 0, readBuffer, 0, scoreBufferSize);
    this.device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPU_MAP_MODE.READ);
    const range = readBuffer.getMappedRange();
    const copy = new Float32Array(range.slice(0));
    readBuffer.unmap();

    queryBuffer.destroy();
    candidateBuffer.destroy();
    scoreBuffer.destroy();
    readBuffer.destroy();
    paramsBuffer.destroy();

    return copy;
  }

  private createBuffer(data: ArrayBufferView, usage: number): any {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage
    });
    this.device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
    return buffer;
  }
}

function flattenCandidates(candidatesById: ReadonlyMap<string, ReadonlyArray<PreparedVector>>, dimensions: number): { ids: string[]; vectors: Float32Array } {
  const ids: string[] = [];
  let total = 0;
  for (const candidates of candidatesById.values()) {
    total += candidates.length;
  }

  const vectors = new Float32Array(total * dimensions);
  let offset = 0;
  for (const [id, candidates] of candidatesById.entries()) {
    for (const candidate of candidates) {
      vectors.set(candidate, offset * dimensions);
      ids.push(id);
      offset += 1;
    }
  }

  return { ids, vectors };
}

function rankOnCpu(
  scorer: CpuVectorScorer,
  query: PreparedVector,
  candidatesById: ReadonlyMap<string, ReadonlyArray<PreparedVector>>,
  k: number
): Hits {
  const scores = new Map<string, number>();
  for (const [id, candidates] of candidatesById.entries()) {
    scores.set(id, scorer.bestScore(query, candidates));
  }
  return selectTopHits(scores, k);
}

function selectTopHits(scores: Map<string, number>, k: number): Hits {
  return [...scores.entries()]
    .map(([id, score]) => [id, score] as const)
    .sort((left, right) => right[1] - left[1])
    .slice(0, k)
    .map(([id, score]) => [id, score]);
}
