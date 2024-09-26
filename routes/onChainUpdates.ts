import { Router } from "express";
import asyncHandler from "express-async-handler";
import axios from "axios";
import csvToJSON from "csv-file-to-json";
import { validateParameter } from "./common";

export async function requestInflux(query: string) {
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
      const dataFeedId = validateParameter(req.query.dataFeedId as string);
      const adapterName = validateParameter(req.query.adapterName as string);
      const daysRange = validateParameter(req.query.daysRange as string);

      const request = `
                from(bucket: "redstone-transactions")
                |> range(start: -${daysRange}d)
                |> filter(fn: (r) =>
                    r._measurement == "redstoneTransactions" and
                    r._field == "value-${dataFeedId}" and
                    r.adapterName == "${adapterName}"
                )
                |> keep(columns: ["_time", "_value", "sender"])
            `;

      const influxResponse = await requestInflux(request);
      const mappedResponse = influxResponse.map((dataPoint) => {
        return {
          timestamp: new Date(dataPoint._time).getTime(),
          value: dataPoint._value,
          sender: dataPoint.sender,
        };
      });

      res.json({ onChainUpdates: mappedResponse });
    })
  );
};
