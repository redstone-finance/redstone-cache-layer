import { Router } from "express";
import providersJson from "redstone-node/dist/src/config/nodes.json";

export const providers = (router: Router) => {

  /**
   * This endpoint is used for returning providers details
  */
  router.get("/providers", (req, res) => {
    res.json(providersJson);
  });
};
