const _ = require("lodash");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { getPublicKeyForProviderAddress } = require("../providers");

const PriceSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  symbol: {
    type: String,
    required: true,
  },
  provider: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    required: true,
  },
  signature: {
    type: Buffer,
    required: false, // It's not required for new data points, because we got rid fo Arweave signatures
  },
  evmSignature: {
    type: Buffer,
    required: false,
  },
  liteEvmSignature: {
    type: Buffer,
    required: false,
  },
  permawebTx: {
    type: String,
    required: true,
  },
  version: {
    type: String,
    required: true,
  },
  source: {
    type: Object,
    required: true,
  },
  timestamp: {
    type: Number,
    required: true,
  },
  minutes: {
    type: Number,
    required: false,
  },
});


PriceSchema.statics.toObj = function(price) {
  let result = price;
  if (result.toObject !== undefined) {
    result = result.toObject();
  }

  result.providerPublicKey = getPublicKeyForProviderAddress(result.provider);

  return _.omit(result, ["__v", "_id"]);
};

module.exports = mongoose.model("Price", PriceSchema);
