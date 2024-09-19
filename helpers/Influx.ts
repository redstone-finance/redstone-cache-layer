import {
  InfluxDB,
  Point,
  WritePrecisionType,
} from "@influxdata/influxdb-client";
import { RedstoneCommon, loggerFactory } from "@redstone-finance/utils";
const logger = loggerFactory("helpers/InfluxService");

export interface InfluxConstructorAuthParams {
  url: string;
  token: string;
}

type InfluxConnectionInfo = {
  url: string;
  org: string;
  bucket: string;
  precision: string;
};

interface InfluxAuthParams extends InfluxConnectionInfo {
  token: string;
  precision: WritePrecisionType;
}

export interface IInfluxService {
  queueOnePoint(point: Point): void;
  sendOnePoint(point: Point): Promise<void>;
  sendQueuedPoints(): Promise<void>;
}

export class InfluxService implements IInfluxService {
  private influx: InfluxDB;
  private authParams: InfluxAuthParams;
  private points: Point[] = [];

  private static parseInfluxUrl(influxUrl: string): InfluxConnectionInfo {
    const parsedUrl = new URL(influxUrl);
    const pathNameWithoutInfluxApi = parsedUrl.pathname.replace(
      "/api/v2/write",
      ""
    );
    return {
      url: `${parsedUrl.protocol}//${parsedUrl.host}${pathNameWithoutInfluxApi}`,
      org: parsedUrl.searchParams.get("org") || "",
      bucket: parsedUrl.searchParams.get("bucket") || "",
      precision: parsedUrl.searchParams.get("precision") || "ms",
    };
  }

  constructor(constructorAuthParams: InfluxConstructorAuthParams) {
    const connectionInfo = InfluxService.parseInfluxUrl(
      constructorAuthParams.url
    );
    this.authParams = {
      ...connectionInfo,
      token: constructorAuthParams.token,
      precision: connectionInfo.precision as WritePrecisionType,
    };

    this.influx = new InfluxDB({
      url: this.authParams.url,
      token: this.authParams.token,
    });

    const originalSend = this.influx.transport.send.bind(this.influx.transport);

    this.influx.transport.send = (path, body, options, callbacks) => {
      if (!options.headers) options.headers = {};
      options.headers["x-api-key"] = this.authParams.token; // add additional header in case we send request to API Gateway proxy
      return originalSend(path, body, options, callbacks);
    };
  }

  private getWriteApi() {
    return this.influx.getWriteApi(
      this.authParams.org,
      this.authParams.bucket,
      this.authParams.precision
    );
  }

  queueOnePoint(point: Point) {
    this.points.push(point);
  }

  async sendOnePoint(point: Point) {
    this.points.push(point);
    await this.sendQueuedPoints();
  }

  async sendQueuedPoints() {
    logger.info(`Sending batch with ${this.points.length} points`);

    const writeApi = this.getWriteApi();
    writeApi.writePoints(this.points);
    this.points = [];

    try {
      await writeApi.close();
      logger.info(`Points sent`);
    } catch (error) {
      logger.error(
        `Failed saving points: ${RedstoneCommon.stringifyError(error)}`
      );
    }
  }
}

class MockInfluxService implements IInfluxService {
  // eslint-disable-next-line
  queueOnePoint(_point: Point) {}

  // eslint-disable-next-line
  async sendOnePoint(_point: Point) {}

  // eslint-disable-next-line
  async sendQueuedPoints() {}
}

let influxServiceInstance:
  | InfluxService
  | MockInfluxService
  | undefined;