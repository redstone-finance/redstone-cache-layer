const secrets = require("./.secrets.json");

const dbUrls = {
  prod: secrets.dbUrl,
  local: "mongodb://localhost:27017/redstone",
};

function getDbUrl() {
  if (getMode() === "LOCAL") {
    return dbUrls.local;
  } else {
    return dbUrls.prod;
  }
}

function getMode() {
  if (process.env.MODE) {
    return process.env.MODE;
  } else {
    return "LOCAL";
  }
}

function isProd() {
  return getMode() === "PROD";
}

module.exports = {
  dbUrl: getDbUrl(),
  bigLimitWithMargin: 1200,
  defaultLimit: 1,
  defaultLocalPort: 9000,
  awsSesRegion: "eu-north-1",
  enableJsonLogs: isProd(),
  maxLimitForPrices: 3000,
  isProd,
};
