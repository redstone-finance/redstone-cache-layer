import request from "supertest";
import _ from "lodash";
import { app } from "../../app";
import { connect, closeDatabase } from "../helpers/test-db";
import { Price } from "../../models/price";
import { Package } from "../../models/package";
import { getProviders } from "../../providers";

const provider = getProviderForTests();

describe("Testing packages route", () => {
  beforeEach(async () => await connect());
  afterEach(async () => await closeDatabase());

  const testTimestamp = Date.now();
  const arweaveSignature = "dGVzdC1zaWduYXR1cmU="; // test-signature in Base64
  const evmSignature = "dGVzdC1ldm0tc2lnbmF0dXJl"; // test-evm-signature in Base64
  const liteEvmSignature = "dGVzdC1saXRlLWV2bS1zaWduYXR1cmU="; // test-lite-evm-signature in Base64
  const testPackage = {
    timestamp: testTimestamp,
    signature: "test-signature",
    liteSignature: "test-signature",
    signer: "test-signer",
    provider: provider.address,
  };

  const testPrice = {
    id: "test-id",
    symbol: "test-symbol",
    provider: provider.address,
    value: Number((Math.random() * 100).toFixed(3)),
    permawebTx: "test-permaweb-tx",
    signature: Buffer.from(arweaveSignature, "base64"),
    evmSignature: Buffer.from(evmSignature, "base64"),
    liteEvmSignature: Buffer.from(liteEvmSignature, "base64"),
    version: "0.4",
    source: {"test": 123},
    timestamp: testTimestamp,
  };

  test("Should post a package and fetch it", async () => {
    const postCount = 10;

    for (let i = 0; i < postCount; i++) {
      await request(app)
        .post("/packages")
        .send({...testPackage, timestamp: testPackage.timestamp + i})
        .expect(200);
      const packagesCountInDB = await Package.countDocuments().exec();
      expect(packagesCountInDB).toBe(1);
    }
    

    const response = await request(app)
      .get(`/packages/latest?provider=${provider.name}`)
      .expect(200);

    expect(response.body).toEqual({
      ...testPackage,
      timestamp: testPackage.timestamp + (postCount - 1),
      prices: [],
    });
  });

  test("Should get package for single price", async () => {
    // Given
    await new Price({
      ...testPrice,
    }).save();
    await new Package(testPackage).save();

    // When
    const response = await request(app)
      .get("/packages/latest")
      .query({
        provider: provider.name,
        symbol: testPrice.symbol,
      });

    // Then
    expect(response.body).toEqual({
      ...testPackage,
      signer: "0x926E370fD53c23f8B71ad2B3217b227E41A92b12",
      signature: evmSignature,
      liteSignature: liteEvmSignature,
      prices: [_.pick(testPrice, ["value", "symbol"])],
    });
  });
});

function getProviderForTests() {
  const name = "redstone-stocks";
  return {
    ...getProviders()[name],
    name,
  };
}
