import { Request, Router } from "express";
import asyncHandler from "express-async-handler";
import axios from "axios";
import csvToJSON from "csv-file-to-json";

async function requestInflux(query: String) {
  const config = {
    headers: {
      Authorization: `Token ${process.env.INFLUXDB_TOKEN}`,
      "Content-Type": "application/vnd.flux",
    },
  };
  try {
    const result = await axios.post(
      `${process.env.INFLUXDB_URL}/api/v2/query?org=redstone`,
      query,
      config
    );
    const json = csvToJSON({ data: result.data });
    return json;
  } catch (error) {
    console.error(error);
    throw new Error("Request to influxdb failed");
  }
}

export const onChainUpdates = (router: Router) => {
    router.get(
        "/on-chain-updates",
        asyncHandler(async (req, res) => {

        const dataFeedId = "BTC"
        const adapterName = "bnbBtc"

        const request = `
            from(bucket: "redstone-transactions")
            |> range(start: -7d)
            |> filter(fn: (r) =>
                r._measurement == "redstoneTransactions" and
                r._field == "value-${dataFeedId}" and
                r.adapterName == "${adapterName}"
            )
            |> keep(columns: ["_time", "_value", "value-${dataFeedId}", "_field", "sender"])
          `;

            const influxResponse = await requestInflux(request)

            return res.json({ onChainUpdates: influxResponse });
         
        })
    );
    
}