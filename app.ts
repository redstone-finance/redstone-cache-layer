import express, { Request } from "express";
import cors from "cors";
import errorhandler from "errorhandler";
import { getRouter } from "./routes";
import { logger } from "./helpers/logger";

export const app = express();

// This allows to get request ip address from req.ip
app.set("trust proxy", true);

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/", getRouter());

const errorNotification = (error: Error, string: string, request: Request) => {
  const title = `Error in ${request.method} ${request.url}`;
  logger.error(title, string, error.stack);
}

app.use(errorhandler({ log: errorNotification }));
