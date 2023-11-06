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
import { requestDataPackages } from "redstone-sdk";
import { providerToDataServiceId } from "../providers";
import axios from "axios";
import csvToJSON from "csv-file-to-json";

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

const getLatestPricesForSingleToken = async (params: PriceWithParams) => {
  validateParams(params, ["symbol"]);
  const prices = await getPrices({
    filters: {
      symbol: params.symbol,
      provider: params.provider,
    },
    limit: params.limit,
    offset: params.offset,
  });
  return prices.map(priceToObject);
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

const getPriceForManyTokens = async (params: PriceWithParams) => {
  // Parsing symbols params
  let tokens = [];
  if (params.symbols !== undefined) {
    tokens = params.symbols.split(",");
  }

  // Building filters
  const filters = { provider: params.provider };
  if (params.toTimestamp !== undefined) {
    filters["timestamp"] = { $lte: params.toTimestamp };
  }

  // Fetching prices from DB
  const prices = await getPrices({
    filters,
    limit: bigLimitWithMargin,
    offset: 0,
  });

  // Building tokens object
  const tokensResponse = {};
  for (const price of prices) {
    // We currently filter here
    if (tokens.length === 0 || tokens.includes(price.symbol)) {
      if (tokensResponse[price.symbol] === undefined) {
        tokensResponse[price.symbol] = priceToObject(price);
      } else {
        if (tokensResponse[price.symbol].timestamp < price.timestamp) {
          tokensResponse[price.symbol] = priceToObject(price);
        }
      }
    }
  }

  return tokensResponse;
};

const getHistoricalPricesForSingleToken = async (params: PriceWithParams) => {
  validateParams(params, ["symbol"]);
  const filters = {
    symbol: params.symbol,
    provider: params.provider,
    timestamp: { $lte: params.toTimestamp } as { $lte: number; $gte?: number },
  };

  if (params.fromTimestamp) {
    filters.timestamp.$gte = params.fromTimestamp;
  }

  const prices = await getPrices({
    filters,
    offset: Number(params.offset || 0),
    limit: params.limit || defaultLimit,
  });
  return prices.map(priceToObject);
};

// This function is used to return data for charts
const getPricesInTimeRangeForSingleToken = async (params: PriceWithParams) => {
  validateParams(params, [
    "symbol",
    "fromTimestamp",
    "toTimestamp",
    "interval",
    "provider",
  ]);
  const {
    symbol,
    provider,
    fromTimestamp,
    toTimestamp,
    interval,
    offset,
    limit,
  } = params;
  const pipeline = [
    {
      $match: {
        symbol,
        provider,
        timestamp: {
          $gte: Number(fromTimestamp),
          $lte: Number(toTimestamp),
        },
      },
    },
  ] as PipelineStage[];

  if (interval >= 3600 * 1000) {
    pipeline.push({
      $match: { minutes: 59 },
    });
  } else if (interval >= 600 * 1000) {
    pipeline.push({
      $match: { $expr: { $in: ["$minutes", [9, 19, 29, 39, 49, 59]] } },
    });
  }

  if (offset) {
    pipeline.push({
      $skip: Number(offset),
    });
  }

  if (limit) {
    pipeline.push({
      $limit: Number(limit),
    });
  }

  const fetchedPrices = await Price.aggregate(pipeline);
  let prices = fetchedPrices.map(priceToObject);

  // TODO: sorting may be moved to aggregation pipeline later
  // it caused performance problems, that's why now we do it here
  prices.sort((p1, p2) => p1.timestamp - p2.timestamp);

  // This is a hack
  // We make the additional filtering here because some
  // providers (rapid, stocks) post several prices per minute
  // so we can not filter them out in DB query level
  const millisecondsInMinute = 60 * 1000;
  if (interval > millisecondsInMinute && prices.length > 0) {
    let filteredPrices = [],
      prevTimestamp = prices[0].timestamp;
    for (const price of prices) {
      const diff = price.timestamp - prevTimestamp;
      if (diff === 0 || diff > millisecondsInMinute) {
        filteredPrices.push(price);
        prevTimestamp = price.timestamp;
      }
    }
    prices = filteredPrices;
  }

  return prices;
};

const getPrices = async ({
  filters = {},
  limit = defaultLimit,
  offset,
}: {
  filters: FilterQuery<Price>;
  limit: number;
  offset: number;
}) => {
  // Query building
  let pricesQuery = Price.find(filters)
    .sort({ timestamp: -1 })
    .limit(Math.min(Number(limit), maxLimitForPrices));
  if (offset) {
    pricesQuery = pricesQuery.skip(Number(offset));
  }

  // Query executing
  const prices = await pricesQuery.exec();

  return prices;
};

const validateParams = (
  params: Record<string, any>,
  requiredParams: string[]
) => {
  const errors = [];
  for (const requiredParam of requiredParams) {
    if (params[requiredParam] === undefined) {
      errors.push(`Param ${requiredParam} is required`);
    }
  }

  if (errors.length > 0) {
    throw new Error(JSON.stringify(errors));
  }
};

const getPricesCount = (reqBody: PriceWithParams) => {
  if (Array.isArray(reqBody)) {
    return reqBody.length;
  } else {
    return 1;
  }
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

async function requestInflux(query: string) {
  const config = {
    headers: {
      Authorization: `Token ${process.env.INFLUXDB_TOKEN}`,
      "Content-Type": "application/vnd.flux",
    },
  };
  const result = await axios.post(
    `${process.env.INFLUXDB_URL}/api/v2/query?org=redstone`,
    query,
    config
  );
  const json = csvToJSON({ data: result.data });
}

export const prices = (router: Router) => {
  /**
   * This endpoint is used for fetching prices data.
   * It is used in redstone-api
   */

  function shouldRunTestFeature() {
    return (
      Math.floor(Math.random() * 100) <
      Number(process.env.PERCENT_OF_TEST_FEATURES)
    );
  }

  router.get(
    "/prices",
    asyncHandler(async (req, res) => {
      // Request validation
      const params = req.query as unknown as QueryParams;

      // Saving API read event in amplitude
      logEvent({
        eventName: "api-get-request",
        eventProps: params,
        ip: getIp(req),
      });
      console.log("Getting prices");
      console.log(`AllParams ${JSON.stringify(params)}`);

      if (
        !params.fromTimestamp &&
        !params.toTimestamp &&
        !params.limit &&
        shouldRunTestFeature()
      ) {
        try {
          console.log("Running test feature");
          const provider = await getProviderFromParams(
            req.query as { provider: string }
          );
          const symbol = req.query.symbol as string;
          const symbols = req.query.symbols as string;
          if (symbol !== "") {
            const dataPackageResponse = await requestDataPackages({
              dataServiceId:
                providerToDataServiceId[req.query.provider as string],
              uniqueSignersCount: 1,
              dataFeeds: [symbol],
            });
            const dataPackage = dataPackageResponse[symbol][0];
            return res.json(mapToResponse(dataPackage, provider));
          } else if (symbols !== undefined) {
            const tokens = symbols.split(",");
            const dataPackageResponse = await requestDataPackages({
              dataServiceId:
                providerToDataServiceId[req.query.provider as string],
              uniqueSignersCount: 1,
              dataFeeds: tokens,
            });
            return res.json(
              toMap(
                tokens
                  .map((token) => dataPackageResponse[token][0])
                  .flatMap((dataPackage) =>
                    mapToResponse(dataPackage, provider)
                  )
              )
            );
          } else {
            const dataPackageResponse = await requestDataPackages({
              dataServiceId:
                providerToDataServiceId[req.query.provider as string],
              uniqueSignersCount: 1,
            });
            const dataPackage = dataPackageResponse["___ALL_FEEDS___"][0];
            return res.json(toMap(mapToResponse(dataPackage, provider)));
          }
        } catch (e) {
          console.error(e);
          console.log(`Failed running test feautre: ${JSON.stringify(params)}`);
          throw e;
        }
      }

      // Getting provider details
      const providerDetails = await getProviderFromParams(params);
      params.provider = providerDetails.address;
      params.providerPublicKey = providerDetails.publicKey;

      // If query params contain "symbol" we fetch price for this symbol
      if (params.symbol !== undefined) {
        let body: _.Omit<
          Document<unknown, any, Price> & Price & { providerPublicKey: any },
          "_id" | "__v"
        >[];
        if (params.interval !== undefined) {
          body = await getPricesInTimeRangeForSingleToken(params);
        } else if (params.toTimestamp !== undefined) {
          body = await getHistoricalPricesForSingleToken(params);
        } else {
          body = await getLatestPricesForSingleToken(params);
        }
        return res.json(body);
      }
      // Otherwise we fetch prices for many symbols
      else {
        let tokens = [];
        if (params.symbols !== undefined) {
          tokens = params.symbols.split(",");
        }
        params.tokens = tokens;

        const body = await getPriceForManyTokens(params);
        return res.json(body);
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
