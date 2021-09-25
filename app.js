const express = require("express");
const cors = require("cors");
const errorhandler = require("errorhandler");
const { getRouter } = require("./routes");
const logger = require("./helpers/logger");

const app = express();

// This allows to get request ip address from req.ip
app.set("trust proxy", true);

app.use(cors());
app.use(express.json({ limit: "20mb", extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use("/", getRouter(express));
app.use(errorhandler({ log: errorNotification }));

function errorNotification(err, str, req) {
  const title = `Error in ${req.method} ${req.url}`;
  logger.error(title, str, err.stack);
}

module.exports = app;
