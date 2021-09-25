const AWS = require("aws-sdk");
const logger = require("../helpers/logger");
const { isProd } = require("../config");

module.exports.saveMetric = async ({ label, value }) => {
  if (isProd()) {
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
