const tokens = require("redstone-node/dist/src/config/tokens.json");

module.exports = (router) => {

  /**
   * This endpoint is used for returning tokens config file
   * This endpoint creation was requested by JF#1885 on Discord
  */
  router.get("/configs/tokens", (req, res) => {
    res.json(tokens);
  });
};
