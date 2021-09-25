const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PackageSchema = new Schema({
  timestamp: {
    type: Number,
    required: true,
  },
  signature: {
    type: String,
    required: true,
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
    required: true,
  },
});

module.exports = mongoose.model("Package", PackageSchema);
