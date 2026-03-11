const fs = require("fs");

// Converts "hh:mm:ss am/pm" to total seconds
function timeToSeconds(timeStr) {
  timeStr = timeStr.trim().toLowerCase();
  const [timePart, period] = timeStr.split(" ");
  let [h, m, s] = timePart.split(":").map(Number);

  if (period === "am") {
    if (h === 12) h = 0; // 12:xx am = midnight
  } else {
    if (h !== 12) h += 12; // 1pm-11pm: add 12
  }

  return h * 3600 + m * 60 + s;
}

// Converts "h:mm:ss" duration string to total seconds
function durationToSeconds(durationStr) {
  const [h, m, s] = durationStr.trim().split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

// Converts total seconds to "h:mm:ss" format
function secondsToDuration(totalSec) {
  totalSec = Math.abs(totalSec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  // Digits fixed to natural number
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Converts total seconds to "hhh:mm:ss" format (3-digit hours)
function secondsToLongDuration(totalSec) {
  totalSec = Math.abs(totalSec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Reads a file and returns an array of non-empty lines
function readLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return content.split("\n").filter((line) => line.trim() !== "");
}

// Writes an array of lines back to a file
function writeLines(filePath, lines) {
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

// Returns the day name (e.g. "Friday") from a "yyyy-mm-dd" string
function getDayName(dateStr) {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const [year, month, day] = dateStr.split("-").map(Number);
  return days[new Date(year, month - 1, day).getDay()];
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
  const diff = timeToSeconds(endTime) - timeToSeconds(startTime);
  return secondsToDuration(diff);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
  const start = timeToSeconds(startTime);
  const end = timeToSeconds(endTime);
  const deliveryStart = 8 * 3600;  // 8:00 AM in seconds
  const deliveryEnd = 22 * 3600;   // 10:00 PM in seconds

  let idle = 0;

  // Time before 8 AM
  if (start < deliveryStart) {
    idle += Math.min(end, deliveryStart) - start;
  }

  // Time after 10 PM
  if (end > deliveryEnd) {
    idle += end - Math.max(start, deliveryEnd);
  }

  return secondsToDuration(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
  const active = durationToSeconds(shiftDuration) - durationToSeconds(idleTime);
  return secondsToDuration(active < 0 ? 0 : active);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
  const [year, month, day] = date.split("-").map(Number);
  const isEid = year === 2025 && month === 4 && day >= 10 && day <= 30;
  const quota = isEid ? 6 * 3600 : 8 * 3600 + 24 * 60; // 6h or 8h24m
  return durationToSeconds(activeTime) >= quota;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
  const { driverID, driverName, date, startTime, endTime } = shiftObj;

  // Try to read existing lines (file might not exist yet)
  let lines = [];
  try {
    lines = readLines(textFile);
  } catch (e) {}

  // Check for duplicate (same driverID + same date)
  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim());
    if (cols[0] === driverID && cols[2] === date) return {};
  }

  // Calculate all the derived fields
  const shiftDuration = getShiftDuration(startTime, endTime);
  const idleTime = getIdleTime(startTime, endTime);
  const activeTime = getActiveTime(shiftDuration, idleTime);
  const quota = metQuota(date, activeTime);

  const newRecord = {
    driverID,
    driverName,
    date,
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    shiftDuration,
    idleTime,
    activeTime,
    metQuota: quota,
    hasBonus: false,
  };

  // Build the new line
  const newLine = [
    driverID, driverName, date,
    startTime.trim(), endTime.trim(),
    shiftDuration, idleTime, activeTime,
    quota, false
  ].join(",");

  // Insert after the last record of this driverID, or at the end
  let lastIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].split(",")[0].trim() === driverID) lastIndex = i;
  }

  if (lastIndex === -1) {
    lines.push(newLine);
  } else {
    lines.splice(lastIndex + 1, 0, newLine);
  }

  writeLines(textFile, lines);
  return newRecord;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
  const lines = readLines(textFile);

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols[0] === driverID && cols[2] === date) {
      cols[9] = String(newValue);
      lines[i] = cols.join(",");
      break;
    }
  }

  writeLines(textFile, lines);
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
  const lines = readLines(textFile);
  const targetMonth = parseInt(month, 10);

  let driverFound = false;
  let count = 0;

  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim());
    if (cols[0] !== driverID) continue;
    driverFound = true;
    const recordMonth = parseInt(cols[2].split("-")[1], 10);
    if (recordMonth === targetMonth && cols[9] === "true") count++;
  }

  return driverFound ? count : -1;
}


// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
  const lines = readLines(textFile);
  const targetMonth = parseInt(month, 10);
  let total = 0;

  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim());
    if (cols[0] !== driverID) continue;
    if (parseInt(cols[2].split("-")[1], 10) !== targetMonth) continue;
    total += durationToSeconds(cols[7]); // activeTime is column 7
  }

  return secondsToLongDuration(total);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
  const shiftLines = readLines(textFile);
  const rateLines = readLines(rateFile);
  const targetMonth = parseInt(month, 10);

  // Find the driver's day off
  let dayOff = null;
  for (const line of rateLines) {
    const cols = line.split(",").map((c) => c.trim());
    if (cols[0] === driverID) { dayOff = cols[1]; break; }
  }

  let total = 0;

  for (const line of shiftLines) {
    const cols = line.split(",").map((c) => c.trim());
    if (cols[0] !== driverID) continue;
    const dateStr = cols[2];
    if (parseInt(dateStr.split("-")[1], 10) !== targetMonth) continue;

    // Skip if it's the driver's day off
    if (getDayName(dateStr) === dayOff) continue;

    // Eid quota (6h) or normal quota (8h24m)
    const [year, mon, day] = dateStr.split("-").map(Number);
    const isEid = year === 2025 && mon === 4 && day >= 10 && day <= 30;
    total += isEid ? 6 * 3600 : 8 * 3600 + 24 * 60;
  }

  // Each bonus reduces required hours by 2
  total = Math.max(0, total - bonusCount * 2 * 3600);

  return secondsToLongDuration(total);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
  const lines = readLines(rateFile);

  let basePay = 0;
  let tier = 0;

  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim());
    if (cols[0] === driverID) {
      basePay = parseInt(cols[2], 10);
      tier = parseInt(cols[3], 10);
      break;
    }
  }

  const actualSec = durationToSeconds(actualHours);
  const requiredSec = durationToSeconds(requiredHours);

  // No deduction if driver worked enough
  if (actualSec >= requiredSec) return basePay;

  // Grace hours per tier (no deduction within this range)
  const grace = { 1: 50, 2: 20, 3: 10, 4: 3 };
  const graceSec = (grace[tier] || 0) * 3600;

  const missingSec = requiredSec - actualSec;

  // Still within grace period — no deduction
  if (missingSec <= graceSec) return basePay;

  // Only full hours beyond the grace period are billed
  const billableHours = Math.floor((missingSec - graceSec) / 3600);

  const deductionPerHour = Math.floor(basePay / 185);
  return basePay - billableHours * deductionPerHour;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
