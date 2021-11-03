const request = require("supertest");
const _ = require("lodash");
const sleep = require("sleep-promise");
const app = require("../../app");
const uuid = require("uuid-random");
const testDB = require("../test-db");
const { getProviders } = require("../../providers");
const Price = require("../../models/price");

jest.mock("../../config", () => require("../helpers/lite-mode-config"));

const provider = getProviderForTests();

jest.mock("../../helpers/signature-verifier");

describe("Testing prices route", () => {
  beforeAll(async () => await testDB.connect());
  afterAll(async () => await testDB.closeDatabase());

  test("Should post and get a single price", async () => {
    // Posting a price
    const price = getMockPriceData();
    const postCount = 10;

    for (let i = 0; i < postCount; i++) {
      const postResponse = await request(app)
        .post("/prices")
        .send({ ...price, timestamp: price.timestamp + i })
        .expect(200);
      expect(postResponse.body).toHaveProperty("msg", "Prices saved. count: 1");
      const pricesCountInDB = await Price.countDocuments().exec();
      expect(pricesCountInDB).toBe(1);
    }
    

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
    ];
    for (const prop of propsToCheck) {
      expect(fetchedPrice).toHaveProperty(prop, price[prop]);
    }
    expect(fetchedPrice).toHaveProperty("timestamp", price.timestamp + (postCount - 1));
    expect(fetchedPrice).toHaveProperty(
      "source.test",
      price.source.test);
    expect(fetchedPrice).toHaveProperty(
      "providerPublicKey",
      provider.publicKey);
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

    const postCount = 5;
    
    // Posting several prices for several tokens
    for (let i = 0; i < postCount; i++) {
      const pricesToPost = prices.map(p => ({...p, timestamp: p.timestamp + i}));
      const postResponse = await request(app)
        .post("/prices")
        .send(pricesToPost)
        .expect(200);
      expect(postResponse.body).toHaveProperty(
        "msg",
        `Prices saved. count: ${pricesCount}`);
      const pricesCountInDB = await Price.countDocuments({}).exec();
      expect(pricesCountInDB).toBe(pricesCount);
    }
    

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
        toTimestamp: prices[0].timestamp + (postCount - 1),
      })
      .expect(200);
    expect(_.keys(historicalPricesResponse.body).length).toBe(pricesCount);
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
