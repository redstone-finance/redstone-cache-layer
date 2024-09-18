import express from "express";
import { prices } from "./prices";
import { onChainUpdates } from "./onChainUpdates";
import { feedsAnswersUpdate } from "./feedsAnswersUpdates";
import { metrics } from "./metrics";
import { errors } from "./errors";
import { configs } from "./configs";
import { providers } from "./providers";
import { enableLiteMode } from "../config";

export const getRouter = () => {
  const router = express.Router();

  prices(router);
  configs(router);
  providers(router);
  onChainUpdates(router);
  feedsAnswersUpdate(router);
  if (!enableLiteMode) {
    metrics(router);
    errors(router);
  }

  return router;
};
