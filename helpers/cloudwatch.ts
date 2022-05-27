import AWS from "aws-sdk";
import { logger } from "../helpers/logger";
import { isProduction } from "../config";

export const saveMetric = async ({ label, value }) => {
  if (isProduction) {
    const cloudwatch = new AWS.CloudWatch({apiVersion: "2010-08-01"});

    const metricParams = {
      MetricData: [{
        MetricName: label,
        Value: value,
      }],
      Namespace: "CustomPerformanceMetrics",
    };

    await cloudwatch.putMetricData(metricParams).promise();
  } else {
    logger.info(
      "Metric saving in AWS cloudwatch skipped in non-prod environment");
  }
};
