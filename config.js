const cacheTTLMilliseconds = 3 * 60 * 1000; // 3 minutes
const enableLiteMode = !!getEnv("LIGHT_MODE", false);
const dbUrls = {
  local: "mongodb://localhost:27017/redstone",
};

if (!enableLiteMode) {
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
  enableLiteMode,
  dbUrl: getDbUrl(),
  bigLimitWithMargin: 1200,
  defaultLimit: 1,
  defaultLocalPort: 9000,
  awsSesRegion: "eu-north-1",
  enableJsonLogs: isProd(),
  maxLimitForPrices: 3000,
  enableAmplitudeLogging: getEnv("ENABLE_AMPLITUDE_LOGGING", false),
  isProd,
  cacheTTLMilliseconds,
};
