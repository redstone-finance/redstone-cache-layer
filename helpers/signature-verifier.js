const _ = require("lodash");
const Arweave = require("arweave/node");
const deepSortObject = require("deep-sort-object");
const Price = require("../models/price");
const { getPublicKeyForProviderAddress } = require("../providers");
const logger = require("./logger");

async function assertValidSignature(price, skipNewerPricesCheck = true) {
  if (!skipNewerPricesCheck) {
    // Checking if price with a greater timestamp is already in DB
    // If so, then we raise an Error, because we allow to publish
    // only the latest prices
    const newerPriceFound = await Price.findOne({
      symbol: price.symbol,
      provider: price.provider,
      timestamp: { $gte: price.timestamp },
    });
    if (newerPriceFound) {
      throw new Error(
        `A newer price found in DB. `
        + `Newer price: ${JSON.stringify(newerPriceFound)}. `
        + `Failed price: ${JSON.stringify(price)}.`);
    }
  } else {
    logger.info("Newer prices check skipped");
  }

  // Signature verification
  const isValid = await verifySignature(price);
  if (!isValid) {
    throw new Error(
      "Price signature is invalid: " + JSON.stringify(price));
  }
}

async function verifySignature(price) {
  // Time measurement: start
  const startTime = Date.now();

  // Data preparation
  const publicKey = getPublicKeyForProviderAddress(price.provider);
  const signedData = getPriceSignedData(price);
  const signedBytes = new TextEncoder().encode(signedData);
  const signatureBytes = Uint8Array.from(Buffer.from(price.signature, "base64"));

  // It allows other providers (not registered in our api) post their data here
  // In future, we should implement some kind of authorization for this kind of providers
  if (!publicKey) {
    return true;
  }

  const dataPrepTime = Date.now() - startTime;
  logger.info(
    `Data prep time elapsed: ${dataPrepTime} ms`);

  // Signature verification
  const validSignature = await Arweave.crypto.verify(
    publicKey,
    signedBytes,
    signatureBytes,
  );

  // Time measurement: end
  const signVerificationTime = Date.now() - startTime;
  logger.info(
    `Signature verification time elapsed: ${signVerificationTime} ms`);

  return validSignature;
}

function getPriceSignedData(price) {
  const priceWithPickedProps = _.pick(price, [
    "id",
    "source",
    "symbol",
    "timestamp",
    "version",
    "value",
    "permawebTx",
    "provider",
  ]);


  if (shouldApplyDeepSort(price)) {
    return JSON.stringify(deepSortObject(priceWithPickedProps));
  } else {
    return JSON.stringify(priceWithPickedProps);
  }
}

function shouldApplyDeepSort(price) {
  return price.version && (price.version === "3" || price.version.includes("."));
}

module.exports = {
  assertValidSignature,
};
