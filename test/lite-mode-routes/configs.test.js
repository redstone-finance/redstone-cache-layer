const request = require("supertest");
const app = require("../../app");
const testDB = require("../test-db");

jest.mock("../../config", () => require("../helpers/lite-mode-config"));

describe("Testing configs route", () => {
  beforeAll(async () => await testDB.connect());
  afterAll(async () => await testDB.closeDatabase());

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
