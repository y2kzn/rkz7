import { Tournament } from "../Models/Tournament";
import { Match } from "../Models/Matches";
import { BackboneUser } from "../Models/BackboneUser";
import { TournamentStatus } from "../Backbone/Config";

export class TournamentCleaner {
  private static IsRunning = false;

  private static async Clean(): Promise<void> {
    const FortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000);
    const Finished = await Tournament.find({ Status: TournamentStatus.Finished }).lean();

    for (const Tour of Finished) {
      try {
        const TournamentId = Tour.TournamentId.toString();
        const LastPhaseId = Tour.Phases.length;

        const LastMatch = await Match.findOne({
          tournamentid: TournamentId,
          phaseid: LastPhaseId,
        })
          .sort({ roundid: -1 })
          .select("deadline status")
          .lean();

        if (!LastMatch || (new Date(LastMatch.deadline) < FortyFiveMinsAgo && LastMatch.status === 8)) {
          await Match.deleteMany({ tournamentid: TournamentId });
          await BackboneUser.updateMany(
            { [`Tournaments.${TournamentId}`]: { $exists: true } },
            { $unset: { [`Tournaments.${TournamentId}`]: "" } }
          );
          await Tournament.deleteOne({ TournamentId });
        }
      } catch (err) {
        console.error(`cleaner error for ${Tour.TournamentId}:`, err);
      }
    }
  }

  public static async Start(): Promise<void> {
    if (this.IsRunning) return;
    this.IsRunning = true;

    while (this.IsRunning) {
      try {
        await this.Clean();
      } catch (err) {
        console.error("cleaner error:", err);
      }

      await new Promise((r) => setTimeout(r, 45 * 60 * 1000));
    }
  }

  public static Stop(): void {
    this.IsRunning = false;
  }
}
