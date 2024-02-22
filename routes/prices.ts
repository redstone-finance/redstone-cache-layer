import { Request, Router } from "express";
import asyncHandler from "express-async-handler";
import { getDataServiceId } from "../providers";
import { Price } from "../models/price";
import { getProviderFromParams } from "../utils";
import { logger } from "../helpers/logger";
import { requestDataPackages, fetchDataPackages } from "@redstone-finance/sdk";
import axios from "axios";
import csvToJSON from "csv-file-to-json";
import { String } from "aws-sdk/clients/cloudsearch";

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
      params.fromTimestamp === undefined ||
      params.toTimestamp === undefined
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
    const stop = params.toTimestamp
      ? Math.floor(params.toTimestamp / 1000)
      : Math.ceil(Date.now() / 1000);
    const searchWindow = Math.max(limit + offset, 3);
    const start =
      params.fromTimestamp !== undefined
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
      params.toTimestamp !== undefined
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

  router.get(
    "/prices",
    asyncHandler(async (req, res) => {
      console.log(`Query: ${JSON.stringify(req.query)}`);
      const params = req.query as unknown as QueryParams;
      const dataServiceId = getDataServiceId(req.query.provider as string);
      getIp(req);
      if (!params.fromTimestamp && !params.toTimestamp && !params.limit) {
        return handleByOracleGateway(req, res, dataServiceId, params);
      }

      // Getting provider details
      const providerDetails = await getProviderFromParams(params);
      params.provider = providerDetails.address;
      params.providerPublicKey = providerDetails.publicKey;

      // If query params contain "symbol" we fetch price for this symbol
      if (params.symbol !== undefined) {
        if (params.interval !== undefined) {
            return handleByInfluxWithSymbolAndInterval(
              res,
              params,
              dataServiceId,
              providerDetails
            );
        } else if (params.toTimestamp !== undefined) {
            return handleByInfluxWithSymbolAndNoInterval(
              res,
              params,
              providerDetails,
              dataServiceId
            );
        } else {
            return handleByInfluxWithSymbolAndNoInterval(
              res,
              params,
              providerDetails,
              dataServiceId
            );
        }
      } else {
          return handleByInfluxWithManyTokens(
            res,
            params,
            dataServiceId,
            providerDetails
          );
      }
    })
  );
};
