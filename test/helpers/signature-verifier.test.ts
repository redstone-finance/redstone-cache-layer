import Arweave from "arweave";
import deepSortObject from "deep-sort-object";
import { assertValidSignature } from "../../helpers/signature-verifier";
import testJwk from "./test-jwk.json";

const mockProviders = {
  redstone: {
    address: "MlV6DeOtRmakDOf6vgOBlif795tcWimgyPsYYNQ8q1Y",
    publicKey:
      "zhTx5Kr9VNQrXGarf0EXySfbSePBbIQuSOpb07s3pM3q8HKCx-bbd_py8t-JxgwnKAmpGKt6UhOP0FeobGITCwr_O7ATFPrFgTbM-xLYG0JOzxUlPScyqdJ8rFRcSSpevfUyJ6UVTpA3LDQHEzf7kebjfMPeYwpsWuT3c9LP3j0kyPDOBini-LRUpKX3n4ljhJIHzl-Jdv6Z31U65kZRBR1LPwnjcBUg4hoc50i8JZsSLsrUYFfpYVuxM0L4ch0l2-FvPtmZs831mOQgT8e1s7GPB7kJBhrQBagGF3eVnAiImJjslXNQhy4eQr6Nffb5Wa61Tec52LX5-gmoNSuA0PW5yuYGuDO2faULW74u8ZfmMUxd2x3E3M6E0deP_rj27FUQCECdbO6ATVanA16wnW7MrySu2m-Kt83XyATdVoNDls-coxA4UxuX7Rmlr2eGM7ZRKtypt12GziKnZgNglK5c_4mmMP2xeeLU1fneBLkvuHSEnoFjqZnAaI0ei6pW8Jy3k8txI5MucaRkXdPOhCm3Nwj8B9rBAh0hU64NVVb7C28Gz8LCwZkRhtGRY_v2vzcS0DaomK2G63vyQMKx3VUc9_RnkxcI6bwy6xG2GBEjpV8tHxXgw8zGc53_8EMo-9EM1PpjOHHYyaYoubDbxHaSJPwCPqi_OlGbl2h8gIM",
  },
};
jest.mock("../../providers/index", () => ({
  getProviders: () => mockProviders,
  getPublicKeyForProviderAddress: (address) => {
    if (address !== mockProviders.redstone.address) {
      throw new Error(
        "Mock getPublicKeyForProviderAddress should not be " +
          "called with this address: " +
          address
      );
    } else {
      return mockProviders.redstone.publicKey;
    }
  },
}));

async function getSignature(price) {
  const priceWithSortedProps = deepSortObject(price);
  const priceStringified = JSON.stringify(priceWithSortedProps);

  const dataToSign = new TextEncoder().encode(priceStringified);
  const signature = await Arweave.crypto.sign(testJwk, dataToSign);
  const buffer = Buffer.from(signature);

  return buffer.toString("base64");
}

describe("Testing signature verifier", () => {
  const initialPriceData = {
    id: "test-id",
    symbol: "test-symbol",
    provider: mockProviders.redstone.address,
    value: Number((Math.random() * 100).toFixed(3)),
    permawebTx: "test-permaweb-tx",
    source: { test: 123 },
    timestamp: Date.now(),
    version: "0.4",
  };

  test("Should verify valid signature", async () => {
    const price = {
      ...initialPriceData,
      signature: await getSignature(initialPriceData),
    };
    const skipLatestPriceCheck = true;
    expect(assertValidSignature(price, skipLatestPriceCheck)).resolves;
  });
});
