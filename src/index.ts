import axios from "axios";
import { parse as parseHtml } from "node-html-parser";

export const EduSoftAxiosInstance = axios.create({
  baseURL: "https://edusoftweb.hcmiu.edu.vn/",
});

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

  private preprocessRawHtml(html: string): string {
    const rangeIndex: number[] = [
      html.indexOf("<body"),
      html.indexOf("/body>"),
    ];
    return html.substring(rangeIndex[0], rangeIndex[1]);
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

    const processedRawHtml = this.preprocessRawHtml(await response.data);
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
}

export class EduSoftAction {
  private authentication: Authentication;

  constructor(authentication: Authentication) {
    this.authentication = authentication;
  }

  public getSchedule() {
    this.authentication.getSession();
  }
}
