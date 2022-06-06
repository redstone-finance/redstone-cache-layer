import _ from "lodash";
import mongoose, { Document, Schema } from "mongoose";
import { getPublicKeyForProviderAddress } from "../providers";

export interface Price {
  id: string;
  symbol: string;
  provider: string;
  value: number;
  signature?: Buffer;
  evmSignature?: Buffer;
  liteEvmSignature?: Buffer;
  permawebTx: string;
  version: string;
  source: object;
  timestamp: number;
  minutes?: number;
}

export const PriceSchema = new Schema<Price>({
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

export const priceToObject = (price: Document<unknown, any, Price> & Price) => {
  let result = price;
  if (result.toObject !== undefined) {
    result = result.toObject();
  }

  const providerPublicKey = { providerPublicKey: getPublicKeyForProviderAddress(result.provider) }
  const resultWithPublicKey = Object.assign(result, providerPublicKey);

  return _.omit(resultWithPublicKey, ["__v", "_id"]);
}

export const Price = mongoose.model("Price", PriceSchema);
