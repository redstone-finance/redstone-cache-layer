import request from "supertest";
import _ from "lodash";
import sleep from "sleep-promise";
import { app } from "../../app";
import uuid from "uuid-random";
import { connect, closeDatabase } from "../helpers/test-db";
import { getProviders } from "../../providers";
import {sanitize} from "../../routes/prices";

const provider = getProviderForTests();

jest.mock("../../helpers/signature-verifier");

describe("Testing prices route", () => {
  beforeAll(async () => await connect());
  afterAll(async () => await closeDatabase());

  test("Should post and get a single price", async () => {
    // Posting a price
    const price = getMockPriceData();

    const postResponse = await request(app)
      .post("/prices")
      .send(price)
      .expect(200);

    expect(postResponse.body).toHaveProperty("msg", "Prices saved. count: 1");

    const fetchResponse = await request(app)
      .get("/prices")
      .query({
        symbol: price.symbol,
        provider: provider.name,
        limit: 1,
      })
      .expect(200);

    const fetchedPrice = fetchResponse.body[0];
    expect(fetchedPrice).toBeDefined();
    const propsToCheck = [
      "id",
      "symbol",
      "provider",
      "value",
      "signature",
      "permawebTx",
      "version",
      "timestamp",
    ];
    for (const prop of propsToCheck) {
      expect(fetchedPrice).toHaveProperty(prop, price[prop]);
    }
    expect(fetchedPrice).toHaveProperty(
      "source.test",
      price.source.test);
    expect(fetchedPrice).toHaveProperty(
      "providerPublicKey",
      provider.publicKey);
  });

  test("Should post and get several prices for the same token", async () => {
    const prices = [], pricesCount = 4, priceIds = [];

    // Create sequential prices with at least 1s delta between their timestamps
    for (let i = 0; i < pricesCount; i++) {
      const price = getMockPriceData();
      prices.push(price);
      priceIds.push(price.id);
      await sleep(1000);
    }

    // Posting several prices for the same token
    const postResponse = await request(app)
      .post("/prices")
      .send(prices)
      .expect(200);
    expect(postResponse.body).toHaveProperty(
      "msg",
      `Prices saved. count: ${pricesCount}`);

    // Fetching latest test prices (up to 200)
    const fetchResponse = await request(app)
      .get("/prices")
      .query({
        symbol: prices[0].symbol,
        provider: provider.name,
        limit: 200,
      })
      .expect(200);
    expect(fetchResponse.body).toBeDefined();
    const fetchedAndPostedPricesIntersection = fetchResponse.body.filter(p => {
      return priceIds.includes(p.id);
    });
    expect(fetchedAndPostedPricesIntersection.length).toBe(pricesCount);

    // Fetching prices in range
    const pricesInRangeResponse = await request(app)
      .get("/prices")
      .query({
        symbol: prices[0].symbol,
        provider: provider.name,
        fromTimestamp: prices[0].timestamp,
        toTimestamp: prices[1].timestamp,
        interval: 1, // 1 ms, because we don't want to skip any prices
      });
    expect(pricesInRangeResponse.body).toBeDefined();
    expect(pricesInRangeResponse.body.length).toBe(2);

    // Fetching prices with offset and limit
    const pricesWithOffsetAndLimitResponse = await request(app)
      .get("/prices")
      .query({
        symbol: prices[0].symbol,
        provider: provider.name,
        limit: 2,
        offset: 2,
      })
      .expect(200);
    expect(pricesWithOffsetAndLimitResponse.body).toBeDefined();
    expect(pricesWithOffsetAndLimitResponse.body.length).toBe(2);
    expect(pricesWithOffsetAndLimitResponse.body[0].id).toBe(prices[1].id);
    expect(pricesWithOffsetAndLimitResponse.body[1].id).toBe(prices[0].id);

    // Fetching historica price
    const historicalPriceResponse = await request(app)
      .get("/prices")
      .query({
        symbol: prices[0].symbol,
        provider: provider.name,
        toTimestamp: prices[2].timestamp,
      })
    expect(historicalPriceResponse.body).toBeDefined();
    expect(historicalPriceResponse.body.length).toBe(1);
    expect(historicalPriceResponse.body[0].id).toBe(prices[2].id);
  });

  test("Should post and get price for several tokens", async () => {
    const prices = [], pricesCount = 3, timestamp = Date.now();

    // Create prices with the same timestamp but different symbols
    for (let counter = 0; counter < pricesCount; counter++) {
      const price = getMockPriceData({
        timestamp,
        symbol: `TEST-${counter}`,
      });
      prices.push(price);
    }
    
    // Posting several prices for several tokens
    const postResponse = await request(app)
      .post("/prices")
      .send(prices)
      .expect(200);
    expect(postResponse.body).toHaveProperty(
      "msg",
      `Prices saved. count: ${pricesCount}`);

    // Fetching prices for several tokens
    const fetchResponse = await request(app)
      .get("/prices")
      .query({
        provider: provider.name,
        symbols: prices.map(p => p.symbol).join(","),
      })
      .expect(200);
    expect(_.keys(fetchResponse.body).length).toBe(pricesCount);
    for (const price of prices) {
      expect(fetchResponse.body[price.symbol]).toBeDefined();
      expect(fetchResponse.body[price.symbol]).toHaveProperty("id", price.id);
    }

    // Fetching historical prices for several tokens
    const historicalPricesResponse = await request(app)
      .get("/prices")
      .query({
        provider: provider.name,
        symbols: prices.map(p => p.symbol).join(","),
        toTimestamp: prices[0].timestamp,
      })
      .expect(200);
    expect(_.keys(historicalPricesResponse.body).length).toBe(pricesCount);
  });
});

describe("Testing EVM signature", () => {
  beforeEach(async () => {
    await connect();
    // TODO: put intial data to DB
  });
  afterEach(async () => await closeDatabase());

  test("Should post and get a price without EVM signature", async () => {
    const price = getMockPriceData();

    const postResponse = await request(app)
      .post("/prices")
      .send([price])
      .expect(200);

    expect(postResponse.body).toHaveProperty("msg", "Prices saved. count: 1");

    const getResponse = await request(app)
      .get("/prices")
      .query({
        symbol: price.symbol,
        provider: provider.name,
        limit: 1,
      });

    expect(getResponse).toHaveProperty("body");
    expect(getResponse.body.length).toBe(1);
    expect(getResponse.body[0]).toHaveProperty("signature", "dGVzdC1zaWduYXR1cmU=");
    expect(getResponse.body[0]).not.toHaveProperty("evmSignature");
  });

  test("Should post and get a price with EVM signature", async () => {
    const price = getMockPriceData();
    const priceWithEvmSignature = Object.assign(price, {
      evmSignature: "dGVzdC1ldm0tc2lnbmF0dXJl"
    }); // "test-evm-signature" in base64

    const postResponse = await request(app)
      .post("/prices")
      .send([priceWithEvmSignature])
      .expect(200);

    expect(postResponse.body).toHaveProperty("msg", "Prices saved. count: 1");

    const getResponse = await request(app)
      .get("/prices")
      .query({
        symbol: priceWithEvmSignature.symbol,
        provider: priceWithEvmSignature.provider,
        limit: 1,
      });

    expect(getResponse).toHaveProperty("body");
    expect(getResponse.body.length).toBe(1);
    expect(getResponse.body[0]).toHaveProperty("signature");
    expect(getResponse.body[0]).toHaveProperty("evmSignature", priceWithEvmSignature.evmSignature);
  });

  test("Test sanitizing timestamp", () => {
    expect(sanitize(undefined)).toBeUndefined();
    expect(sanitize("undefined")).toBeUndefined();
    expect(sanitize(123)).toBe(123);
  });
});

function getProviderForTests() {
  const name = "redstone";
  return {
    ...getProviders()[name],
    name,
  };
}

function getMockPriceData(price = {}) {
  const priceData = {
    id: uuid(),
    symbol: "test-symbol",
    provider: provider.address,
    value: Number((Math.random() * 100).toFixed(3)),
    permawebTx: "test-permaweb-tx",
    signature: "dGVzdC1zaWduYXR1cmU=",
    version: "0.4",
    source: {"test": 123},
    timestamp: Date.now(),
    ...price,
  };

  return priceData;
}
