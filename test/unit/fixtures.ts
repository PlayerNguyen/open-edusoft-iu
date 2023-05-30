import { use } from "chai";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

export async function mochaGlobalSetup() {
  console.log(`Loading configuration before testing...`);
  use(chaiAsPromised);

  console.log(`Chai v. ${chai.version}`);
}

export async function mochaGlobalTeardown() {}
