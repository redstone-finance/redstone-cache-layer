import { Router } from "express";
import { getProviders } from "../providers";

export const providers = (router: Router) => {
  /**
   * This endpoint is used for returning providers details
   */
  router.get("/providers", (req, res) => {
    res.json(getProviders());
  });
};
