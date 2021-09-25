const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const Package = require("../models/package");
const Price = require("../models/price");
const { getProviderFromParams } = require("../utils");

function dbItemToObj(item) {
  return _.omit(item.toObject(), ["_id", "__v"]);
}

module.exports = (router) => {
  /**
   * This endpoint is used for publishing a new price package
  */
  router.post("/packages", asyncHandler(async (req, res) => {
    const newPackage = new Package(req.body);
    await newPackage.save();
    return res.json({
      msg: "Package saved",
      id: newPackage._id,
    });
  }));

  /**
   * This endpoint is used for fetching the latest
   * packages for the specified provider
  */
  router.get("/packages/latest", asyncHandler(async (req, res) => {
    const provider = await getProviderFromParams(req.query);

    if (!provider.address) {
      throw new Error("Provider address is required");
    }

    // Fetching package from DB
    const packages = await Package
      .find({ provider: provider.address })
      .sort({ timestamp: -1 })
      .limit(1);

    const packageObjects = packages.map(dbItemToObj);

    if (packageObjects.length === 0) {
      return res.status(404).send("Package not found");
    } else {
      const packageObj = packageObjects[0];

      // Building mongo query
      const priceQuery = {
        provider: provider.address,
        timestamp: packageObj.timestamp,
      };
      if (req.query.symbol) {
        priceQuery.symbol = req.query.symbol;
      }

      // Fetching prices from DB
      const prices = await Price.find(priceQuery);
      packageObj.prices = prices.map(p => _.pick(p, ["symbol", "value"]));

      // Replacing evm signatures for single price if needed
      if (req.query.symbol) {
        if (prices.length !== 1) {
          throw new Error(
            `Must have exactly one price for symbol: "${req.query.symbol}"`);
        }
        packageObj.signature = prices[0].evmSignature.toString("base64");
        packageObj.liteSignature = prices[0].liteEvmSignature.toString("base64");
      }

      return res.json(packageObj);
    }
  }));
};
