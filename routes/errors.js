const asyncHandler = require("express-async-handler");
const logger = require("../helpers/logger");
// const { sendEmail } = require("../helpers/mail-sender");

module.exports = (router) => {

  /**
   * This endpoint is used for error saving
   * Currently it just logs the error to console
  */
  router.post("/errors", asyncHandler(async (req, res) => {
    logger.info("New error reported", req.body);

    // TODO: uncomment and configure SES
    // Sending an email using AWS SES
    // const { error, errorTitle } = req.body;
    // await sendEmail({
    //   to: "dev@redstone.finance",
    //   subject: `New error occured (${errorTitle})`,
    //   text: error,
    // });

    return res.json({
      msg: "Error reported",
    });
  }));
};
