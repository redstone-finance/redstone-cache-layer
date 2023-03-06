import axios from "axios";
import { Router } from "express";
// import tokens from "redstone-node/dist/src/config/tokens.json";

const TOKENS_CONFIG_URL =
  "https://raw.githubusercontent.com/redstone-finance/redstone-oracles-monorepo/main/packages/oracle-node/src/config/tokens.json";

export const configs = (router: Router) => {
  /**
   * This endpoint is used for returning tokens config file
   * This endpoint creation was requested by JF#1885 on Discord
   */
  router.get("/configs/tokens", async (req, res) => {
    const tokensConfigResponse = await axios.get(TOKENS_CONFIG_URL);
    res.json(tokensConfigResponse.data);
  });
};
