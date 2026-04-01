import type { GuildMember } from "discord.js";
import type { CommandName } from "../types/moderation";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ModerationExecutor {
  public async execute(params: {
    commandName: CommandName;
    speaker: GuildMember;
    target: GuildMember;
  }): Promise<void> {
    const speakerChannel = params.speaker.voice.channel;
    if (params.commandName === "drag" && !speakerChannel) {
      throw new Error("Speaker is no longer connected to a voice channel");
    }

    await this.executeWithRetry(async () => {
      const reason = `NOVA voice command by ${params.speaker.user.tag} (${params.speaker.id})`;

      switch (params.commandName) {
        case "drag":
          await params.target.voice.setChannel(speakerChannel, reason);
          return;
        case "mute":
          await params.target.voice.setMute(true, reason);
          return;
        case "unmute":
          await params.target.voice.setMute(false, reason);
          return;
        case "disconnect":
          await params.target.voice.setChannel(null, reason);
          return;
      }
    });
  }

  private async executeWithRetry(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      await sleep(250);
      await operation();
    }
  }
}
