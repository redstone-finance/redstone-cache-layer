const request = require("supertest");
const app = require("../../app");
const testDB = require("../test-db");

const providers = [
  "redstone",
  "redstone-rapid",
  "redstone-stocks",
];

describe("Testing providers route", () => {
  beforeAll(async () => await testDB.connect());
  afterAll(async () => await testDB.closeDatabase());

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
