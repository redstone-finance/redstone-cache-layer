const providers = require("redstone-node/dist/src/config/providers.json");

function getProviders() {
  return providers;
}

function getPublicKeyForProviderAddress(address) {
  const details = findProviderDetailsByAddress(address);
  return details.publicKey;
}

function getEvmAddressForProviderAddress(address) {
  const details = findProviderDetailsByAddress(address);
  return details.evmAddress;
}

function findProviderDetailsByAddress(address) {
  for (const providerName in providers) {
    const details = providers[providerName];
    if (details.address === address) {
      return details;
    }
  }
  // TODO: maybe uncomment
  // throw new Error(`Public key not found for provider address: ${address}`);
  return {};
}


module.exports = {
  getProviders,
  getPublicKeyForProviderAddress,
  getEvmAddressForProviderAddress,
};
