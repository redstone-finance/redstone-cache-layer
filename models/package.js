const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PackageSchema = new Schema({
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
    type: Array,
    required: true,
  },
});

module.exports = mongoose.model("Package", PackageSchema);
