import { Request, Router } from "express";
import asyncHandler from "express-async-handler";
import { FilterQuery, PipelineStage, Document } from "mongoose";
import _ from "lodash";
import {
  bigLimitWithMargin,
  defaultLimit,
  cacheTTLMilliseconds,
  maxLimitForPrices,
  enableLiteMode,
} from "../config";
import { Price, priceToObject } from "../models/price";
import { logEvent } from "../helpers/amplitude-event-logger";
import { assertValidSignature } from "../helpers/signature-verifier";
import { priceParamsToPriceObj, getProviderFromParams } from "../utils";
import { logger } from "../helpers/logger";
import { tryCleanCollection } from "../helpers/mongo";
import { throwExpiredApiError } from "./configs";
import { requestDataPackages } from "redstone-sdk";
import { providerToDataServiceId } from "../providers";

export interface PriceWithParams
  extends Omit<Price, "signature" | "evmSignature" | "liteEvmSignature"> {
  limit?: number;
  offset?: number;
  fromTimestamp?: number;
  toTimestamp?: number;
  interval?: number;
  providerPublicKey?: string;
  symbols?: string;
  signature?: string;
  evmSignature?: string;
  liteEvmSignature?: string;
}

const addSinglePrice = async (params: PriceWithParams) => {
  const price = new Price(priceParamsToPriceObj(params));
  await price.save();
};

const getPricesCount = (reqBody: PriceWithParams) => {
  if (Array.isArray(reqBody)) {
    return reqBody.length;
  } else {
    return 1;
  }
};

const addSeveralPrices = async (params: PriceWithParams[]) => {
  const ops = [];
  for (const price of params) {
    ops.push({
      insertOne: {
        document: priceParamsToPriceObj(price),
      },
    });
  }
  await Price.bulkWrite(ops);
};

const getIp = (req: Request) => {
  const ip = req.ip;
  logger.info("Request IP address: " + ip);
  return ip;
};

interface QueryParams extends PriceWithParams {
  provider: string;
  symbols?: string;
  tokens?: string[];
  providerPublicKey?: string;
}

const mapToResponse = (dataPackage: any, provider: any) => {
  return dataPackage.dataPackage.dataPoints.map((point: any) => {
    const sourceMetadata = point.toObj().metadata.sourceMetadata;

    let sourcesFormatted = {};
    for (const [name, value] of Object.entries(sourceMetadata)) {
      sourcesFormatted[name] = Number((value as any).value);
    }
    const timestamp = dataPackage.dataPackage.timestampMilliseconds;
    return {
      symbol: point.dataFeedId,
      provider: provider.address,
      value: point.toObj().value,
      source: sourcesFormatted,
      timestamp: timestamp,
      providerPublicKey: provider.publicKey,
      permawebTx: "mock-permaweb-tx",
      version: "0.3",
    };
  });
};

const toMap = (priceList: any) => {
  let map = {};
  for (const price of priceList) {
    map[price.symbol] = price;
  }
  return map;
};

export const prices = (router: Router) => {
  /**
   * This endpoint is used for fetching prices data.
   * It is used in redstone-api
   */
  router.get(
    "/prices",
    asyncHandler(async (req, res) => {
      if (
        req.query.fromTimestamp ||
        req.query.toTimestamp ||
        req.query.interval
      ) {
        throwExpiredApiError();
      }
      const provider = await getProviderFromParams(
        req.query as { provider: string }
      );
      const symbol = req.query.symbol as string;
      const symbols = req.query.symbols as string;
      if (symbol !== undefined) {
        const dataPackageResponse = await requestDataPackages({
          dataServiceId: providerToDataServiceId[req.query.provider as string],
          uniqueSignersCount: 1,
          dataFeeds: [symbol],
        });
        const dataPackage = dataPackageResponse[symbol][0];
        return res.json(mapToResponse(dataPackage, provider));
      } else if (symbols !== undefined) {
        const tokens = symbols.split(",");
        const dataPackageResponse = await requestDataPackages({
          dataServiceId: providerToDataServiceId[req.query.provider as string],
          uniqueSignersCount: 1,
          dataFeeds: tokens,
        });
        return res.json(
          toMap(
            tokens
              .map((token) => dataPackageResponse[token][0])
              .flatMap((dataPackage) => mapToResponse(dataPackage, provider))
          )
        );
      } else {
        const dataPackageResponse = await requestDataPackages({
          dataServiceId: providerToDataServiceId[req.query.provider as string],
          uniqueSignersCount: 1,
        });
        const dataPackage = dataPackageResponse["___ALL_FEEDS___"][0];
        return res.json(toMap(mapToResponse(dataPackage, provider)));
      }
    })
  );

  /**
   * This endpoint is used for posting a new price data.
   * It supports posting a single price and several prices
   */
  router.post(
    "/prices",
    asyncHandler(async (req, res) => {
      const reqBody = req.body as PriceWithParams;
      let pricesSavedCount = 0;

      // Saving API post event in amplitude
      logEvent({
        eventName: "api-post-request",
        eventProps: {
          pricesCount: getPricesCount(reqBody),
        },
        ip: getIp(req),
      });

      if (Array.isArray(reqBody)) {
        const invalidPrices = reqBody.filter((p) => !p.value);
        if (invalidPrices.length > 0) {
          logger.error(
            "Invalid prices with empty value: " + JSON.stringify(invalidPrices)
          );
        }

        // Validating a signature of a randomly selected price
        // We got rid of arweave signatures
        // const priceToVerify = _.sample(reqBody);
        // await assertValidSignature(priceToVerify);

        // Adding several prices
        await addSeveralPrices(reqBody);

        // Cleaning older prices for the same provider after posting
        // new ones in the lite mode
        if (enableLiteMode) {
          await tryCleanCollection(Price, {
            provider: reqBody[0].provider,
            timestamp: {
              $lt: Number(reqBody[0].timestamp) - cacheTTLMilliseconds,
            },
          });
        }

        pricesSavedCount = reqBody.length;
      } else {
        // Validating the price signature
        await assertValidSignature(reqBody);

        // Adding a single price
        await addSinglePrice(reqBody);
        pricesSavedCount = 1;

        // Cleaning prices for the same provider and symbol before posting
        // a new one in the lite mode
        if (enableLiteMode) {
          await tryCleanCollection(Price, {
            provider: reqBody.provider,
            symbol: reqBody.symbol,
            timestamp: {
              $lt: Number(reqBody.timestamp) - cacheTTLMilliseconds,
            },
          });
        }
      }

      return res.json({ msg: `Prices saved. count: ${pricesSavedCount}` });
    })
  );
};
