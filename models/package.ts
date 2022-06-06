import mongoose from "mongoose";
import { Price, PriceSchema } from "./price";
const Schema = mongoose.Schema;

export interface Package {
  timestamp: number;
  signature?: string;
  liteSignature?: string;
  provider: string;
  signer: string;
  prices: Price[];
}

const PackageSchema = new Schema<Package>({
  timestamp: {
    type: Number,
    required: true,
  },
  signature: {
    type: String,
    required: false, // It's not required for new data points, because we got rid fo Arweave signatures
  },
  liteSignature: {
    type: String,
    required: false,
  },
  provider: {
    type: String,
    required: true,
  },
  signer: {
    type: String,
    required: false,
  },
  prices: {
    type: [PriceSchema],
    required: true,
  },
});

export const Package = mongoose.model("Package", PackageSchema);
