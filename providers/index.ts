import providers from "redstone-node/dist/src/config/providers.json";

export const getProviders = () => {
  return providers;
}

export const getPublicKeyForProviderAddress = (address: string) => {
  const details = findProviderDetailsByAddress(address);
  return details.publicKey;
}

export const getEvmAddressForProviderAddress = (address: string) => {
  const details = findProviderDetailsByAddress(address);
  return details.evmAddress;
}

export const findProviderDetailsByAddress = (address: string) => {
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
