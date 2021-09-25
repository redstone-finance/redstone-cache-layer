const prices = require("./prices");
const packages = require("./packages");
const metrics = require("./metrics");
const errors = require("./errors");
const configs = require("./configs");
const providers = require("./providers");

module.exports.getRouter = (express) => {
  const router = express.Router();

  prices(router);
  packages(router);
  metrics(router);
  errors(router);
  configs(router);
  providers(router);

  return router;
};
