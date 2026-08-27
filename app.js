const TOTAL_STUDENTS = 27;
const TOTAL_SEATS = 27;
const STORAGE_KEY = "class-seat-preference:v1";
const EMAIL_KEY = "class-seat-preference:teacher-email";

const state = {
  respondent: null,
  ranking: [],
  currentView: "ranking",
  data: loadData(),
};

const elements = {
  studentNumber: document.querySelector("#student-number"),
  seatGrid: document.querySelector("#seat-grid"),
  rankingList: document.querySelector("#ranking-list"),
  nextRank: document.querySelector("#next-rank"),
  remainingCount: document.querySelector("#remaining-count"),
  chosenCount: document.querySelector("#chosen-count"),
  submitPreference: document.querySelector("#submit-preference"),
  resetRanking: document.querySelector("#reset-ranking"),
  responseCount: document.querySelector("#response-count"),
  progressBar: document.querySelector("#progress-bar"),
  progressCopy: document.querySelector("#progress-copy"),
  resultsStatus: document.querySelector("#results-status"),
  summaryResponses: document.querySelector("#summary-responses"),
  summaryPercent: document.querySelector("#summary-percent"),
  topChoiceSeat: document.querySelector("#top-choice-seat"),
  topChoiceVotes: document.querySelector("#top-choice-votes"),
  averageSatisfaction: document.querySelector("#average-satisfaction"),
  satisfactionCopy: document.querySelector("#satisfaction-copy"),
  seatResultList: document.querySelector("#seat-result-list"),
  studentStatusGrid: document.querySelector("#student-status-grid"),
  assignmentBody: document.querySelector("#assignment-body"),
  provisionalBadge: document.querySelector("#provisional-badge"),
  newResponse: document.querySelector("#new-response"),
  printResults: document.querySelector("#print-results"),
  teacherEmail: document.querySelector("#teacher-email"),
  emailResults: document.querySelector("#email-results"),
  saveResultImage: document.querySelector("#save-result-image"),
  exportData: document.querySelector("#export-data"),
  importData: document.querySelector("#import-data"),
  clearData: document.querySelector("#clear-data"),
  toast: document.querySelector("#toast"),
  steps: [...document.querySelectorAll(".step")],
  views: [...document.querySelectorAll(".view-section")],
};

function emptyData() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    responses: {},
  };
}

function isValidRanking(ranking) {
  return Array.isArray(ranking)
    && ranking.length === TOTAL_SEATS
    && new Set(ranking).size === TOTAL_SEATS
    && ranking.every((seat) => Number.isInteger(seat) && seat >= 1 && seat <= TOTAL_SEATS);
}

function sanitizeData(candidate) {
  if (!candidate || typeof candidate !== "object" || typeof candidate.responses !== "object") {
    throw new Error("올바른 자리 투표 백업 파일이 아닙니다.");
  }

  const responses = {};
  Object.entries(candidate.responses).forEach(([student, response]) => {
    const studentNumber = Number(student);
    if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > TOTAL_STUDENTS) return;
    if (!isValidRanking(response?.ranking)) return;
    responses[studentNumber] = {
      ranking: [...response.ranking],
      submittedAt: typeof response.submittedAt === "string" ? response.submittedAt : new Date().toISOString(),
    };
  });

  return {
    version: 1,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
    responses,
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? sanitizeData(JSON.parse(saved)) : emptyData();
  } catch (error) {
    console.warn("저장된 자리 투표를 불러오지 못했습니다.", error);
    return emptyData();
  }
}

function saveData() {
  state.data.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => elements.toast.classList.remove("is-visible"), 2800);
}

function buildStudentOptions() {
  elements.studentNumber.insertAdjacentHTML(
    "beforeend",
    Array.from({ length: TOTAL_STUDENTS }, (_, index) => {
      const number = index + 1;
      return `<option value="${number}">${number}번</option>`;
    }).join(""),
  );
}

function buildSeats() {
  elements.seatGrid.innerHTML = Array.from({ length: TOTAL_SEATS }, (_, index) => {
    const seat = index + 1;
    return `
      <button class="seat" type="button" data-seat="${seat}" aria-label="${seat}번 자리 선택">
        <span>자리</span>
        <strong>${seat}</strong>
        <i class="rank-badge" aria-hidden="true"></i>
      </button>
    `;
  }).join("");
}

function renderRanking() {
  document.querySelectorAll(".seat").forEach((seatButton) => {
    const seat = Number(seatButton.dataset.seat);
    const rankIndex = state.ranking.indexOf(seat);
    const badge = seatButton.querySelector(".rank-badge");
    seatButton.classList.toggle("is-ranked", rankIndex >= 0);
    seatButton.setAttribute("aria-pressed", String(rankIndex >= 0));
    badge.textContent = rankIndex >= 0 ? `${rankIndex + 1}` : "";
  });

  elements.chosenCount.textContent = state.ranking.length;
  elements.remainingCount.textContent = TOTAL_SEATS - state.ranking.length;
  elements.nextRank.textContent = state.ranking.length === TOTAL_SEATS
    ? "완료"
    : `${state.ranking.length + 1}순위`;
  elements.submitPreference.disabled = state.ranking.length !== TOTAL_SEATS || !state.respondent;

  const savedResponse = state.respondent ? state.data.responses[state.respondent] : null;
  elements.submitPreference.firstChild.textContent = savedResponse ? "수정한 응답 저장하기 " : "내 응답 저장하기 ";

  if (state.ranking.length === 0) {
    elements.rankingList.innerHTML = '<li class="empty-ranking">책상을 누르면 희망 순위가 여기에 표시돼요.</li>';
    return;
  }

  elements.rankingList.innerHTML = state.ranking.map((seat, index) => `
    <li>
      <span class="rank-number">${index + 1}순위</span>
      <span class="seat-name">${seat}번 자리</span>
    </li>
  `).join("");
  elements.rankingList.scrollTop = elements.rankingList.scrollHeight;
}

function updateProgress() {
  const count = Object.keys(state.data.responses).length;
  const percent = Math.round((count / TOTAL_STUDENTS) * 100);
  elements.responseCount.textContent = count;
  elements.progressBar.style.width = `${percent}%`;
  elements.progressCopy.textContent = count === 0
    ? "첫 번째 응답을 기다리고 있어요"
    : count === TOTAL_STUDENTS
      ? "27명의 희망 순위가 모두 모였어요"
      : `${TOTAL_STUDENTS - count}명의 응답이 더 필요해요`;
}

function hungarian(costs) {
  const rowCount = costs.length;
  if (!rowCount) return [];
  const columnCount = costs[0].length;
  const u = Array(rowCount + 1).fill(0);
  const v = Array(columnCount + 1).fill(0);
  const p = Array(columnCount + 1).fill(0);
  const way = Array(columnCount + 1).fill(0);

  for (let row = 1; row <= rowCount; row += 1) {
    p[0] = row;
    let column0 = 0;
    const minValues = Array(columnCount + 1).fill(Infinity);
    const used = Array(columnCount + 1).fill(false);

    do {
      used[column0] = true;
      const row0 = p[column0];
      let delta = Infinity;
      let column1 = 0;

      for (let column = 1; column <= columnCount; column += 1) {
        if (used[column]) continue;
        const current = costs[row0 - 1][column - 1] - u[row0] - v[column];
        if (current < minValues[column]) {
          minValues[column] = current;
          way[column] = column0;
        }
        if (minValues[column] < delta) {
          delta = minValues[column];
          column1 = column;
        }
      }

      for (let column = 0; column <= columnCount; column += 1) {
        if (used[column]) {
          u[p[column]] += delta;
          v[column] -= delta;
        } else {
          minValues[column] -= delta;
        }
      }
      column0 = column1;
    } while (p[column0] !== 0);

    do {
      const column1 = way[column0];
      p[column0] = p[column1];
      column0 = column1;
    } while (column0 !== 0);
  }

  const assignment = Array(rowCount).fill(-1);
  for (let column = 1; column <= columnCount; column += 1) {
    if (p[column] > 0) assignment[p[column] - 1] = column - 1;
  }
  return assignment;
}

function getResults() {
  const students = Object.keys(state.data.responses).map(Number).sort((a, b) => a - b);
  const seatStats = Array.from({ length: TOTAL_SEATS }, (_, index) => ({
    seat: index + 1,
    firstChoiceVotes: 0,
    totalRank: 0,
    count: 0,
    averageRank: Infinity,
  }));

  students.forEach((student) => {
    const { ranking } = state.data.responses[student];
    seatStats[ranking[0] - 1].firstChoiceVotes += 1;
    ranking.forEach((seat, rankIndex) => {
      seatStats[seat - 1].totalRank += rankIndex + 1;
      seatStats[seat - 1].count += 1;
    });
  });

  seatStats.forEach((stat) => {
    stat.averageRank = stat.count ? stat.totalRank / stat.count : Infinity;
  });
  seatStats.sort((a, b) => b.firstChoiceVotes - a.firstChoiceVotes || a.averageRank - b.averageRank || a.seat - b.seat);

  const costs = students.map((student) => {
    const ranking = state.data.responses[student].ranking;
    return Array.from({ length: TOTAL_SEATS }, (_, index) => ranking.indexOf(index + 1) + 1);
  });
  const seatIndexes = hungarian(costs);
  const assignments = students.map((student, rowIndex) => {
    const seat = seatIndexes[rowIndex] + 1;
    const ranking = state.data.responses[student].ranking;
    return {
      student,
      seat,
      preferenceRank: ranking.indexOf(seat) + 1,
      firstChoice: ranking[0],
    };
  });
  const averageAssignedRank = assignments.length
    ? assignments.reduce((total, item) => total + item.preferenceRank, 0) / assignments.length
    : 0;

  return { students, seatStats, assignments, averageAssignedRank };
}

function renderResults() {
  const { students, seatStats, assignments, averageAssignedRank } = getResults();
  const count = students.length;
  const percent = Math.round((count / TOTAL_STUDENTS) * 100);
  const hasResults = count > 0;

  elements.summaryResponses.textContent = count;
  elements.summaryPercent.textContent = `${percent}% 완료`;
  elements.resultsStatus.textContent = count === TOTAL_STUDENTS
    ? "27명의 희망 순위를 모두 반영했습니다. 결과 이미지나 이메일로 보관할 수 있어요."
    : `${count}명의 응답을 반영한 임시 배치입니다. 남은 학생이 응답하면 자동으로 다시 계산돼요.`;
  elements.provisionalBadge.textContent = count === TOTAL_STUDENTS ? "27명 배치 완료" : "임시 결과";
  elements.provisionalBadge.classList.toggle("is-complete", count === TOTAL_STUDENTS);

  const completed = new Set(students);
  elements.studentStatusGrid.innerHTML = Array.from({ length: TOTAL_STUDENTS }, (_, index) => {
    const student = index + 1;
    const done = completed.has(student);
    return `<span class="student-status ${done ? "is-done" : ""}"><b>${student}</b><small>${done ? "완료" : "대기"}</small></span>`;
  }).join("");

  if (!hasResults) {
    elements.topChoiceSeat.textContent = "-";
    elements.topChoiceVotes.textContent = "응답을 기다리는 중";
    elements.averageSatisfaction.textContent = "-";
    elements.satisfactionCopy.textContent = "응답을 기다리는 중";
    elements.seatResultList.className = "result-list empty-result";
    elements.seatResultList.textContent = "아직 저장된 응답이 없습니다.";
    elements.assignmentBody.innerHTML = '<tr><td colspan="4">응답이 저장되면 자동 배치가 표시됩니다.</td></tr>';
    return;
  }

  const topSeat = seatStats[0];
  elements.topChoiceSeat.textContent = `${topSeat.seat}번 자리`;
  elements.topChoiceVotes.textContent = `1순위 ${topSeat.firstChoiceVotes}표 · 평균 ${topSeat.averageRank.toFixed(1)}순위`;
  elements.averageSatisfaction.textContent = `평균 ${averageAssignedRank.toFixed(1)}순위`;
  elements.satisfactionCopy.textContent = "낮을수록 희망에 가까운 배치";

  const maxFirstVotes = Math.max(1, ...seatStats.map((stat) => stat.firstChoiceVotes));
  elements.seatResultList.className = "result-list";
  elements.seatResultList.innerHTML = seatStats.map((stat, index) => `
    <div class="result-row">
      <span class="result-rank">${index + 1}위</span>
      <span class="result-label">${stat.seat}번 자리</span>
      <span class="result-bar" aria-hidden="true"><span style="width:${Math.max(2, (stat.firstChoiceVotes / maxFirstVotes) * 100)}%"></span></span>
      <span class="result-value">1순위 ${stat.firstChoiceVotes}표</span>
    </div>
  `).join("");

  elements.assignmentBody.innerHTML = assignments.map((item) => `
    <tr>
      <td><strong>${item.student}번 학생</strong></td>
      <td><strong>${item.seat}번 자리</strong></td>
      <td>${item.preferenceRank}순위</td>
      <td>${item.firstChoice}번 자리</td>
    </tr>
  `).join("");
}

function showView(viewName) {
  state.currentView = viewName;
  elements.views.forEach((view) => {
    view.hidden = view.id !== `${viewName}-view`;
  });
  elements.steps.forEach((step) => {
    const isActive = step.dataset.view === viewName;
    step.classList.toggle("is-active", isActive);
    step.setAttribute("aria-current", isActive ? "step" : "false");
  });
  if (viewName === "results") renderResults();
  document.querySelector(".steps").scrollIntoView({ behavior: "smooth", block: "start" });
}

function startNewResponse() {
  state.respondent = null;
  state.ranking = [];
  elements.studentNumber.value = "";
  renderRanking();
  showView("ranking");
}

function buildResultSummary() {
  const { students, seatStats, assignments, averageAssignedRank } = getResults();
  if (!students.length) return "";
  const lines = [
    "우리 반 자리 투표 결과",
    `응답: ${students.length}/${TOTAL_STUDENTS}명`,
    `1순위 인기 자리: ${seatStats[0].seat}번 (${seatStats[0].firstChoiceVotes}표)`,
    `자동 배치 평균 희망 순위: ${averageAssignedRank.toFixed(1)}순위`,
    "",
    "[자동 배치]",
    ...assignments.map((item) => `${item.student}번 학생 → ${item.seat}번 자리 (본인 희망 ${item.preferenceRank}순위)`),
    "",
    "※ 아직 응답하지 않은 학생이 있으면 결과가 바뀔 수 있습니다.",
  ];
  return lines.join("\n");
}

function drawResultImage() {
  const { students, seatStats, assignments, averageAssignedRank } = getResults();
  if (!students.length) return null;

  const width = 1400;
  const rowHeight = 48;
  const height = 460 + assignments.length * rowHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  context.fillStyle = "#f6f1e7";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#173f35";
  context.fillRect(0, 0, width, 250);
  context.fillStyle = "#ff7a45";
  context.fillRect(84, 62, 12, 112);

  context.fillStyle = "#d9f99d";
  context.font = '700 28px "Noto Sans KR", sans-serif';
  context.fillText("우리 반 자리 투표", 126, 95);
  context.fillStyle = "#ffffff";
  context.font = '800 58px "Noto Sans KR", sans-serif';
  context.fillText("전체 희망을 반영한 자리 결과", 126, 163);
  context.fillStyle = "#c8d8d3";
  context.font = '500 24px "Noto Sans KR", sans-serif';
  context.fillText(`${students.length}/27명 응답 · 1순위 인기 ${seatStats[0].seat}번 자리 · 배치 평균 ${averageAssignedRank.toFixed(1)}순위`, 126, 210);

  const tableTop = 320;
  context.fillStyle = "#173f35";
  context.font = '800 25px "Noto Sans KR", sans-serif';
  context.fillText("학생", 92, tableTop);
  context.fillText("배정 자리", 330, tableTop);
  context.fillText("희망 순위", 650, tableTop);
  context.fillText("1순위 희망", 970, tableTop);
  context.strokeStyle = "#cfd5cc";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(84, tableTop + 24);
  context.lineTo(width - 84, tableTop + 24);
  context.stroke();

  assignments.forEach((item, index) => {
    const y = tableTop + 70 + index * rowHeight;
    if (index % 2 === 0) {
      context.fillStyle = "#fffaf1";
      context.fillRect(76, y - 31, width - 152, rowHeight);
    }
    context.fillStyle = "#173f35";
    context.font = '700 22px "Noto Sans KR", sans-serif';
    context.fillText(`${item.student}번 학생`, 92, y);
    context.fillText(`${item.seat}번 자리`, 330, y);
    context.fillStyle = item.preferenceRank <= 3 ? "#e95f2f" : "#4a665f";
    context.fillText(`${item.preferenceRank}순위`, 650, y);
    context.fillStyle = "#4a665f";
    context.fillText(`${item.firstChoice}번 자리`, 970, y);
  });

  context.fillStyle = "#697873";
  context.font = '500 19px "Noto Sans KR", sans-serif';
  context.fillText("아직 응답하지 않은 학생이 있다면 최종 확정 전에 다시 계산해 주세요.", 84, height - 48);
  return canvas;
}

elements.studentNumber.addEventListener("change", () => {
  const selected = Number(elements.studentNumber.value);
  state.respondent = selected || null;
  const savedResponse = state.data.responses[selected];
  state.ranking = savedResponse ? [...savedResponse.ranking] : [];
  renderRanking();
  if (savedResponse) showToast(`${selected}번의 기존 희망 순위를 불러왔습니다.`);
});

elements.seatGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".seat");
  if (!button) return;
  const seat = Number(button.dataset.seat);
  const existingIndex = state.ranking.indexOf(seat);
  if (existingIndex >= 0) state.ranking.splice(existingIndex, 1);
  else if (state.ranking.length < TOTAL_SEATS) state.ranking.push(seat);
  renderRanking();
});

elements.resetRanking.addEventListener("click", () => {
  state.ranking = [];
  renderRanking();
  showToast("희망 순위를 다시 선택할 수 있어요.");
});

elements.submitPreference.addEventListener("click", () => {
  if (!state.respondent || !isValidRanking(state.ranking)) {
    showToast("응답자 번호와 27개 자리 순위를 모두 완성해 주세요.");
    return;
  }
  state.data.responses[state.respondent] = {
    ranking: [...state.ranking],
    submittedAt: new Date().toISOString(),
  };
  saveData();
  updateProgress();
  showView("results");
  showToast(`${state.respondent}번의 희망 순위를 이 기기에 저장했습니다.`);
});

elements.steps.forEach((step) => step.addEventListener("click", () => showView(step.dataset.view)));
elements.newResponse.addEventListener("click", startNewResponse);
elements.printResults.addEventListener("click", () => window.print());

elements.teacherEmail.value = localStorage.getItem(EMAIL_KEY) || "";
elements.teacherEmail.addEventListener("change", () => {
  localStorage.setItem(EMAIL_KEY, elements.teacherEmail.value.trim());
});

elements.emailResults.addEventListener("click", () => {
  const email = elements.teacherEmail.value.trim();
  const summary = buildResultSummary();
  if (!summary) {
    showToast("먼저 한 명 이상의 응답을 저장해 주세요.");
    return;
  }
  if (!email || !elements.teacherEmail.checkValidity()) {
    elements.teacherEmail.focus();
    showToast("결과를 받을 이메일 주소를 확인해 주세요.");
    return;
  }
  localStorage.setItem(EMAIL_KEY, email);
  const subject = encodeURIComponent(`우리 반 자리 투표 결과 (${Object.keys(state.data.responses).length}/27명)`);
  const body = encodeURIComponent(summary);
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
});

elements.saveResultImage.addEventListener("click", () => {
  const canvas = drawResultImage();
  if (!canvas) {
    showToast("먼저 한 명 이상의 응답을 저장해 주세요.");
    return;
  }
  canvas.toBlob((blob) => {
    if (!blob) {
      showToast("결과 이미지를 만들지 못했습니다.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `우리반-자리투표-결과-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("결과 이미지를 저장했습니다. 이메일에 첨부해 주세요.");
  }, "image/png");
});

elements.exportData.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `class-seat-vote-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("자리 투표 데이터를 JSON 파일로 백업했습니다.");
});

elements.importData.addEventListener("change", async () => {
  const [file] = elements.importData.files;
  if (!file) return;
  try {
    const imported = sanitizeData(JSON.parse(await file.text()));
    state.data = imported;
    saveData();
    updateProgress();
    renderResults();
    showToast(`${Object.keys(imported.responses).length}명의 응답을 복원했습니다.`);
  } catch (error) {
    showToast(error.message || "백업 파일을 읽지 못했습니다.");
  } finally {
    elements.importData.value = "";
  }
});

elements.clearData.addEventListener("click", () => {
  const responseCount = Object.keys(state.data.responses).length;
  if (!responseCount) {
    showToast("초기화할 응답이 없습니다.");
    return;
  }
  const confirmed = window.confirm(`저장된 ${responseCount}명의 자리 투표를 모두 삭제할까요? 먼저 JSON 백업을 권장합니다.`);
  if (!confirmed) return;
  state.data = emptyData();
  saveData();
  updateProgress();
  startNewResponse();
  showToast("모든 자리 투표 데이터를 초기화했습니다.");
});

buildStudentOptions();
buildSeats();
renderRanking();
updateProgress();
