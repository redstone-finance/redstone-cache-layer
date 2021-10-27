
const enableLightMode = !!getEnv("LIGHT_MODE", false);
const dbUrls = {
  local: "mongodb://localhost:27017/redstone",
};

if (!enableLightMode) {
  const secrets = require("./.secrets.json");
  dbUrls["prod"] = secrets.dbUrl;
}

function getDbUrl() {
  if (getMode() === "LOCAL") {
    return dbUrls.local;
  } else {
    return dbUrls.prod;
  }
}

function getEnv(name, defaultValue) {
  return process.env[name] || defaultValue;
}

function getMode() {
  return getEnv("MODE", "LOCAL");
}

function isProd() {
  return getMode() === "PROD";
}

module.exports = {
  enableLightMode,
  dbUrl: getDbUrl(),
  bigLimitWithMargin: 1200,
  defaultLimit: 1,
  defaultLocalPort: 9000,
  awsSesRegion: "eu-north-1",
  enableJsonLogs: isProd(),
  maxLimitForPrices: 3000,
  isProd,
};
