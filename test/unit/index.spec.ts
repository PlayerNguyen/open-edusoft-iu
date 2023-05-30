import { describe } from "mocha";
import { Authentication } from "../../src";
import { expect } from "chai";

describe("[unit]", () => {
  it(`should sign in successfully `, () => {
    const authentication = new Authentication();
    return expect(
      authentication.use(
        process.env.TEST_EDUSOFT_STUDENT_ID as unknown as string,
        process.env.TEST_EDUSOFT_STUDENT_PASSWORD as unknown as string
      )
    ).to.be.fulfilled;
  });

  it(`should reject sign in when input invalid credential`, () => {
    const authentication = new Authentication();
    return expect(authentication.use("abc", "xyz")).to.rejectedWith(
      Error,
      /Invalid username or password/
    );
  });
});
