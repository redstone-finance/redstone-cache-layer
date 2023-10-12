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

const dbItemToObj = (item: Document<unknown, any, Package> & Package) => {
  return _.omit(item.toObject(), ["_id", "__v"]);
};

const findPackage = async (req, res, initialMongoQuery) => {
  throwExpiredApiError();
};

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
      const initialMongoQuery = {};
      return await findPackage(req, res, initialMongoQuery);
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
