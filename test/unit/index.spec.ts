import { Authentication } from "./../../src/index";
import { describe } from "mocha";

import { expect } from "chai";
import moment from "moment";

const createAuthentication = () => {
  const authentication = new Authentication();
  return authentication.use(
    process.env.TEST_EDUSOFT_STUDENT_ID as unknown as string,
    process.env.TEST_EDUSOFT_STUDENT_PASSWORD as unknown as string
  );
};

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

  describe("[schedule]", () => {
    it(`should update last update from schedule`, async () => {
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
      )
        .to.be.gt(0)
        .and.lt(moment.now());
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

    it(`should have a latest semester from action`, () => {
      return expect(
        createAuthentication().then(async (action) => {
          return (await action.getSchedule()).getLastSemester();
        })
      ).to.eventually.not.be.undefined;
    });
  });
});
