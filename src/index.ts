import axios from "axios";
import moment, { Moment } from "moment";
import { parse as parseHtml, HTMLElement } from "node-html-parser";

const EDUSOFT_BASE_URL = "https://edusoftweb.hcmiu.edu.vn/";

export const EduSoftAxiosInstance = axios.create({
  baseURL: EDUSOFT_BASE_URL,
});

function preprocessRawHtml(html: string): string {
  const rangeIndex: number[] = [html.indexOf("<body"), html.indexOf("/body>")];
  return html.substring(rangeIndex[0], rangeIndex[1]);
}

interface Session {
  sessionId: string;
  studentId: string;
  studentName: string;
}
export class Authentication {
  private cookieField: string[];
  private session?: Session;

  private async initialize() {
    const firstResponse = await EduSoftAxiosInstance.get("/default.aspx");
    const setCookieField = firstResponse.headers["set-cookie"];
    if (setCookieField === undefined) {
      throw new Error(`Invalid set cookie headers`);
    }

    const aspNetField = setCookieField.find((item) =>
      item.includes("ASP.NET_SessionId")
    );

    if (aspNetField === undefined) {
      throw new Error(`ASP.NET_SessionID not found`);
    }
    this.cookieField = setCookieField;
  }

  public async use(studentId: string, password: string) {
    // Send the first request as GET to get sessionID
    await this.initialize();

    const formData = new FormData();
    formData.append(
      "ctl00$ContentPlaceHolder1$ctl00$ucDangNhap$txtTaiKhoa",
      studentId
    );
    formData.append(
      "ctl00$ContentPlaceHolder1$ctl00$ucDangNhap$txtMatKhau",
      password
    );
    formData.append(
      "ctl00$ContentPlaceHolder1$ctl00$ucDangNhap$btnDangNhap",
      "Đăng Nhập"
    );
    formData.append("__EVENTTARGET", "");
    formData.append("__EVENTARGUMENT", "");

    // Create a request
    const response = await EduSoftAxiosInstance.post(
      "/default.aspx?page=gioithieu",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Cookie: this.cookieField,
        },
      }
    );

    const processedRawHtml = preprocessRawHtml(await response.data);
    if (processedRawHtml.includes("Sai thông tin đăng nhập")) {
      throw new Error(`Invalid username or password.`);
    }

    const html = parseHtml(processedRawHtml);
    const fullNameElement = html.querySelector(
      "#ctl00_Header1_Logout1_lblNguoiDung b font"
    );
    if (fullNameElement === null) {
      throw new Error(`Invalid fullNameElement value`);
    }

    // Separate the `Chao ban xx xxxx xxxxx xxx (stutdentId)`
    // in to xx path only.
    const fullText = fullNameElement.text;
    const fullName = fullText
      .split(" ")
      .filter((_text, _index) => _index >= 2 && _text.charAt(0) !== "(")
      .join(" ")
      .trim();
    const sessionId = this.cookieField
      .filter((value) => value.includes("ASP.NET_SessionId"))[0]
      .split(";")[0]
      .split("=")[1];

    this.session = {
      sessionId,
      studentId,
      studentName: fullName,
    };

    return new EduSoftAction(this);
  }

  public getSession() {
    return this.session;
  }

  public createAxiosInstanceWithCurrentSession() {
    if (this.session === undefined || this.session === null) {
      throw new Error(
        `The authentication has not been initialized. Please login by using #use function before get the instance.`
      );
    }

    return axios.create({
      baseURL: EDUSOFT_BASE_URL,
      headers: {
        Cookie: this.cookieField,
      },
    });
  }
}

export class EduSoftAction {
  private authentication: Authentication;

  constructor(authentication: Authentication) {
    this.authentication = authentication;
  }

  public async getSchedule() {
    const axiosInstance =
      this.authentication.createAxiosInstanceWithCurrentSession();
    const response = await axiosInstance.post(
      "/default.aspx?page=thoikhoabieu&sta=0"
    );

    const htmlBodyElement = parseHtml(preprocessRawHtml(response.data));

    return new Schedule(this.authentication, htmlBodyElement);
  }
}

export class WeekPeriod {
  private weekNumber: number;
  private startDate: Moment;
  private endDate: Moment;

  constructor(weekNumber: number, startDate: Moment, endDate: Moment) {
    this.weekNumber = weekNumber;
    this.startDate = startDate;
    this.endDate = endDate;
  }

  // public get()
}

export class Semester {
  private semester: number;
  private year: number;
  private authentication: Authentication;

  constructor(semester: number, year: number, authentication: Authentication) {
    this.semester = semester;
    this.year = year;
    this.authentication = authentication;
  }

  public getSemester() {
    return this.semester;
  }

  public getYear() {
    return this.year;
  }

  /**
   * Retrieves an object contains respected year range.
   *
   * @returns an array contains respected year range.
   */
  public getActualYearRange() {
    return { start: this.year, end: this.year + 1 };
  }

  public async getWeeks(): Promise<WeekPeriod[]> {
    // Prepare data
    const formData = new FormData();
    formData.append(
      "ctl00$ContentPlaceHolder1$ctl00$ddlChonNHHK",
      String(this.year.toString() + this.semester.toString())
    );
    formData.append("ctl00$ContentPlaceHolder1$ctl00$ddlLoai", "0");

    // Send request to edu-soft
    const response = await this.authentication
      .createAxiosInstanceWithCurrentSession()
      .post("/default.aspx?page=thoikhoabieu", {});
    // Extract data
    const optionListElements = parseHtml(
      preprocessRawHtml(response.data)
    ).querySelectorAll("#ctl00_ContentPlaceHolder1_ctl00_ddlTuan option");

    // Refine data to WeekPeriod
    return optionListElements.map((listElement: HTMLElement) => {
      const splitter: string[] = listElement.text.split(" ");
      const startDate: Moment = moment(splitter[3], "DD/MM/YYYY");
      const endDate: Moment = moment(
        splitter[6].substring(0, splitter[6].length - 1),
        "DD/MM/YYYY"
      );
      const weekNumber = Number.parseInt(splitter[1]);
      return new WeekPeriod(weekNumber, startDate, endDate);
    });
  }
}

class Schedule {
  private semesters: Semester[]; // TODO: optimize for the better search base algorithm
  private authentication: Authentication;
  private lastUpdate: Moment;

  constructor(authentication: Authentication, htmlBodyElement: HTMLElement) {
    this.authentication = authentication;
    this.extractFromHTMLElement(htmlBodyElement);
  }

  private extractFromHTMLElement(htmlBodyElement: HTMLElement) {
    // Extract semester list
    const semesterList = htmlBodyElement.querySelectorAll(
      "select#ctl00_ContentPlaceHolder1_ctl00_ddlChonNHHK option"
    );
    // Extract the value from 20001 onto
    //   2000 ~ 1
    this.semesters = semesterList.map((semester) => {
      const valueAttribute = semester.getAttribute("value");
      if (valueAttribute === undefined) {
        throw new Error(`Value attribute is empty`);
      }
      const value = valueAttribute.toString();

      return new Semester(
        Number.parseInt(value.substring(4)),
        Number.parseInt(value.substring(0, 4)),
        this.authentication
      );
    });

    // Extract last update
    const spanLastUpdateElement = htmlBodyElement.querySelector(
      "#ctl00_ContentPlaceHolder1_ctl00_lblNoteUpdateDHQT"
    );
    const dateExtracted = spanLastUpdateElement?.text.split(" ");
    if (dateExtracted === undefined) {
      throw new Error(`Invalid date extracted value`);
    }
    const hour = dateExtracted[8];
    const date = dateExtracted[10].substring(0, dateExtracted[10].length - 1);

    // Parse the time by using moment
    this.lastUpdate = this.extractToMomentDate(date.concat(" ").concat(hour));
  }

  private extractToMomentDate(rawValue: string): moment.Moment {
    const _rawValueSplitted = rawValue.split(" ");
    const datePath = _rawValueSplitted[0].split("/");
    const hourPath = _rawValueSplitted[1].split(":");

    const day = Number.parseInt(datePath[0]);
    const month = Number.parseInt(datePath[1]);
    const year = Number.parseFloat(datePath[2]);

    const hour = Number.parseInt(hourPath[0]);
    const minute = Number.parseInt(hourPath[1]);

    return moment([
      year,
      // Month calculate from 0 to 11
      month - 1,
      day,
      hour,
      minute,
    ]);
  }

  public getSemester(semester: number, year: number): Semester | undefined {
    return this.semesters.find(
      (_semester) =>
        _semester.getSemester() === semester && _semester.getYear() === year
    );
  }

  public getLastSemester() {
    return this.semesters[0];
  }

  public getLastUpdate() {
    return this.lastUpdate;
  }
}
