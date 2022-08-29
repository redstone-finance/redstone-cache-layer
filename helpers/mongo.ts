import mongoose, {ConnectOptions, FilterQuery, Model} from "mongoose";
import { MongoMemoryServer } from 'mongodb-memory-server';
import { logger } from "./logger";

const MAX_COLLECTION_SIZE_TO_CLEAN = 5000;

export const tryCleanCollection = async (model: Model<any>, query: FilterQuery<any>) => {
  const collectionSize = await model.countDocuments(query).exec();
  if (collectionSize > MAX_COLLECTION_SIZE_TO_CLEAN) {
    logger.warn('Unsafe collection cleaning skipped: '
      + JSON.stringify({collectionSize, MAX_COLLECTION_SIZE_TO_CLEAN}));
  } else {
    logger.info(
      `Cleaning collection: ${model.collection.collectionName}. `
      + `Query: ${JSON.stringify(query)}. Items to be removed: ${collectionSize}`);
    await model.deleteMany(query);
  }
}

export const connectToRemoteMongo = async (url: string, options?: ConnectOptions) => {
  await mongoose.connect(url, options);
  logger.info("Connected to mongoDB");
}

export const connectToMongoMemoryServer = async () => {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri);
}
