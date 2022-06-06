import { getProviders } from "./providers";
import { PriceWithParams } from "./routes/prices";

export const priceParamsToPriceObj = (price: PriceWithParams) => {
  const priceObj = {
    ...price,
    minutes: getMinutesFromTimestamp(price.timestamp),
  };

  for (const signatureProp of ["signature", "evmSignature", "liteEvmSignature"]) {
    if (price[signatureProp]) {
      priceObj[signatureProp] = Buffer.from(price[signatureProp], "base64");
    }
  }

  return priceObj;
}

export const getMinutesFromTimestamp = (timestamp: number) => {
  return new Date(timestamp).getMinutes();
}

export const getProviderFromParams = async (params: { provider: string; }) => {
  // TODO: load this mapping directly from arweave
  // TODO: we also can implement caching
  const providers = getProviders();

  if (providers[params.provider]) {
    return providers[params.provider];
  } else {
    return {
      address: params.provider,
      publicKey: ""
    };

    // TODO: alex@redstone.finance disabled error throwing here
    // to allow external providers use redstone-api
    
    // throw new Error(
    //   `Provider details not found for: "${params.provider}". `
    //   + `Params: ${JSON.stringify(params)}`);
  }
}


export const formatDate = (date: number) => {
  const d = new Date(Number(date));
  const year = String(d.getFullYear());
  let month = String((d.getMonth() + 1));
  let day = String(d.getDate());

  if (month.length < 2) {
    month = '0' + month;
  }
  if (day.length < 2) {
    day = '0' + day;
  }

  return `${year}-${month}-${day}`;
}
