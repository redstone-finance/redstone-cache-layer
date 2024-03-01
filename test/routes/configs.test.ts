import request from "supertest";
import { app } from "../../app";

describe("Testing configs route", () => {
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
