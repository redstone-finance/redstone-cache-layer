const request = require("supertest");
const app = require("../../app");
const testDB = require("../test-db");
const cloudwatch = require("../../helpers/cloudwatch");

describe("Testing metrics route", () => {
  beforeAll(async () => await testDB.connect());
  afterAll(async () => await testDB.closeDatabase());

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
