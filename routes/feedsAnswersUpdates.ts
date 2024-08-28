import { Request, Router } from "express";
import asyncHandler from "express-async-handler";
import axios from "axios";
import csvToJSON from "csv-file-to-json";
import { validatePareter } from "./common"

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

export const feedsAnswersUpdate = (router: Router) => {
    router.get(
        "/feeds-answers-update",
        asyncHandler(async (req, res) => {
            const adapterName = validatePareter(req.query.adapterName as string);
            const request = `
            from(bucket: "redstone-transactions")
            |> range(start: -1000y)
            |> filter(fn: (r) =>
                r._measurement == "redstoneTransactions" and
                r.adapterName == "${adapterName}" and
                r._field =~ /value-.*$/
            )
            |> group(columns: ["_field"])
            |> last()
        `;

            const influxResponse = await requestInflux(request)
            const mappedResponse = influxResponse.map(dataPoint => {
                return {
                    timestamp: new Date(dataPoint._time).getTime(),
                    value: dataPoint._value,
                    sender: dataPoint.sender,
                }
            })

            return res.json(influxResponse);

        })
    );

}