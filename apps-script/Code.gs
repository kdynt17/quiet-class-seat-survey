const SPREADSHEET_ID = "1mRvZkd-EwB8kKwULLNuH4Ys-ZmJ716grg3KUtCyyt-g";
const SHEET_NAME = "응답";
const TOTAL_STUDENTS = 27;
const TOTAL_SEATS = 27;

function doGet(event) {
  const parameters = event && event.parameter ? event.parameter : {};

  try {
    const action = String(parameters.action || "ping");
    if (action === "ping") {
      return respond_({ ok: true, service: "seat-survey", now: new Date().toISOString() }, parameters.callback);
    }
    if (action === "results") {
      return respond_({ ok: true, responses: readResponses_() }, parameters.callback);
    }
    if (action === "submit") {
      const student = Number(parameters.student);
      const ranking = String(parameters.ranking || "").split(",").map(Number);
      validateSubmission_(student, ranking);
      upsertResponse_(student, ranking);
      return respond_({ ok: true, student: student, savedAt: new Date().toISOString() }, parameters.callback);
    }
    throw new Error("지원하지 않는 요청입니다.");
  } catch (error) {
    return respond_({ ok: false, error: error.message || "처리 중 오류가 발생했습니다." }, parameters.callback);
  }
}

function readResponses_() {
  const sheet = getResponseSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, TOTAL_SEATS + 2).getValues()
    .map(function (row) {
      const student = Number(row[1]);
      const ranking = row.slice(2).map(Number);
      return {
        student: student,
        ranking: ranking,
        submittedAt: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || ""),
      };
    })
    .filter(function (response) {
      return response.student >= 1
        && response.student <= TOTAL_STUDENTS
        && isValidRanking_(response.ranking);
    });
}

function upsertResponse_(student, ranking) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getResponseSheet_();
    ensureHeader_(sheet);
    const lastRow = sheet.getLastRow();
    let targetRow = lastRow + 1;

    if (lastRow >= 2) {
      const students = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      const existingIndex = students.findIndex(function (row) { return Number(row[0]) === student; });
      if (existingIndex >= 0) targetRow = existingIndex + 2;
    }

    sheet.getRange(targetRow, 1, 1, TOTAL_SEATS + 2).setValues([[new Date(), student].concat(ranking)]);
    sheet.getRange(targetRow, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function validateSubmission_(student, ranking) {
  if (!Number.isInteger(student) || student < 1 || student > TOTAL_STUDENTS) {
    throw new Error("학생 번호는 1~27이어야 합니다.");
  }
  if (!isValidRanking_(ranking)) {
    throw new Error("1~27번 자리를 중복 없이 모두 선택해 주세요.");
  }
}

function isValidRanking_(ranking) {
  return Array.isArray(ranking)
    && ranking.length === TOTAL_SEATS
    && ranking.every(function (seat) { return Number.isInteger(seat) && seat >= 1 && seat <= TOTAL_SEATS; })
    && new Set(ranking).size === TOTAL_SEATS;
}

function getResponseSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("응답 시트를 찾을 수 없습니다.");
  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getRange(1, 1).getValue() === "제출 시각") return;
  const header = ["제출 시각", "학생 번호"];
  for (let rank = 1; rank <= TOTAL_SEATS; rank += 1) header.push(`${rank}순위 자리`);
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  sheet.setFrozenRows(1);
}

function respond_(payload, callback) {
  const json = JSON.stringify(payload);
  const callbackName = String(callback || "");
  if (/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callbackName)) {
    return ContentService.createTextOutput(`${callbackName}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
