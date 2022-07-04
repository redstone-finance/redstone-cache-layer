import mongoose, { mongo } from "mongoose";
const Schema = mongoose.Schema;

export interface IDataPoint {
  symbol: string;
  value: any;
}

export interface Package {
  timestamp: number;
  signature?: string;
  liteSignature?: string;
  provider: string;
  signer: string;
  prices: IDataPoint[];
}

const DataPointSchema = new Schema<IDataPoint>({
  symbol: {
    type: String,
    required: true,
  },
  value: {
    type: Schema.Types.Mixed,
    required: true,
  },
});

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
    type: [DataPointSchema],
    required: true,
  },
});

export const Package = mongoose.model("Package", PackageSchema);
