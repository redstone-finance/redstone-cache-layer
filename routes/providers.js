const providers = require("redstone-node/dist/src/config/providers.json");

module.exports = (router) => {

  /**
   * This endpoint is used for returning providers details
  */
  router.get("/providers", (req, res) => {
    res.json(providers);
  });

};
