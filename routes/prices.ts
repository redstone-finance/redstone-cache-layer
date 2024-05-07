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
import { getConfig } from "./configs";
import { getDataServiceId } from "../providers";
import { Price, priceToObject } from "../models/price";
import { logEvent } from "../helpers/amplitude-event-logger";
import { assertValidSignature } from "../helpers/signature-verifier";
import { priceParamsToPriceObj, getProviderFromParams } from "../utils";
import { logger } from "../helpers/logger";
import { tryCleanCollection } from "../helpers/mongo";
import { requestDataPackages, fetchDataPackages } from "@redstone-finance/sdk";
import { providerToDataServiceId } from "../providers";
import axios from "axios";
import csvToJSON from "csv-file-to-json";
import { String } from "aws-sdk/clients/cloudsearch";
import { time } from "console";

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

const sanitize = (value: number | undefined | "undefined") =>
  (value !== undefined && value !== "undefined") ? value : undefined

const getPriceForManyTokens = async (params: PriceWithParams) => {
  // Parsing symbols params
  let tokens = [];
  if (params.symbols !== undefined) {
    tokens = params.symbols.split(",");
  }

  // Building filters
  const filters = { provider: params.provider };
  if (sanitize(params.toTimestamp) !== undefined) {
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

  if (sanitize(params.fromTimestamp)) {
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

const mapFromSdkToResponse = (dataPackage: any, provider: any) => {
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

const mapFromGatewayToResponse = (dataPackage: any, provider: any) => {
  return dataPackage.dataPoints.map((point: any) => {
    const sourceMetadata = point.metadata.sourceMetadata;

    let sourcesFormatted = {};
    for (const [name, value] of Object.entries(sourceMetadata)) {
      sourcesFormatted[name] = Number((value as any).value);
    }
    const timestamp = dataPackage.timestampMilliseconds;
    return {
      symbol: point.dataFeedId,
      provider: provider.address,
      value: point.value,
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

function validatePareter(parameter: string) {
  const onlyLettersPattern = /^[A-Z a-z.0-9=/_$-]+$/;
  if (!parameter.match(onlyLettersPattern)) {
    throw new Error(`Invalid parameter: ${parameter}`);
  }
  return parameter;
}

async function requestInflux(query: String) {
  const config = {
    headers: {
      Authorization: `Token ${process.env.INFLUXDB_TOKEN}`,
      "Content-Type": "application/vnd.flux",
    },
  };
  try {
    const result = await axios.post(
      `${process.env.INFLUXDB_URL}/api/v2/query?org=redstone`,
      query,
      config
    );
    const json = csvToJSON({ data: result.data });
    return json;
  } catch (error) {
    console.error(error);
    throw new Error("Request failed");
  }
}

export const prices = (router: Router) => {
  /**
   * This endpoint is used for fetching prices data.
   * It is used in redstone-api
   */

  function shouldRunTestFeature(percentOfTestFeatureEnv) {
    if (percentOfTestFeatureEnv) {
      return Math.floor(Math.random() * 100) < Number(percentOfTestFeatureEnv);
    } else {
      return false;
    }
  }

  async function handleByOracleGateway(req, res, dataServiceId, params) {
    try {
      const provider = await getProviderFromParams(
        req.query as { provider: string }
      );
      const symbol = req.query.symbol as string;
      const symbols = req.query.symbols as string;
      if (symbol !== undefined && symbol !== "") {
        const dataPackageResponse = await requestDataPackages({
          dataServiceId: dataServiceId,
          uniqueSignersCount: 1,
          dataFeeds: [symbol],
        });
        const dataPackage = dataPackageResponse[symbol][0];
        return res.json(mapFromSdkToResponse(dataPackage, provider));
      } else if (symbol === "") {
        return res.json([]);
      } else if (symbols !== undefined) {
        const tokens = symbols.split(",");
        const dataPackages = await fetchDataPackages({
          dataServiceId: dataServiceId,
        });
        return res.json(
          toMap(
            tokens
              .filter((token) => dataPackages[token] !== undefined)
              .map((token) => dataPackages[token][0])
              .flatMap((dataPackage) =>
                mapFromGatewayToResponse(dataPackage, provider)
              )
          )
        );
      } else {
        const dataPackageResponse = await requestDataPackages({
          dataServiceId: dataServiceId,
          uniqueSignersCount: 1,
        });
        const dataPackage = dataPackageResponse["___ALL_FEEDS___"][0];
        return res.json(toMap(mapFromSdkToResponse(dataPackage, provider)));
      }
    } catch (e) {
      console.error(e);
      console.log(`Failed running test feautre: ${JSON.stringify(params)}`);
      throw e;
    }
  }

  async function handleByInfluxWithSymbolAndInterval(
    res,
    params,
    dataServiceId,
    providerDetails
  ) {
    console.log("Executing single token with interval");
    if (
      sanitize(params.fromTimestamp) === undefined ||
      sanitize(params.toTimestamp) === undefined
    ) {
      throw new Error(
        `Param fromTimestamp and toTimestamp are required when using interval`
      );
    }

    const start = Math.ceil((params.fromTimestamp - params.interval) / 1000);
    const stop = Math.floor(params.toTimestamp / 1000);
    const limit = params.limit !== undefined ? params.limit : 100000;
    const offset = params.offset !== undefined ? params.offset : 0;
    const request = `
            from(bucket: "redstone")
            |> range(start: ${start}, stop: ${stop})
            |> filter(fn: (r) => r._measurement == "dataPackages")
            |> filter(fn: (r) => r.dataFeedId == "${validatePareter(
              params.symbol
            )}")
            |> filter(fn: (r) => r.dataServiceId == "${validatePareter(
              dataServiceId
            )}")
            |> keep(columns: ["_time", "_value", "_field", "dataFeedId", "dataServiceId"])
            |> aggregateWindow(every: ${
              params.interval
            }ms, fn: mean, createEmpty: false)
            |> map(fn: (r) => ({ r with timestamp: int(v: r._time) / 1000000 }))
            |> limit(n: ${limit}, offset: ${offset})
          `;
    const results = await requestInflux(request);
    const sourceResults = results.filter(
      (element) =>
        element._field !== "value" && element._field !== "metadataValue"
    );
    const valueResults = results.filter(
      (element) =>
        element._field === "value" && element._field !== "metadataValue"
    );
    const mappedResults = valueResults.map((element) => {
      const sourceResultsForTimestamp = sourceResults.filter(
        (result) => result.timestamp === element.timestamp
      );
      const source = {};
      for (let i = 0; i < sourceResultsForTimestamp.length; i++) {
        const sourceName = sourceResultsForTimestamp[i]._field.replace(
          "value-",
          ""
        );
        source[sourceName] = Number(sourceResultsForTimestamp[i]._value);
      }
      return {
        symbol: element.dataFeedId,
        provider: providerDetails.address,
        value: Number(element._value),
        source: source,
        timestamp: Number(element.timestamp),
        providerPublicKey: providerDetails.publicKey,
        permawebTx: "mock-permaweb-tx",
        version: "0.3",
      };
    });
    console.log("Executed single token with interval");
    return res.json(mappedResults);
  }

  async function handleByInfluxWithSymbolAndNoInterval(
    res,
    params,
    providerDetails,
    dataServiceId
  ) {
    console.log("Executing single token with toTimestamp");
    const limit = params.limit !== undefined ? Number(params.limit) : 1;
    const offset = params.offset !== undefined ? Number(params.offset) : 0;
    if (params.fromTimestamp !== undefined && limit + offset > 1000) {
      throw new Error(
        `When not passing fromTimestamp limit + offset can't be more than 1000, is: ${limit} + ${offset}`
      );
    }
    const stop = sanitize(params.toTimestamp)
      ? Math.floor(params.toTimestamp / 1000)
      : Math.ceil(Date.now() / 1000);
    const searchWindow = Math.max(limit + offset, 3);
    const start =
      sanitize(params.fromTimestamp) !== undefined
        ? Math.ceil(params.fromTimestamp / 1000)
        : stop - searchWindow * 60;
    console.log(
      `limit: ${limit}, offset: ${offset} Start: ${start}, stop: ${stop}`
    );
    const request = `
            from(bucket: "redstone")
            |> range(start: ${start}, stop: ${stop})
            |> filter(fn: (r) => r._measurement == "dataPackages")
            |> filter(fn: (r) => r.dataFeedId == "${validatePareter(
              params.symbol
            )}")
            |> filter(fn: (r) => r.dataServiceId == "${validatePareter(
              dataServiceId
            )}")
            |> keep(columns: ["_time", "_value", "_field", "dataFeedId", "dataServiceId"])
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: ${limit}, offset: ${offset})
            |> map(fn: (r) => ({ r with timestamp: int(v: r._time) / 1000000 })) 
          `;
    const results = await requestInflux(request);
    const sourceResults = results.filter(
      (element) =>
        element._field !== "value" && element._field !== "metadataValue"
    );
    const mappedResults = results
      .filter(
        (element) =>
          element._field === "value" && element._field !== "metadataValue"
      )
      .map((element) => {
        const sourceResultsForTimestamp = sourceResults.filter(
          (result) => result.timestamp === element.timestamp
        );
        const source = {};
        for (let i = 0; i < sourceResultsForTimestamp.length; i++) {
          const sourceName = sourceResultsForTimestamp[i]._field.replace(
            "value-",
            ""
          );
          source[sourceName] = Number(sourceResultsForTimestamp[i]._value);
        }
        return {
          symbol: element.dataFeedId,
          provider: providerDetails.address,
          value: Number(element._value),
          source: source,
          timestamp: Number(element.timestamp),
          providerPublicKey: providerDetails.publicKey,
          permawebTx: "mock-permaweb-tx",
          version: "0.3",
        };
      });
    console.log("Executed single token with toTimestamp");
    return res.json(mappedResults);
  }

  async function handleByInfluxWithManyTokens(
    res,
    params,
    dataServiceId,
    providerDetails
  ) {
    let tokens = [];
    if (params.symbols !== undefined) {
      tokens = params.symbols.split(",");
    }

    console.log("Executing for many tokens");
    const stop =
      sanitize(params.toTimestamp) !== undefined
        ? Math.floor(params.toTimestamp / 1000)
        : Math.ceil(Date.now() / 1000);
    const start = stop - 2 * 60;
    tokens.forEach((token) => validatePareter(token));
    console.log(
      `Start: ${start} stop ${stop}, tokens: ${JSON.stringify(tokens)}`
    );
    const request = `
            from(bucket: "redstone")
            |> range(start: ${start}, stop: ${stop})
            |> filter(fn: (r) => r._measurement == "dataPackages")
            |> filter(fn: (r) => r.dataServiceId == "${validatePareter(
              dataServiceId
            )}")
            |> filter(fn: (r) => contains(value: r.dataFeedId, set: ${JSON.stringify(
              tokens
            )}))
            |> keep(columns: ["_time", "_value", "_field", "dataFeedId", "dataServiceId"])
            |> map(fn: (r) => ({ r with timestamp: int(v: r._time) / 1000000 }))
            |> sort(columns: ["_time"], desc: true)
          `;
    const results = await requestInflux(request);
    const sourceResults = results.filter(
      (element) =>
        element._field !== "value" && element._field !== "metadataValue"
    );
    const response = {};
    results
      .filter((element) => element._field === "value")
      .forEach((element) => {
        const timestampsForDataFeedId = [
          ...new Set(
            results
              .filter((result) => result.dataFeedId == element.dataFeedId)
              .map((result) => result.timestamp)
          ),
        ];
        timestampsForDataFeedId.sort();
        if (
          Number(
            timestampsForDataFeedId[timestampsForDataFeedId.length - 1]
          ) === Number(element.timestamp)
        ) {
          console.log("Filling timestamp");
          const sourceResultsForTimestamp = sourceResults.filter(
            (result) =>
              result.timestamp === element.timestamp &&
              result.dataFeedId === element.dataFeedId
          );
          const source = {};
          for (let i = 0; i < sourceResultsForTimestamp.length; i++) {
            const sourceName = sourceResultsForTimestamp[i]._field.replace(
              "value-",
              ""
            );
            source[sourceName] = Number(sourceResultsForTimestamp[i]._value);
          }
          response[element.dataFeedId] = {
            symbol: element.dataFeedId,
            provider: providerDetails.address,
            value: Number(element._value),
            source: source,
            timestamp: Number(element.timestamp),
            providerPublicKey: providerDetails.publicKey,
            permawebTx: "mock-permaweb-tx",
            version: "0.3",
          };
        }
      });
    console.log("Executed for many tokens");
    return res.json(response);
  }

  function getDateTimeString(timestamp) {
    const date = new Date(timestamp).toLocaleDateString("pl-PL");
    const time = new Date(timestamp).toLocaleTimeString("pl-PL");
    return `${date} ${time}`;
  }

  function isOldDataRequest(params) {
    const now = Date.now();
    const days30Ago = Date.now() - 30 * 24 * 60 * 60 * 1000;
    console.log(
      `DEBUG ${params.fromTimestamp} ${days30Ago} ${params.fromTimestamp}`
    );
    if (sanitize(params.fromTimestamp) && days30Ago > Number(params.fromTimestamp)) {
      console.log(
        `isOldDataRequest with fromTimestamp: ${getDateTimeString(
          days30Ago
        )} > ${getDateTimeString(Number(params.fromTimestamp))}`
      );
      return true;
    } else {
      const toTimestamp = sanitize(params.toTimestamp)
        ? Number(params.toTimestamp)
        : Date.now();
      const limit = params.limit !== undefined ? Number(params.limit) : 1;
      const offset = params.offset !== undefined ? Number(params.offset) : 0;
      const goBackInTime = (limit + offset) * 60 * 1000;
      const fromTimestamp = toTimestamp - goBackInTime;
      const result = days30Ago > fromTimestamp;
      console.log(
        `isOldDataRequest no from result: ${result} toTimestamp: ${getDateTimeString(
          toTimestamp
        )} limit: ${params.limit} offset: ${
          params.offset
        } goBackInTime: ${goBackInTime} fromTimestamp: ${getDateTimeString(
          fromTimestamp
        )}`
      );
      return result;
    }
  }

  router.get(
    "/prices",
    asyncHandler(async (req, res) => {
      console.log(`Query: ${JSON.stringify(req.query)}`);
      const params = req.query as unknown as QueryParams;
      const dataServiceId = getDataServiceId(req.query.provider as string);
      getIp(req);
      if (!sanitize(params.fromTimestamp) && !sanitize(params.toTimestamp) && !params.limit) {
        return handleByOracleGateway(req, res, dataServiceId, params);
      }

      // Getting provider details
      const providerDetails = await getProviderFromParams(params);
      params.provider = providerDetails.address;
      params.providerPublicKey = providerDetails.publicKey;

      // If query params contain "symbol" we fetch price for this symbol
      if (params.symbol !== undefined) {
        if (params.interval !== undefined) {
          if (
            shouldRunTestFeature(process.env.TEST_SYMBOL_INTERVAL_PERCENT) &&
            isOldDataRequest(params)
          ) {
            console.log(
              `Running TEST_SYMBOL_INTERVAL_PERCENT: ${JSON.stringify(
                req.query
              )}`
            );
            return handleByInfluxWithSymbolAndInterval(
              res,
              params,
              dataServiceId,
              providerDetails
            );
          }
          return res.json(await getPricesInTimeRangeForSingleToken(params));
        } else if (sanitize(params.toTimestamp) !== undefined) {
          if (
            shouldRunTestFeature(
              process.env.TEST_SYMBOL_NO_INTERVAL_TO_TIMESTAMP_PERCENT
            ) &&
            isOldDataRequest(params)
          ) {
            console.log(
              `Running TEST_SYMBOL_NO_INTERVAL_TO_TIMESTAMP_PERCENT: ${JSON.stringify(
                req.query
              )}`
            );
            return handleByInfluxWithSymbolAndNoInterval(
              res,
              params,
              providerDetails,
              dataServiceId
            );
          } else {
            return res.json(await getHistoricalPricesForSingleToken(params));
          }
        } else {
          if (
            shouldRunTestFeature(
              process.env.TEST_SYMBOL_NO_INTERVAL_NO_TO_TIMESTAMP_PERCENT
            ) &&
            isOldDataRequest(params)
          ) {
            console.log(
              `Running TEST_SYMBOL_NO_INTERVAL_NO_TO_TIMESTAMP_PERCENT: ${JSON.stringify(
                req.query
              )}`
            );
            return handleByInfluxWithSymbolAndNoInterval(
              res,
              params,
              providerDetails,
              dataServiceId
            );
          } else {
            return res.json(await getLatestPricesForSingleToken(params));
          }
        }
      } else {
        if (
          shouldRunTestFeature(process.env.TEST_MANY_SYMBOLS_PERCENT) &&
          isOldDataRequest(params)
        ) {
          console.log(
            `Running TEST_MANY_SYMBOLS_PERCENT: ${JSON.stringify(req.query)}`
          );
          return handleByInfluxWithManyTokens(
            res,
            params,
            dataServiceId,
            providerDetails
          );
        } else {
          let tokens = [];
          if (params.symbols !== undefined) {
            tokens = params.symbols.split(",");
          }
          params.tokens = tokens;

          return res.json(await getPriceForManyTokens(params));
        }
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
