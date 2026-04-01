import Groq, { toFile } from "groq-sdk";
import type { Logger } from "pino";
import { COMMAND_NAMES, type GuildRuntimeConfig } from "../types/moderation";
import { encodePcm16MonoWav } from "./wavEncoder";

export class GroqTranscriptionService {
  private readonly client: Groq;

  public constructor(
    apiKey: string,
    private readonly logger: Logger,
  ) {
    this.client = new Groq({ apiKey });
  }

  public async transcribeChunk(params: {
    pcm16Mono: Buffer;
    guildConfig: GuildRuntimeConfig;
  }): Promise<string> {
    const keywords = new Set<string>([...COMMAND_NAMES, ...params.guildConfig.aliases.keys()]);
    const prompt = `Voice moderation command keywords: ${Array.from(keywords).join(", ")}. Transcribe exactly.`;
    const audioFile = await toFile(encodePcm16MonoWav(params.pcm16Mono), "nova-command.wav", {
      type: "audio/wav",
    });

    const response = await this.client.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3",
      language: "en",
      response_format: "json",
      temperature: 0,
      prompt,
    });

    const text = response.text.trim();
    this.logger.debug({ rawTranscription: text }, "Received Groq transcription");
    return text;
  }
}
