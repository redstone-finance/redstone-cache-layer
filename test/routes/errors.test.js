const request = require("supertest");
const app = require("../../app");
const testDB = require("../test-db");

describe("Testing errors route", () => {
  beforeAll(async () => await testDB.connect());
  afterAll(async () => await testDB.closeDatabase());

  const testError = {
    error: "test-error",
    errorTitle: "test-error-title",
  };

  test("Error route should be accessible", async () => {
    await request(app)
      .post("/errors")
      .send(testError)
      .expect(200);
  });
});
