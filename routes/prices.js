const asyncHandler = require("express-async-handler");
const _ = require("lodash");

const config = require("../config");
const Price = require("../models/price");
const { logEvent } = require("../helpers/amplitude-event-logger");
const { assertValidSignature } = require("../helpers/signature-verifier");
const { priceParamsToPriceObj, getProviderFromParams } = require("../utils");
const logger = require("../helpers/logger");
const { tryCleanCollection } = require("../helpers/mongo");

async function addSinglePrice(params) {
  const price = new Price(priceParamsToPriceObj(params));
  await price.save();
}

async function getLatestPricesForSingleToken(params) {
  validateParams(params, ["symbol"]);
  const prices = await getPrices({
    filters: {
      symbol: params.symbol,
      provider: params.provider,
    },
    limit: params.limit,
    offset: params.offset,
  });
  return prices.map(Price.toObj);
}

async function addSeveralPrices(params) {
  const ops = [];
  for (const price of params) {
    ops.push({
      insertOne: {
        document: priceParamsToPriceObj(price),
      },
    });
  }
  await Price.bulkWrite(ops);
}

async function getPriceForManyTokens(params) {
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
    limit: config.bigLimitWithMargin,
  });

  // Building tokens object
  const tokensResponse = {};
  for (const price of prices) {

    // We currently filter here
    if (tokens.length === 0 || tokens.includes(price.symbol)) {
      if (tokensResponse[price.symbol] === undefined) {
        tokensResponse[price.symbol] = Price.toObj(price);
      } else {
        if (tokensResponse[price.symbol].timestamp < price.timestamp) {
          tokensResponse[price.symbol] = Price.toObj(price);
        }
      }
    }
  }

  return tokensResponse;
}

async function getHistoricalPricesForSingleToken(params) {
  validateParams(params, ["symbol"]);
  const filters = {
    symbol: params.symbol,
    provider: params.provider,
    timestamp: { $lte: params.toTimestamp },
  };

  if (params.fromTimestamp) {
    filters.timestamp.$gte = params.fromTimestamp;
  }

  const prices = await getPrices({
    filters,
    offset: Number(params.offset || 0),
    limit: params.limit || config.defaultLimit,
  });
  return prices.map(Price.toObj);
}

// This function is used to return data for charts
async function getPricesInTimeRangeForSingleToken(params) {
  validateParams(params,
    ["symbol", "fromTimestamp", "toTimestamp", "interval", "provider"]);
  const { symbol, provider, fromTimestamp, toTimestamp, interval, offset, limit } = params;
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
  ];

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
  let prices = fetchedPrices.map(Price.toObj);

  // TODO: sorting may be moved to aggregation pipeline later
  // it caused performance problems, that's why now we do it here
  prices.sort((p1, p2) => p1.timestamp - p2.timestamp);

  // This is a hack
  // We make the additional filtering here because some
  // providers (rapid, stocks) post several prices per minute
  // so we can not filter them out in DB query level
  const millisecondsInMinute = 60 * 1000;
  if (interval > millisecondsInMinute && prices.length > 0) {
    let filteredPrices = [], prevTimestamp = prices[0].timestamp;
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
}

async function getPrices({
  filters = {},
  limit = config.defaultLimit,
  offset,
}) {
  // Query building
  let pricesQuery = Price
    .find(filters)
    .sort({ timestamp: -1 })
    .limit(Math.min(Number(limit), config.maxLimitForPrices));
  if (offset) {
    pricesQuery = pricesQuery.skip(Number(offset));
  }
  
  // Query executing
  const prices = await pricesQuery.exec();

  return prices;
}

function validateParams(params, requiredParams) {
  const errors = [];
  for (const requiredParam of requiredParams) {
    if (params[requiredParam] === undefined) {
      errors.push(`Param ${requiredParam} is required`);
    }
  }

  if (errors.length > 0) {
    throw new Error(JSON.stringify(errors));
  }
}

function getPricesCount(reqBody) {
  if (Array.isArray(reqBody)) {
    return reqBody.length;
  } else {
    return 1;
  }
}

function getIp(req) {
  const ip = req.ip;
  logger.info("Request IP address: " + ip);
  return ip;
}

module.exports = (router) => {
  /**
   * This endpoint is used for fetching prices data.
   * It is used in redstone-api
  */
  router.get("/prices", asyncHandler(async (req, res) => {
    // Request validation
    const params = req.query;

    // Saving API read event in amplitude
    logEvent({
      eventName: "api-get-request",
      eventProps: params,
      ip: getIp(req),
    });

    // Getting provider details
    const providerDetails = await getProviderFromParams(params);
    params.provider = providerDetails.address;
    params.providerPublicKey = providerDetails.publicKey;

    // If query params contain "symbol" we fetch price for this symbol
    if (params.symbol !== undefined) {
      if (params.interval !== undefined) {
        body = await getPricesInTimeRangeForSingleToken(params);
      } else if (params.toTimestamp !== undefined) {
        body = await getHistoricalPricesForSingleToken(params);
      } else {
        body = await getLatestPricesForSingleToken(params);
      }
    }
    // Otherwise we fetch prices for many symbols
    else {
      let tokens = [];
      if (params.symbols !== undefined) {
        tokens = params.symbols.split(",");
      }
      params.tokens = tokens;

      body = await getPriceForManyTokens(params);
    }

    return res.json(body);
  }));

  /**
   * This endpoint is used for posting a new price data.
   * It supports posting a single price and several prices
  */
  router.post("/prices", asyncHandler(async (req, res) => {
    const reqBody = req.body;
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
      const invalidPrices = reqBody.filter(p => !p.value);
      if (invalidPrices.length > 0) {
        logger.error(
          "Invalid prices with empty value: " + JSON.stringify(invalidPrices));
      }

      // Validating a signature of a randomly selected price
      // We got rid of arweave signatures
      // const priceToVerify = _.sample(reqBody);
      // await assertValidSignature(priceToVerify);

      // Adding several prices
      await addSeveralPrices(reqBody);

      // Cleaning older prices for the same provider after posting
      // new ones in the lite mode
      if (config.enableLiteMode) {
        await tryCleanCollection(Price, {
          provider: reqBody[0].provider,
          timestamp: { $lt: Number(reqBody[0].timestamp) - config.cacheTTLMilliseconds },
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
      if (config.enableLiteMode) {
        await tryCleanCollection(Price, {
          provider: reqBody.provider,
          symbol: reqBody.symbol,
          timestamp: { $lt: Number(reqBody.timestamp) - config.cacheTTLMilliseconds },
        });
      }
    }

    return res.json({ msg: `Prices saved. count: ${pricesSavedCount}` });
  }));
};
