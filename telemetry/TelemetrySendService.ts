import {
  InfluxDB,
  Point,
  WritePrecisionType,
} from "@influxdata/influxdb-client";
import { RedstoneCommon, loggerFactory } from "@redstone-finance/utils";
import { config } from "../config";
const logger = loggerFactory("telemetry/TelemetrySendService");

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

export interface ITelemetrySendService {
  queueToSendMetric(point: Point): void;

  sendMetricsBatch(): Promise<void>;
}

export class TelemetrySendService implements ITelemetrySendService {
  private influx: InfluxDB;
  private authParams: InfluxAuthParams;
  private metrics: Point[] = [];

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
    const connectionInfo = TelemetrySendService.parseInfluxUrl(
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

  queueToSendMetric(point: Point) {
    this.metrics.push(point);
  }

  async sendMetricsBatch() {
    logger.info(`Sending batch with ${this.metrics.length} metrics`);

    const writeApi = this.getWriteApi();
    writeApi.writePoints(this.metrics);
    this.metrics = [];

    try {
      await writeApi.close();
      logger.info(`Metrics sent`);
    } catch (error) {
      logger.error(
        `Failed saving metric: ${RedstoneCommon.stringifyError(error)}`
      );
    }
  }
}

class MockTelemetrySendService implements ITelemetrySendService {
  // eslint-disable-next-line
  queueToSendMetric(_point: Point) {}

  // eslint-disable-next-line
  async sendMetricsBatch() {}
}

let telemetrySendServiceInstance:
  | TelemetrySendService
  | MockTelemetrySendService
  | undefined;

export function isTelemetryEnabled() {
  return !!(config.telemetryUrl && config.telemetryAuthorizationToken);
}

export function getTelemetrySendService():
  | TelemetrySendService
  | MockTelemetrySendService {
  if (!telemetrySendServiceInstance) {
    if (!isTelemetryEnabled()) {
      telemetrySendServiceInstance = new MockTelemetrySendService();
    } else {
      telemetrySendServiceInstance = new TelemetrySendService({
        url: config.telemetryUrl!,
        token: config.telemetryAuthorizationToken!,
      });
    }
  }
  return telemetrySendServiceInstance;
}
