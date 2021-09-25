const providers = require("redstone-node/dist/src/config/providers.json");

function getProviders() {
  return providers;
}

function getPublicKeyForProviderAddress(address) {
  for (const providerName in providers) {
    const details = providers[providerName];
    if (details.address === address) {
      return details.publicKey;
    }
  }
  // throw new Error(`Public key not found for provider address: ${address}`);
  return "";
}

module.exports = {
  getProviders,
  getPublicKeyForProviderAddress,
};
