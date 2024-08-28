import { Request, Router } from "express";
import asyncHandler from "express-async-handler";
import axios from "axios";
import csvToJSON from "csv-file-to-json";
import { validatePareter } from "./common"
import { requestInflux } from "./onChainUpdates"

export const feedsAnswersUpdate = (router: Router) => {
    router.get(
        "/feeds-answers-update",
        asyncHandler(async (req, res) => {
            const adapterName = validatePareter(req.query.adapterName as string);
            const request = `
            from(bucket: "redstone-transactions")
            |> range(start: -1m)
            |> filter(fn: (r) =>
                r._measurement == "redstoneTransactions" and
                r.adapterName == "${adapterName}" and
                r._field =~ /value-.*$/
            )
            |> group(columns: ["_field"])
            |> last()
            |> keep(columns: ["_time", "_value", "_field"])
        `;

            const influxResponse = await requestInflux(request)
            const mappedResponse = influxResponse.map(relayerData => {
                return {
                    feedId: relayerData._value.replace("value", ""),
                    value: relayerData._value,
                    timestamp: relayerData._time,
                }
            })

            return res.json(mappedResponse);

        })
    );

}