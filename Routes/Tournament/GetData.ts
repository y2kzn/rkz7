import { Router } from "express";
import j from "joi";
import { TournamentGetData } from "../../Backbone/Logic/TournamentData";
import { AppId } from "../../Modules/Constants";

const App = Router();
const TournamentDataSchema = j
  .object({
    backbone_app_id: j.string().required().valid(AppId),
    "x-unity-version": j.string().required(),
    access_token: j.string().required(),
  })
  .unknown(true);

const GetDataBodySchema = j
  .object({
    tournamentId: j.number().required(),
    getAllData: j.number().required().valid(0, 1),
    readyForNextMatch: j.number().required().valid(0, 1),
    accessToken: j.string().required(),
  })
  .unknown(true);

App.post(
  "/tournamentGetData",
  async (req, res) => {
    const Data = await TournamentGetData(
      req.body.tournamentId as number,
      req.body.getAllData as number,
      req.body.readyForNextMatch as number,
      req.body.accessToken
    );
    res.json(Data).status(200);
  }
);
export default {
  App,
  DefaultAPI: "/api/v2",
};

