import dotenv from "dotenv";
dotenv.config();

const getEnv = (name: string, defaultValue: any) => {
  return process.env[name] || defaultValue;
};

const getMode = () => {
  return getEnv("MODE", "LOCAL");
};

const isProd = () => {
  return getMode() === "PROD";
};

const isTest = process.env.NODE_ENV === "test";

const enableLiteMode = getEnv("LIGHT_MODE", false) === "true";
const dbUrls = {
  local: "mongodb://localhost:27017/redstone",
  prod: "",
};

if (!enableLiteMode && !isTest) {
  dbUrls["prod"] = process.env.MONGO_DB_URL;
}

function getDbUrl() {
  if (getMode() === "LOCAL") {
    return dbUrls.local;
  } else {
    return dbUrls.prod;
  }
}

const cacheTTLMilliseconds = !isTest ? 3 * 60 * 1000 : 0; // 3 minutes
const dbUrl = getDbUrl();
const bigLimitWithMargin = 1200;
const defaultLimit = 1;
const defaultLocalPort = 9000;
const awsSesRegion = "eu-north-1";
const isProduction = isProd();
const maxLimitForPrices = 3000;
const enableAmplitudeLogging = getEnv("ENABLE_AMPLITUDE_LOGGING", false);

export {
  enableLiteMode,
  dbUrl,
  bigLimitWithMargin,
  defaultLimit,
  defaultLocalPort,
  awsSesRegion,
  isProduction,
  maxLimitForPrices,
  enableAmplitudeLogging,
  cacheTTLMilliseconds,
};
