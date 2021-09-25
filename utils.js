const { getProviders } = require("./providers");

function priceParamsToPriceObj(price) {
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

function getMinutesFromTimestamp(timestamp) {
  return new Date(timestamp).getMinutes();
}

async function getProviderFromParams(params) {
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


function formatDate(date) {
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

module.exports = {
  formatDate,
  getProviderFromParams,
  priceParamsToPriceObj,
};
