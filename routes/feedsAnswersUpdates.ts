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
            const request = `
            from(bucket: "redstone-transactions")
            |> range(start: -24h)
            |> filter(fn: (r) =>
                r._measurement == "redstoneTransactions" and
                r._field =~ /value-.*$/
            )
            |> group(columns: ["adapterName", "_field"])
            |> last()
            |> keep(columns: ["_time", "_value", "adapterName", "_field"])
        `;

            const influxResponse = await requestInflux(request)
            const mapInfluxResponse = () => {
                const result = {};

                influxResponse.forEach(item => {
                    const adapterName = item.adapterName;
                    if (!adapterName || adapterName === 'undefined') {
                        return;
                    }
                    const feedId = item._field.replace('value-', '');
                    const timestamp = item._time;
                    const value = item._value;

                    if (!result[adapterName]) {
                        result[adapterName] = {};
                    }

                    result[adapterName][feedId] = {
                        timestamp,
                        value
                    };
                });

                return result;
            };

            return res.json(mapInfluxResponse());

        })
    );

}