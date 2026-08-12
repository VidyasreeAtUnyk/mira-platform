import type { Test } from "./testHelpers.js";
import { closeTestDb } from "./testHelpers.js";
import { csvTests } from "./csv.test.js";
import { mouTests } from "./mou.test.js";
import { matchingTests } from "./matching.test.js";

const allTests: Test[] = [...csvTests, ...mouTests, ...matchingTests];

async function main() {
  let failures = 0;
  for (const test of allTests) {
    try {
      await test.run();
      console.log(`PASS  ${test.name}`);
    } catch (e) {
      failures += 1;
      console.log(`FAIL  ${test.name}`);
      console.error(`      ${(e as Error).message}`);
    }
  }
  console.log(`\n${allTests.length - failures}/${allTests.length} unit tests passed.`);
  await closeTestDb();
  if (failures > 0) process.exit(1);
}

main();
