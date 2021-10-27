const awsServerlessExpress = require("aws-serverless-express");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const config = require("./config");
const app = require("./app");
const logger = require("./helpers/logger");

const argv = yargs(hideBin(process.argv)).argv;

// Connecting to mongoDB
if (config.enableLightMode) {
  connectToMongoMemoryServer();
} else {
  connectToRemoteMongo(argv.db || config.dbUrl);
}

// Exporting method for docker container for AWS lambda
const server = awsServerlessExpress.createServer(app);
exports.handler = (event, context) =>
  awsServerlessExpress.proxy(server, event, context);

// Method for locals server execution
exports.runLocalServer = () => {
  const port = argv.port || config.defaultLocalPort;
  app.listen(port, () => {
    logger.info(`Express api listening at http://localhost:${port}`);
  });
};
