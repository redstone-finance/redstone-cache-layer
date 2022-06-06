process.env.LIGHT_MODE = "false";
import request from "supertest";
import { app } from "../../app";
import { connect, closeDatabase } from "../helpers/test-db";

describe("Testing errors route", () => {
  beforeAll(async () => await connect());
  afterAll(async () => await closeDatabase());

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
