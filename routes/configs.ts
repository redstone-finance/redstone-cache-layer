import axios from "axios";
import { Router } from "express";
// import tokens from "redstone-node/dist/src/config/tokens.json";

const TOKENS_CONFIG_URL =
  "https://raw.githubusercontent.com/redstone-finance/redstone-app/main/src/config/tokens.json";

export const getConfig = async () => {
  return (await axios.get(TOKENS_CONFIG_URL)).data;
};

export const configs = (router: Router) => {
  /**
   * This endpoint is used for returning tokens config file
   * This endpoint creation was requested by JF#1885 on Discord
   */
  router.get("/configs/tokens", async (req, res) => {
    const tokensConfigResponse = await getConfig();
    res.json(tokensConfigResponse);
  });
};

export function throwExpiredApiError() {
  throw new Error(
    'This API is expired. You can switch to redstone-sdk https://www.npmjs.com/package/redstone-sdk. If this API is necessary for your application - send us an email: dev@redstone.finance and set endpoint redstone.setCacheApiUrl("https://expiring.b.redstone.finance/prices") which will be also expired in few days.'
  );
}
