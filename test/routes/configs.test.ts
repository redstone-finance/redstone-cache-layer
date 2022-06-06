import request from "supertest";
import { app } from "../../app";
import { connect, closeDatabase } from "../helpers/test-db";

describe("Testing configs route", () => {
  beforeAll(async () => await connect());
  afterAll(async () => await closeDatabase());

  test("Should return tokens config", async () => {
    const response = await request(app)
      .get("/configs/tokens")
      .expect(200);

    for (const symbol of ["BTC", "ETH", "LINK", "AR"]) {
      expect(response.body).toHaveProperty(symbol);
      expect(response.body[symbol]).toHaveProperty("name");
      expect(response.body[symbol]).toHaveProperty("logoURI");
    }
  });
});
