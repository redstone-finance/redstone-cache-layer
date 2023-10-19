import { Price } from "../models/price";
import mongoose from "mongoose";

// USAGE: yarn run-ts scripts/wait-for-data-packages.ts <expected-count> <data-feed-id>

// Note! This script is used only in monorepo integration tests

const INTERVAL_MILLISECONDS = 5000; // 5 seconds
const DATA_FEED_ID = process.argv[3];
const EXPECTED_COUNT = parseInt(process.argv[2]);
const MONGO_DB_URL = process.argv[4];

main();

async function main() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGO_DB_URL);
  console.log("MongoDB connected");

  await checkDataPackagesCount();
  setInterval(checkDataPackagesCount, INTERVAL_MILLISECONDS);
}

async function checkDataPackagesCount() {
  const dataPackagesCount = await queryDataPackages(DATA_FEED_ID);
  console.log(`Fetched data packages count: ${dataPackagesCount}`);
  if (dataPackagesCount >= EXPECTED_COUNT) {
    console.log(
      `Expected data packages count reached: ${EXPECTED_COUNT}. Stopping...`
    );
    process.exit();
  }
}

async function queryDataPackages(dataFeedId: string) {
  const dataPackages = await Price.find({ "symbol": dataFeedId });
  return dataPackages.length;
}
