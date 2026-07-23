import { ITournament, Prize } from "../../Models/Tournament";
import { RoundData, PhaseData } from "../Logic/TournamentData";
import { TournamentPhaseType } from "../Config";

export interface RoundConfig {
  MinGameLength: number;
  MaxLength: number;
  MaxGameCount: number;
}

export function GetPrizesSettings(DatabaseTournament: ITournament) {
  const prizes = DatabaseTournament.Prizes;
  const prizepoolId = String(DatabaseTournament.PrizepoolId);

  return {
    reward: prizes.map((p) => ({
      "@position": String(p.position),
      item: [
        {
          "@amount": String(p.amount),
          "@external-id": "4",
          "@id": prizepoolId,
          "@type": "10",
        },
      ],
    })),
  };
}

export function GetRulesSettings(DatabaseTournament: ITournament): {
  phase: PhaseData[];
} {
  const AllPhases: PhaseData[] = [];
  const TeamsPerMatch = DatabaseTournament.MaxPlayersPerMatch;
  const IsFFATournament = TeamsPerMatch > 2;
  const phasesCount = DatabaseTournament.Phases.length;

  const FFANonFinalDist = IsFFATournament
    ? calculateFFAPoints(TeamsPerMatch)
    : "";
  const MinPlayersStr = DatabaseTournament.MinPlayersPerMatch.toString();
  const MaxPlayersStr = TeamsPerMatch.toString();
  const AllowTiebreakers = IsFFATournament ? "1" : "0";

  for (let PhaseIndex = 0; PhaseIndex < phasesCount; PhaseIndex++) {
    const PhaseDataObject = DatabaseTournament.Phases[PhaseIndex];
    const PhaseTypeNum =
      Number(PhaseDataObject.PhaseType) ||
      TournamentPhaseType.SingleEliminationBracket;
    const PhaseType = TournamentPhaseType[PhaseTypeNum];
    const PhaseTypeStr = PhaseDataObject.PhaseType?.toString() ?? "2";

    const IsLastPhase = PhaseIndex === phasesCount - 1;
    const IsPhaseFormat = PhaseType === "RoundRobin" || PhaseType === "Arena";

    let RoundsForPhase =
      PhaseDataObject.RoundCount || DatabaseTournament.RoundCount;

    if (IsLastPhase) {
      if (
        PhaseType === "SingleEliminationBracket" ||
        PhaseType === "DoubleEliminationBracket"
      ) {
        RoundsForPhase = Math.max(
          PhaseDataObject.RoundCount || DatabaseTournament.RoundCount,
          1,
        );
      }
    } else if (PhaseType === "RoundRobin" || PhaseType === "Arena") {
      RoundsForPhase =
        PhaseDataObject.RoundCount || DatabaseTournament.RoundCount;
    }

    const Rounds = buildRounds(
      DatabaseTournament,
      PhaseIndex + 1,
      RoundsForPhase,
      IsLastPhase,
      IsPhaseFormat,
      IsFFATournament,
      TeamsPerMatch,
      FFANonFinalDist,
    );
    const CurrentPlayers = (
      PhaseDataObject.MaxTeams || DatabaseTournament.MaxInvites
    ).toString();

    const Phase: PhaseData = {
      "@id": (PhaseIndex + 1).toString(),
      "@type": PhaseTypeStr,
      "@max-players": CurrentPlayers,
      "@min-teams-per-match": MinPlayersStr,
      "@max-teams-per-match": MaxPlayersStr,
      "@min-checkins-per-team": "1",
      "@allow-skip": "0",
      "@game-point-distribution": "1",
      "@match-point-distribution": "1",
      "@allow-tiebreakers": AllowTiebreakers,
      round: Rounds,
    };

    if (PhaseDataObject.IsPhase) {
      Phase["@score-tiebreaker-stats"] = "1";
      Phase["@fill-groups-vertically"] = "0";
      Phase["@force-unique-matches"] = "0";
      Phase["@preferred-rematch-gap"] = "0";
      Phase["@match-point-distribution-custom"] = "1";
      Phase["@group-count"] = PhaseDataObject.GroupCount?.toString() || "1";
      Phase["@allow-tiebreakers"] = "1";
    } else {
      Phase["@max-loses"] = PhaseDataObject?.MaxLoses?.toString() || "1";
    }

    AllPhases.push(Phase);
  }

  return { phase: AllPhases };
}

function calculateFFAPoints(TeamsPerMatch: number): string {
  const PassCount = Math.ceil(TeamsPerMatch / 2);
  const PointsArray = new Array(TeamsPerMatch);

  for (let i = 0; i < TeamsPerMatch; i++) {
    PointsArray[i] =
      i < PassCount ? TeamsPerMatch - i * 2 : -(i - PassCount + 1);
  }

  return PointsArray.join(",");
}

function buildRounds(
  DatabaseTournament: ITournament,
  PhaseId: number,
  RoundsCount: number,
  IsLastPhase: boolean,
  IsPhaseFormat: boolean,
  IsFFATournament: boolean,
  TeamsPerMatch: number,
  FFANonFinalDist: string,
): RoundData[] {
  const Rounds: RoundData[] = [];

  for (let I = 1; I <= RoundsCount; I++) {
    const IsFinals = IsLastPhase && I === RoundsCount && !IsPhaseFormat;
    const Config = GetRoundConfig(DatabaseTournament, PhaseId, I);

    const Round: RoundData = {
      "@id": I.toString(),
      "@win-score": "1",
      "@max-game-count": Config.MaxGameCount.toString(),
      "@min-length": Config.MinGameLength.toString(),
      "@max-length": Config.MaxLength.toString(),
    };

    if (IsFinals) {
      if (IsFFATournament) {
        const FinalPointsArray = new Array(TeamsPerMatch);
        for (let i = 0; i < TeamsPerMatch; i++) {
          FinalPointsArray[i] = i === 0 ? TeamsPerMatch : -i;
        }
        Round["@match-point-distribution"] = FinalPointsArray.join(",");
      } else {
        Round["@match-point-distribution"] = "2,-1";
      }
    } else if (IsFFATournament && !IsPhaseFormat) {
      Round["@match-point-distribution"] = FFANonFinalDist;
    }

    Rounds.push(Round);
  }

  return Rounds;
}

export function GetRoundConfig(
  DatabaseTournament: ITournament,
  PhaseId: number,
  RoundId: number,
): RoundConfig {
  const TotalPhases = DatabaseTournament.Phases.length;
  const IsFinalPhase = PhaseId === TotalPhases;
  const PhaseConfig = DatabaseTournament.Phases[PhaseId - 1];
  const PhaseRoundCount =
    PhaseConfig?.RoundCount || DatabaseTournament.RoundCount;
  const IsFinalRound = RoundId === PhaseRoundCount;

  if (IsFinalPhase && IsFinalRound) {
    return {
      MinGameLength: 10,
      MaxLength: 15,
      MaxGameCount: 1,
    };
  }
  if (IsFinalPhase) {
    return {
      MinGameLength: 8,
      MaxLength: 12,
      MaxGameCount: 1,
    };
  }
  return {
    MinGameLength: 6,
    MaxLength: 7,
    MaxGameCount: 1,
  };
}

export function GetRoundConfigs(
  DatabaseTournament: ITournament,
  PhaseId?: number,
): Map<number, RoundConfig> {
  const RoundConfigs = new Map<number, RoundConfig>();
  const CurrentPhaseId = PhaseId || DatabaseTournament.CurrentPhaseId || 1;

  for (let I = 1; I <= 50; I++) {
    RoundConfigs.set(I, GetRoundConfig(DatabaseTournament, CurrentPhaseId, I));
  }

  return RoundConfigs;
}
