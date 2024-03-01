import request from "supertest";
import { app } from "../../app";

const providers = [
  "redstone",
  "redstone-rapid",
  "redstone-stocks",
];

describe("Testing providers route", () => {

  test("Should return providers config", async () => {
    const response = await request(app)
      .get("/providers")
      .expect(200);

    for (const provider of providers) {
      expect(response.body).toHaveProperty(provider);
      expect(response.body[provider]).toHaveProperty("address");
      expect(response.body[provider]).toHaveProperty("evmAddress");
      expect(response.body[provider]).toHaveProperty("publicKey");
    }
  });
});
