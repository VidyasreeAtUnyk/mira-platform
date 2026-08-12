import type { Test } from "./testHelpers";
import { closeTestDb } from "./testHelpers";
import { stageMachineTests } from "./stage-machine.test";
import { transactionsTests } from "./transactions.test";
import { listingsTests } from "./listings.test";

const allTests: Test[] = [...stageMachineTests, ...transactionsTests, ...listingsTests];

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
