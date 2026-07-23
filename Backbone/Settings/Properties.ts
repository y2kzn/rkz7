import { ITournament } from "../../Models/Tournament";
import { Emotes, EmoteGroupDefinitions, SpecialEmotesNames } from "../Config";
import { PropertyData } from "../Logic/TournamentData";
import { GetRoundConfig, GetRoundConfigs } from "./Rules";

export function GetProperties(DatabaseTournament: ITournament) {
  let DisabledEmotes: number[] =
    DatabaseTournament.Properties?.DisabledEmotes || [];

  if (DisabledEmotes.length === 0) {
    return buildProperties(DatabaseTournament, []);
  }

  if (DisabledEmotes.includes(0)) {
    return buildProperties(DatabaseTournament, []);
  }

  const LegacyPresets: { [key: number]: string[] } = {
    [-2]: ["Punch"],
    [-3]: ["Punch", "Kick"],
    [-4]: ["Banana"],
    [-5]: ["Hug"],
    [-6]: ["Kick"],
    [-7]: ["Punch", "Banana"],
    [-8]: ["Punch", "Hug"],
    [-9]: ["Kick", "Banana"],
    [-10]: ["Kick", "Hug"],
    [-11]: ["Banana", "Hug"],
    [-12]: ["Punch", "Kick", "Banana"],
    [-13]: ["Punch", "Kick", "Hug"],
    [-14]: ["Punch", "Banana", "Hug"],
    [-15]: ["Kick", "Banana", "Hug"],
    [-16]: ["Punch", "Kick", "Banana", "Hug"],
  };

  for (const [idStr, groups] of Object.entries(LegacyPresets)) {
    const id = parseInt(idStr);
    if (DisabledEmotes.includes(id)) {
      DisabledEmotes = DisabledEmotes.filter((e) => e !== id);
      let mask = 0;
      for (const group of groups) {
        const def = EmoteGroupDefinitions[group];
        if (def) {
          mask |= def.mask;
        }
      }
      DisabledEmotes.push(-1000 - mask);
    }
  }

  if (DisabledEmotes.includes(-1)) {
    DisabledEmotes = DisabledEmotes.filter((e) => e !== -1);
    DisabledEmotes.push(-1000);
  }

  const maskId = DisabledEmotes.find((id) => id <= -1000);
  if (maskId !== undefined) {
    const mask = -(maskId + 1000);
    DisabledEmotes = DisabledEmotes.filter((id) => id > -1000);

    const allowedEmoteNames: string[] = [];
    const groupEntries = Object.entries(EmoteGroupDefinitions);
    for (const [groupName, def] of groupEntries) {
      if ((mask & def.mask) !== 0) {
        allowedEmoteNames.push(...def.emotes);
      }
    }

    for (const EmoteName of SpecialEmotesNames) {
      if (!allowedEmoteNames.includes(EmoteName)) {
        const EmoteId = Emotes[EmoteName];
        if (EmoteId != null && !DisabledEmotes.includes(EmoteId)) {
          DisabledEmotes.push(EmoteId);
        }
      }
    }
  }

  return buildProperties(DatabaseTournament, DisabledEmotes);
}

function buildProperties(
  DatabaseTournament: ITournament,
  DisabledEmotes: number[]
) {
  const OverrideQualified = Math.floor(
    DatabaseTournament.MaxPlayersPerMatch / 2
  );
  const Properties: PropertyData[] = [
    { "@name": "max_wait_time", "@value": "30" },
    { "@name": "game_round_count", "@value": "1" },
    {
      "@name": "override_max_qualified",
      "@value": OverrideQualified.toString(),
    },
  ];

  const phases = DatabaseTournament.Phases;
  for (let PhaseIndex = 0; PhaseIndex < phases.length; PhaseIndex++) {
    const PhaseConfig = phases[PhaseIndex];
    const MapsForPhase = PhaseConfig.Maps;

    if (MapsForPhase && MapsForPhase.length > 0) {
      const RoundCount =
        PhaseConfig.RoundCount || DatabaseTournament.RoundCount;

      if (MapsForPhase.length === 1) {
        Properties.push({
          "@name": `phase${PhaseIndex + 1}_override_level`,
          "@value": MapsForPhase[0],
        });
      } else {
        for (let RoundIndex = 0; RoundIndex < RoundCount; RoundIndex++) {
          const MapName = MapsForPhase[RoundIndex % MapsForPhase.length];
          const propName =
            RoundIndex === 0
              ? `phase${PhaseIndex + 1}_override_level`
              : `phase${PhaseIndex + 1}_round${RoundIndex + 1}_override_level`;

          Properties.push({
            "@name": propName,
            "@value": MapName,
          });
        }
      }
    }
  }

  if (DisabledEmotes.length > 0) {
    Properties.push({
      "@name": "disable_emotes",
      "@value": DisabledEmotes.join(","),
    });
  }

  return [
    {
      properties: [
        {
          property: Properties,
        },
      ],
    },
  ];
}

export async function GetNextPhaseStarted(
  Tournament: ITournament,
  Phase?: number
): Promise<number> {
  if (!Tournament || Tournament.RoundCount <= 0) return 0;

  const CurrentPhase = Phase || Tournament.CurrentPhaseId || 1;
  const PhaseConfig = Tournament.Phases[CurrentPhase - 1];
  if (!PhaseConfig) return 0;

  const RoundCount = PhaseConfig.RoundCount || Tournament.RoundCount;
  let totalMinutes = 0;

  for (let i = 1; i <= RoundCount; i++) {
    const Config = GetRoundConfig(Tournament, CurrentPhase, i);
    totalMinutes += Config.MaxLength;
  }

  return (totalMinutes + 5) * 60000;
}
