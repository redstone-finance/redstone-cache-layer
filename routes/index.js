const prices = require("./prices");
const packages = require("./packages");
const metrics = require("./metrics");
const errors = require("./errors");
const configs = require("./configs");
const providers = require("./providers");
const config = require("../config");

module.exports.getRouter = (express) => {
  const router = express.Router();

  prices(router);
  packages(router);
  configs(router);
  providers(router);

  if (!config.enableLightMode) {
    metrics(router);
    errors(router);
  }

  return router;
};
