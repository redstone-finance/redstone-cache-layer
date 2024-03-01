import awsServerlessExpress from "aws-serverless-express";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { defaultLocalPort } from "./config";
import { app } from "./app";
import { logger } from "./helpers/logger";

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
