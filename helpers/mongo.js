const mongoose = require("mongoose");
const { MongoMemoryServer } = require('mongodb-memory-server');
const logger = require("./logger");

const MAX_COLLECTION_SIZE_TO_CLEAN = 10;

async function tryCleanCollection(model, query) {
  const collectionSize = await model.countDocuments(query).exec();
  if (collectionSize > MAX_COLLECTION_SIZE_TO_CLEAN) {
    logger.warn('Unsafe collection cleaning skipped: '
      + JSON.stringify({collectionSize, MAX_COLLECTION_SIZE_TO_CLEAN}));
  } else {
    logger.info(
      `Cleaning collection: ${model.collection.collectionName}. `
      + `Query: ${JSON.stringify(query)}. Items to be removed: ${collectionSize}`);
    // await model.deleteMany(query);
  }
}

async function connectToRemoteMongo(url) {
  await mongoose.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  }).then("Connected to mongoDB");
}

async function connectToMongoMemoryServer() {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  });
}

module.exports = {
  tryCleanCollection,
  connectToRemoteMongo,
  connectToMongoMemoryServer,
};
