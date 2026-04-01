import { normalizeText, tokenizeNormalizedText } from "../normalization/normalizeText";
import {
  COMMAND_NAMES,
  type CommandCandidate,
  type CommandName,
  type GuildRuntimeConfig,
  type ParsedCommand,
} from "../types/moderation";
import { damerauLevenshteinDistance } from "./damerauLevenshtein";

const MAX_COMMAND_DISTANCE = 1;

export class DeterministicCommandParser {
  public buildCatalog(config: GuildRuntimeConfig): CommandCandidate[] {
    const catalog = new Map<string, CommandCandidate>();

    for (const commandName of COMMAND_NAMES) {
      catalog.set(commandName, {
        keyword: commandName,
        commandName,
        source: "canonical",
      });
    }

    for (const [alias, commandName] of config.aliases.entries()) {
      const normalizedAlias = normalizeText(alias);
      if (!normalizedAlias || normalizedAlias.includes(" ")) {
        continue;
      }

      catalog.set(normalizedAlias, {
        keyword: normalizedAlias,
        commandName,
        source: "alias",
      });
    }

    return Array.from(catalog.values());
  }

  public parse(normalizedText: string, catalog: readonly CommandCandidate[]): ParsedCommand | null {
    const tokens = tokenizeNormalizedText(normalizedText);
    if (tokens.length < 2) {
      return null;
    }

    const commandToken = tokens[0]!;
    const targetPhrase = tokens.slice(1).join(" ").trim();
    if (!targetPhrase) {
      return null;
    }

    const resolvedCandidate = this.resolveCommandCandidate(commandToken, catalog);
    if (!resolvedCandidate) {
      return null;
    }

    return {
      commandName: resolvedCandidate.commandName,
      matchedKeyword: resolvedCandidate.keyword,
      targetPhrase,
    };
  }

  private resolveCommandCandidate(
    token: string,
    catalog: readonly CommandCandidate[],
  ): CommandCandidate | null {
    const exactMatch = catalog.find((candidate) => candidate.keyword === token);
    if (exactMatch) {
      return exactMatch;
    }

    const firstLetter = token[0];
    if (!firstLetter) {
      return null;
    }

    const fuzzyCandidates = catalog
      .filter((candidate) => {
        const candidateFirstLetter = candidate.keyword[0];
        return (
          candidateFirstLetter === firstLetter &&
          Math.abs(candidate.keyword.length - token.length) <= MAX_COMMAND_DISTANCE
        );
      })
      .map((candidate) => ({
        candidate,
        distance: damerauLevenshteinDistance(token, candidate.keyword),
      }))
      .filter((entry) => entry.distance <= MAX_COMMAND_DISTANCE)
      .sort((left, right) => left.distance - right.distance);

    const bestMatch = fuzzyCandidates[0];
    if (!bestMatch) {
      return null;
    }

    const secondMatch = fuzzyCandidates[1];
    if (secondMatch && secondMatch.distance === bestMatch.distance) {
      return null;
    }

    return bestMatch.candidate;
  }
}
