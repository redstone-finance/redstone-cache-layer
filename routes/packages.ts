import asyncHandler from "express-async-handler";
import _ from "lodash";
import { Package } from "../models/package";
import { Price } from "../models/price";
import { getProviderFromParams } from "../utils";
import { tryCleanCollection } from "../helpers/mongo";
import { enableLiteMode, cacheTTLMilliseconds } from "../config";
import { Router } from "express";
import { Document } from "mongoose";
import { throwExpiredApiError } from "./configs";
import { requestDataPackages } from "redstone-sdk";
import { providerToDataServiceId } from "../providers";

export const packages = (router: Router) => {
  /**
   * This endpoint is used for publishing a new price package
   */
  router.post(
    "/packages",
    asyncHandler(async (req, res) => {
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
    })
  );

  /**
   * This endpoint is used for fetching the latest
   * packages for the specified provider
   */
  router.get(
    "/packages/latest",
    asyncHandler(async (req, res) => {
      const provider = await getProviderFromParams(
        req.query as { provider: string }
      );
      const symbol = req.query.symbol as string;
      const dataPackageResponse = await requestDataPackages({
        dataServiceId: providerToDataServiceId[req.query.provider as string],
        uniqueSignersCount: 1,
        dataFeeds: [symbol],
      });

      const dataPackage = dataPackageResponse[symbol][0];
      const timestamp = dataPackage.dataPackage.timestampMilliseconds;
      const response = {
        timestamp: timestamp,
        provider: provider.address,
        prices: [
          {
            symbol: symbol,
            value: dataPackage.dataPackage.dataPoints[0].toObj().value,
          },
        ],
      };

      return res.json(response);
    })
  );

  /**
   * This endpoint is used for fetching historical
   * packages for the specified provider and timestamp
   */
  router.get(
    "/packages",
    asyncHandler(async (req, res) => {
      throwExpiredApiError();
    })
  );
};
