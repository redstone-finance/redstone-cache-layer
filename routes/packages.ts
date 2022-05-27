import asyncHandler from "express-async-handler";
import _ from "lodash";
import { Package } from "../models/package";
import { Price } from "../models/price";
import { getProviderFromParams } from "../utils";
import { tryCleanCollection } from "../helpers/mongo";
import { enableLiteMode, cacheTTLMilliseconds } from "../config";
import { Router } from "express";
import { Document } from "mongoose";

const dbItemToObj = (item: Document<unknown, any, Package> & Package) => {
  return _.omit(item.toObject(), ["_id", "__v"]);
}

export const packages = (router: Router) => {
  /**
   * This endpoint is used for publishing a new price package
  */
  router.post("/packages", asyncHandler(async (req, res) => {
    // Saving package in DB
    const newPackage = new Package(req.body);
    await newPackage.save();

    // Cleaning older packages of the same provider before in the lite mode
    if (enableLiteMode) {
      await tryCleanCollection(Package, {
        signer: req.body.signer,
        timestamp: { $lt: newPackage.timestamp - cacheTTLMilliseconds },
      });
    }

    // Returning package id in response
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
    const provider = await getProviderFromParams(req.query as { provider: string; });

    if (!provider.address) {
      throw new Error("Provider address is required");
    }

    const symbol = req.query.symbol as string;

    if (symbol) {
      // Fetching latest price for symbol from DB
      const price = await Price.findOne({
          provider: provider.address,
          symbol,
        })
        .sort({ timestamp: -1 });

      if (!price) {
        throw new Error(`Value not found for symbol: ${symbol}`);
      }
      
      const responseObj = {
        ..._.pick(price, ["timestamp", "provider"]),
        signature: price.evmSignature?.toString("base64"),
        liteSignature: price.liteEvmSignature.toString("base64"),
        prices: [{ symbol, value: price.value }],
        signer: provider.evmAddress, // TODO: we don't really need signer, as it must be fetched from a trusted source or hardcoded in the redstone-evm-connector
      };

      return res.json(responseObj);
    } else {
      // Fetching latest package from DB
      const packageFromDB = await Package.findOne({
          provider: provider.address,
        })
        .sort({ timestamp: -1 });

      if (!packageFromDB) {
        throw new Error(`Latest package not found`);
      }

      const responseObj = dbItemToObj(packageFromDB);
      return res.json(responseObj);
    }
  }));
};
