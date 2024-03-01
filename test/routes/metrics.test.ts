process.env.LIGHT_MODE = "false";
import request from "supertest";
import { app } from "../../app";
import * as cloudwatch from "../../helpers/cloudwatch";

describe("Testing metrics route", () => {

  const testMetricValue = {
    label: "test-metric",
    value: 42,
  };

  test("Should post a test metric", async () => {
    // Given
    const spy = jest.spyOn(cloudwatch, "saveMetric");

    // When
    await request(app)
      .post("/metrics")
      .send(testMetricValue)
      .expect(200);

    // Then
    expect(spy).toHaveBeenCalledWith(testMetricValue);
  });
});
