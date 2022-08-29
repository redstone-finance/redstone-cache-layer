import awsServerlessExpress from "aws-serverless-express";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import {enableLiteMode, dbUrl, defaultLocalPort, dbUsername, dbPassword} from "./config";
import { app } from "./app";
import { logger } from "./helpers/logger";
import {
  connectToMongoMemoryServer,
  connectToRemoteMongo,
} from "./helpers/mongo";
import {ConnectOptions} from 'mongoose';

// Connecting to mongoDB
if (enableLiteMode) {
  logger.info("Connecting to in-memory mongo");
  connectToMongoMemoryServer();
} else {
  const options: ConnectOptions = {};
  logger.info("Connecting to remote mongo server");
  if (dbUsername) {
    logger.info("Using MongoDB username&password authorization");
    options.user = dbUsername;
    options.pass = dbPassword;
  }
  connectToRemoteMongo(dbUrl, options);
}

// Exporting method for docker container for AWS lambda
const server = awsServerlessExpress.createServer(app);
export const handler = (event: APIGatewayProxyEvent, context: Context) =>
  awsServerlessExpress.proxy(server, event, context);

// Method for locals server execution
export const runLocalServer = () => {
  const port = defaultLocalPort;
  app.listen(port, () => {
    logger.info(`Express api listening at http://localhost:${port}`);
  });
};
