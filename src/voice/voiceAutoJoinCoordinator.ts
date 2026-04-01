import type { BaseGuildVoiceChannel, Client, Guild, GuildMember } from "discord.js";
import type { Logger } from "pino";
import type { CachedGuildConfigService } from "../config/cachedGuildConfigService";
import { isSpeakerAllowed } from "../validator/speakerAuthorization";
import { VoiceSessionManager } from "./voiceSessionManager";

export class VoiceAutoJoinCoordinator {
  public constructor(
    private readonly client: Client,
    private readonly logger: Logger,
    private readonly configService: CachedGuildConfigService,
    private readonly voiceSessionManager: VoiceSessionManager,
  ) {}

  public start(): void {
    this.client.on("voiceStateUpdate", (oldState, newState) => {
      if (newState.member?.user.bot) {
        return;
      }

      void this.reconcileGuild(newState.guild, newState.member ?? oldState.member ?? null);
    });
  }

  private async reconcileGuild(guild: Guild, priorityMember: GuildMember | null): Promise<void> {
    const config = await this.configService.getGuildRuntimeConfig(guild.id);
    if (config.listenMode !== "AUTO") {
      return;
    }

    const currentChannelId = this.voiceSessionManager.getCurrentChannelId(guild.id);
    const currentChannel = currentChannelId
      ? this.getVoiceChannelById(guild, currentChannelId)
      : null;

    const preferredChannel =
      (priorityMember && this.getAllowedSpeakerChannel(priorityMember, config)) ||
      (currentChannel && this.channelHasAllowedSpeaker(currentChannel, config) ? currentChannel : null) ||
      this.findAnyEligibleChannel(guild, config);

    if (!preferredChannel) {
      if (currentChannelId) {
        this.logger.info({ guildId: guild.id }, "Disconnecting from voice; no eligible speakers remain");
        this.voiceSessionManager.disconnect(guild.id);
      }
      return;
    }

    if (preferredChannel.id === currentChannelId) {
      return;
    }

    await this.voiceSessionManager.connect(guild, preferredChannel);
  }

  private getAllowedSpeakerChannel(
    member: GuildMember,
    config: Awaited<ReturnType<CachedGuildConfigService["getGuildRuntimeConfig"]>>,
  ): BaseGuildVoiceChannel | null {
    if (!member.voice.channel || !isSpeakerAllowed(member, config)) {
      return null;
    }

    return member.voice.channel;
  }

  private findAnyEligibleChannel(
    guild: Guild,
    config: Awaited<ReturnType<CachedGuildConfigService["getGuildRuntimeConfig"]>>,
  ): BaseGuildVoiceChannel | null {
    const prioritizedChannelIds = new Set<string>();

    for (const voiceState of guild.voiceStates.cache.values()) {
      const member = voiceState.member;
      if (!member || !voiceState.channel || member.user.bot) {
        continue;
      }

      if (!isSpeakerAllowed(member, config)) {
        continue;
      }

      if (prioritizedChannelIds.has(voiceState.channelId!)) {
        continue;
      }

      prioritizedChannelIds.add(voiceState.channelId!);
      return voiceState.channel;
    }

    return null;
  }

  private channelHasAllowedSpeaker(
    channel: BaseGuildVoiceChannel,
    config: Awaited<ReturnType<CachedGuildConfigService["getGuildRuntimeConfig"]>>,
  ): boolean {
    return channel.members.some((member) => !member.user.bot && isSpeakerAllowed(member, config));
  }

  private getVoiceChannelById(guild: Guild, channelId: string): BaseGuildVoiceChannel | null {
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isVoiceBased()) {
      return null;
    }

    return channel as BaseGuildVoiceChannel;
  }
}
