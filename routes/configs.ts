import { Router } from "express";
import tokens from "redstone-node/dist/src/config/tokens.json";

export const configs = (router: Router) => {

  /**
   * This endpoint is used for returning tokens config file
   * This endpoint creation was requested by JF#1885 on Discord
  */
  router.get("/configs/tokens", (req, res) => {
    res.json(tokens);
  });
};
