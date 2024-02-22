import { Router } from "express";
import asyncHandler from "express-async-handler";
import { saveMetric } from "../helpers/cloudwatch";

export const metrics = (router: Router) => {

  /**
   * This endpoint is used for saving metric values in AWS Cloudwatch.
   * Thanks to them we can analyse redstone-node performance and build
   * nice charts
  */
  router.post("/metrics", asyncHandler( (req, res) => {
    const { label, value } = req.body;
    saveMetric({ label, value });

    return res.json({
      msg: "Metric saved",
    });
  }));
};
