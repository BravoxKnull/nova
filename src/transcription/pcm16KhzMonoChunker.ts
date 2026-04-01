const DISCORD_SAMPLE_RATE = 48_000;
const TARGET_SAMPLE_RATE = 16_000;
const INPUT_FRAME_BYTES = 4;
const INPUT_GROUP_BYTES = (DISCORD_SAMPLE_RATE / TARGET_SAMPLE_RATE) * INPUT_FRAME_BYTES;

function clampInt16(value: number): number {
  if (value > 32_767) {
    return 32_767;
  }

  if (value < -32_768) {
    return -32_768;
  }

  return value;
}

export class Pcm16KhzMonoChunker {
  private sourceRemainder = Buffer.alloc(0);
  private monoRemainder = Buffer.alloc(0);
  private readonly chunkBytes: number;
  private readonly minFlushBytes: number;

  public constructor(
    chunkDurationMs = 1_500,
    minFlushDurationMs = 700,
  ) {
    this.chunkBytes = Math.floor((TARGET_SAMPLE_RATE * 2 * chunkDurationMs) / 1_000);
    this.minFlushBytes = Math.floor((TARGET_SAMPLE_RATE * 2 * minFlushDurationMs) / 1_000);
  }

  public push(input: Buffer): Buffer[] {
    const combined = this.sourceRemainder.length > 0 ? Buffer.concat([this.sourceRemainder, input]) : input;
    const consumableBytes = combined.length - (combined.length % INPUT_GROUP_BYTES);
    this.sourceRemainder =
      consumableBytes === combined.length
        ? Buffer.alloc(0)
        : Buffer.from(combined.subarray(consumableBytes));

    const downsampled = this.downsample(combined.subarray(0, consumableBytes));
    const output = this.monoRemainder.length > 0 ? Buffer.concat([this.monoRemainder, downsampled]) : downsampled;
    const chunks: Buffer[] = [];

    let offset = 0;
    while (offset + this.chunkBytes <= output.length) {
      chunks.push(Buffer.from(output.subarray(offset, offset + this.chunkBytes)));
      offset += this.chunkBytes;
    }

    this.monoRemainder =
      offset === output.length ? Buffer.alloc(0) : Buffer.from(output.subarray(offset));
    return chunks;
  }

  public flush(): Buffer | null {
    const buffered = this.monoRemainder;
    this.sourceRemainder = Buffer.alloc(0);
    this.monoRemainder = Buffer.alloc(0);

    if (buffered.length < this.minFlushBytes) {
      return null;
    }

    return buffered;
  }

  private downsample(input: Buffer): Buffer {
    if (input.length === 0) {
      return Buffer.alloc(0);
    }

    const output = Buffer.allocUnsafe(input.length / 6);
    let outputOffset = 0;

    for (let offset = 0; offset < input.length; offset += INPUT_GROUP_BYTES) {
      let monoAccumulator = 0;

      for (let frame = 0; frame < INPUT_GROUP_BYTES; frame += INPUT_FRAME_BYTES) {
        const sampleOffset = offset + frame;
        const left = input.readInt16LE(sampleOffset);
        const right = input.readInt16LE(sampleOffset + 2);
        monoAccumulator += Math.round((left + right) / 2);
      }

      output.writeInt16LE(clampInt16(Math.round(monoAccumulator / 3)), outputOffset);
      outputOffset += 2;
    }

    return output;
  }
}
