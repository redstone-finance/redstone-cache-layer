const asyncHandler = require("express-async-handler");
const cloudwatch = require("../helpers/cloudwatch");

module.exports = (router) => {

  /**
   * This endpoint is used for saving metric values in AWS Cloudwatch.
   * Thanks to them we can analyse redstone-node performance and build
   * nice charts
  */
  router.post("/metrics", asyncHandler(async (req, res) => {
    const { label, value } = req.body;
    await cloudwatch.saveMetric({ label, value });

    return res.json({
      msg: "Metric saved",
    });
  }));
};
