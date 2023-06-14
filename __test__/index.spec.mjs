import test from "ava";

import {
  sum,
  concatStr,
  getOptions,
  asyncFib,
  callThreadsafeFunction,
} from "../index.js";

test("sum from native", (t) => {
  t.is(sum(1, 2), 3);
});

test("concatStr from native", (t) => {
  t.is(concatStr("Hello", "World"), "HelloWorld");
});

test("getOptions from native", (t) => {
  const options = {
    id: 1,
    name: "napi-rs",
  };
  t.deepEqual(getOptions(options), options);
});

test("asyncFib from native", async (t) => {
  t.is(await asyncFib(10), 55);
});

test("callThreadsafeFunction from native", async (t) => {
  t.is(
    callThreadsafeFunction((err, ...args) => {
      console.log("Get the result from rust", args);
    })
  );
});
