import { Authentication } from "./../../src/index";
import { describe } from "mocha";

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

  it(`should get last update schedule`, async () => {
    expect(
      (
        await (
          await new Authentication().use(
            process.env.TEST_EDUSOFT_STUDENT_ID as unknown as string,
            process.env.TEST_EDUSOFT_STUDENT_PASSWORD as unknown as string
          )
        ).getSchedule()
      )
        .getLastUpdate()
        .unix()
    ).to.be.gt(0);
  });

  it(`should return list of weeks`, async () => {
    return expect(
      (
        await (
          await new Authentication().use(
            process.env.TEST_EDUSOFT_STUDENT_ID as unknown as string,
            process.env.TEST_EDUSOFT_STUDENT_PASSWORD as unknown as string
          )
        ).getSchedule()
      )
        .getLastSemester()
        .getWeeks()
    ).to.eventually.lengthOf.greaterThan(0);
  });
});
