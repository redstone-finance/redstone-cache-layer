import express from "express";
import { prices } from "./prices";
import { packages } from "./packages";
import { errors } from "./errors";
import { configs } from "./configs";
import { providers } from "./providers";
import { enableLiteMode } from "../config";

export const getRouter = () => {
  const router = express.Router();

  prices(router);
  packages(router);
  configs(router);
  providers(router);

  if (!enableLiteMode) {
    errors(router);
  }

  return router;
};
