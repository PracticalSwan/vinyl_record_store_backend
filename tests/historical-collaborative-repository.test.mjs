import assert from "node:assert/strict";
import test from "node:test";
import { createHistoricalCollaborativeRepository } from "../src/repositories/historicalCollaborativeRepository.js";

function queryResult(rows, capture) {
  return {
    select(value) {
      capture.select = value;
      return this;
    },
    lean() {
      return this;
    },
    async exec() {
      return rows;
    },
  };
}

test("historical collaborative evidence uses train and validation only and returns aggregate item evidence", async () => {
  const findCalls = [];
  let supportPipeline;
  let connected = 0;
  const model = {
    aggregate(pipeline) {
      supportPipeline = pipeline;
      return {
        exec: async () => [
          { productPublicId: 1, positiveUserCount: 2 },
          { productPublicId: 2, positiveUserCount: 2 },
          { productPublicId: 3, positiveUserCount: 1 },
        ],
      };
    },
    find(filter) {
      const capture = { filter, select: null };
      findCalls.push(capture);
      if (findCalls.length === 1) {
        return queryResult([
          { userKey: "a", productPublicId: 1 },
          { userKey: "b", productPublicId: 1 },
        ], capture);
      }
      return queryResult([
        { userKey: "a", productPublicId: 1 },
        { userKey: "a", productPublicId: 2 },
        { userKey: "b", productPublicId: 1 },
        { userKey: "b", productPublicId: 2 },
        { userKey: "b", productPublicId: 3 },
      ], capture);
    },
  };
  const repository = createHistoricalCollaborativeRepository(model, async () => { connected += 1; });
  const result = await repository.listItemEvidence("release-v3", [1]);

  assert.equal(connected, 1);
  assert.deepEqual(supportPipeline[0].$match.split, { $in: ["train", "validation"] });
  assert.deepEqual(findCalls[0].filter.split, { $in: ["train", "validation"] });
  assert.deepEqual(findCalls[1].filter.split, { $in: ["train", "validation"] });
  assert.equal(findCalls[0].select, "+userKey productPublicId");
  assert.equal(findCalls[1].select, "+userKey productPublicId");
  assert.deepEqual(result.pairs, [
    { sourceProductPublicId: 1, candidateProductPublicId: 2, coPositiveUsers: 2 },
    { sourceProductPublicId: 1, candidateProductPublicId: 3, coPositiveUsers: 1 },
  ]);
  assert.deepEqual(result.supports, [
    { productPublicId: 1, positiveUserCount: 2 },
    { productPublicId: 2, positiveUserCount: 2 },
    { productPublicId: 3, positiveUserCount: 1 },
  ]);
  assert.equal(JSON.stringify(result).includes("userKey"), false);
  assert.equal(JSON.stringify(result).includes("test"), false);
});

test("empty collaborative anchors do not connect or read historical data", async () => {
  let connected = false;
  const repository = createHistoricalCollaborativeRepository(
    {
      aggregate: () => { throw new Error("must not aggregate"); },
      find: () => { throw new Error("must not find"); },
    },
    async () => { connected = true; },
  );

  assert.deepEqual(await repository.listItemEvidence("release-v3", []), { supports: [], pairs: [] });
  assert.equal(connected, false);
});
