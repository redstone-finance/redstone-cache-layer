import awsServerlessExpress from "aws-serverless-express";
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { enableLiteMode, dbUrl, defaultLocalPort } from "./config";
import { app } from "./app";
import { logger } from "./helpers/logger";
import { connectToMongoMemoryServer, connectToRemoteMongo } from "./helpers/mongo";

const argv = yargs(hideBin(process.argv)).argv;

// Connecting to mongoDB
if (enableLiteMode) {
  connectToMongoMemoryServer();
} else {
  connectToRemoteMongo(argv["db"] || dbUrl);
}

// Exporting method for docker container for AWS lambda
const server = awsServerlessExpress.createServer(app);
exports.handler = (event: APIGatewayProxyEvent, context: Context) =>
  awsServerlessExpress.proxy(server, event, context);

// Method for locals server execution
exports.runLocalServer = () => {
  const port = argv["port"] || defaultLocalPort;
  app.listen(port, () => {
    logger.info(`Express api listening at http://localhost:${port}`);
  });
};
