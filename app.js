const TOTAL_STUDENTS = 27;
const TOTAL_SEATS = 27;
const STORAGE_KEY = "quiet-class-seat-survey:v1";

const state = {
  respondent: null,
  ranking: [],
  noiseVote: null,
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
  nextStep: document.querySelector("#next-step"),
  resetRanking: document.querySelector("#reset-ranking"),
  noiseGrid: document.querySelector("#noise-grid"),
  noiseRespondent: document.querySelector("#noise-respondent"),
  noiseChoice: document.querySelector("#noise-choice"),
  submitResponse: document.querySelector("#submit-response"),
  backToRanking: document.querySelector("#back-to-ranking"),
  responseCount: document.querySelector("#response-count"),
  progressBar: document.querySelector("#progress-bar"),
  progressCopy: document.querySelector("#progress-copy"),
  resultsStatus: document.querySelector("#results-status"),
  summaryResponses: document.querySelector("#summary-responses"),
  summaryPercent: document.querySelector("#summary-percent"),
  topDislikedSeat: document.querySelector("#top-disliked-seat"),
  topDislikedScore: document.querySelector("#top-disliked-score"),
  topNoisyStudent: document.querySelector("#top-noisy-student"),
  topNoisyVotes: document.querySelector("#top-noisy-votes"),
  seatResultList: document.querySelector("#seat-result-list"),
  noiseResultList: document.querySelector("#noise-result-list"),
  assignmentBody: document.querySelector("#assignment-body"),
  provisionalBadge: document.querySelector("#provisional-badge"),
  newResponse: document.querySelector("#new-response"),
  printResults: document.querySelector("#print-results"),
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
    throw new Error("올바른 설문 백업 파일이 아닙니다.");
  }

  const responses = {};
  Object.entries(candidate.responses).forEach(([student, response]) => {
    const studentNumber = Number(student);
    if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > TOTAL_STUDENTS) return;
    if (!isValidRanking(response?.ranking)) return;
    const noiseVote = Number(response?.noiseVote);
    if (!Number.isInteger(noiseVote) || noiseVote < 1 || noiseVote > TOTAL_STUDENTS || noiseVote === studentNumber) return;
    responses[studentNumber] = {
      ranking: [...response.ranking],
      noiseVote,
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
    console.warn("저장된 설문 데이터를 불러오지 못했습니다.", error);
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
  showToast.timeoutId = setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

function buildStudentOptions() {
  const options = Array.from({ length: TOTAL_STUDENTS }, (_, index) => {
    const number = index + 1;
    return `<option value="${number}">${number}번</option>`;
  }).join("");
  elements.studentNumber.insertAdjacentHTML("beforeend", options);
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

function buildNoiseGrid() {
  elements.noiseGrid.innerHTML = Array.from({ length: TOTAL_STUDENTS }, (_, index) => {
    const student = index + 1;
    return `
      <button class="student-vote" type="button" data-student="${student}" aria-label="${student}번 학생 선택">
        <strong>${student}번</strong>
        <small>학생</small>
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
    badge.textContent = rankIndex >= 0 ? `${rankIndex + 1}위` : "";
  });

  elements.chosenCount.textContent = state.ranking.length;
  elements.remainingCount.textContent = TOTAL_SEATS - state.ranking.length;
  elements.nextRank.textContent = state.ranking.length === TOTAL_SEATS
    ? "완료"
    : `${state.ranking.length + 1}위`;
  elements.nextStep.disabled = state.ranking.length !== TOTAL_SEATS || !state.respondent;

  if (state.ranking.length === 0) {
    elements.rankingList.innerHTML = '<li class="empty-ranking">책상을 누르면 순위가 여기에 표시돼요.</li>';
    return;
  }

  elements.rankingList.innerHTML = state.ranking.map((seat, index) => `
    <li>
      <span class="rank-number">${index + 1}위</span>
      <span class="seat-name">${seat}번 자리</span>
    </li>
  `).join("");
  elements.rankingList.scrollTop = elements.rankingList.scrollHeight;
}

function renderNoise() {
  elements.noiseRespondent.textContent = state.respondent ? `${state.respondent}번` : "-";
  elements.noiseChoice.textContent = state.noiseVote ? `${state.noiseVote}번 학생` : "아직 없음";
  elements.submitResponse.disabled = !state.respondent || !state.noiseVote || !isValidRanking(state.ranking);
  elements.submitResponse.firstChild.textContent = state.data.responses[state.respondent] ? "응답 수정하기 " : "응답 저장하기 ";

  document.querySelectorAll(".student-vote").forEach((button) => {
    const student = Number(button.dataset.student);
    const isSelf = student === state.respondent;
    const isSelected = student === state.noiseVote;
    button.disabled = isSelf;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    button.querySelector("small").textContent = isSelf ? "나" : isSelected ? "선택됨" : "학생";
  });
}

function updateProgress() {
  const count = Object.keys(state.data.responses).length;
  const percent = Math.round((count / TOTAL_STUDENTS) * 100);
  elements.responseCount.textContent = count;
  elements.progressBar.style.width = `${percent}%`;
  elements.progressCopy.textContent = count === 0
    ? "첫 번째 응답을 기다리고 있어요"
    : count === TOTAL_STUDENTS
      ? "27명의 응답이 모두 모였어요"
      : `${TOTAL_STUDENTS - count}명의 응답이 더 필요해요`;
}

function getAggregates() {
  const responses = Object.values(state.data.responses);
  const seatScores = Array.from({ length: TOTAL_SEATS }, (_, index) => ({
    seat: index + 1,
    total: 0,
    count: 0,
    average: Infinity,
  }));
  const noiseScores = Array.from({ length: TOTAL_STUDENTS }, (_, index) => ({
    student: index + 1,
    votes: 0,
  }));

  responses.forEach((response) => {
    response.ranking.forEach((seat, rankIndex) => {
      seatScores[seat - 1].total += rankIndex + 1;
      seatScores[seat - 1].count += 1;
    });
    noiseScores[response.noiseVote - 1].votes += 1;
  });

  seatScores.forEach((score) => {
    score.average = score.count ? score.total / score.count : Infinity;
  });
  seatScores.sort((a, b) => a.average - b.average || a.seat - b.seat);
  noiseScores.sort((a, b) => b.votes - a.votes || a.student - b.student);

  return { responses, seatScores, noiseScores };
}

function renderResults() {
  const { responses, seatScores, noiseScores } = getAggregates();
  const count = responses.length;
  const percent = Math.round((count / TOTAL_STUDENTS) * 100);
  const hasResults = count > 0;

  elements.summaryResponses.textContent = count;
  elements.summaryPercent.textContent = `${percent}% 완료`;
  elements.resultsStatus.textContent = count === TOTAL_STUDENTS
    ? "27명의 응답이 모두 모였습니다. 교사 확인 후 최종 자리를 정해 주세요."
    : `${count}명의 응답을 반영한 임시 결과입니다. 응답이 모일수록 더 정확해져요.`;
  elements.provisionalBadge.textContent = count === TOTAL_STUDENTS ? "27명 집계 완료" : "임시 결과";
  elements.provisionalBadge.classList.toggle("is-complete", count === TOTAL_STUDENTS);

  if (!hasResults) {
    elements.topDislikedSeat.textContent = "-";
    elements.topDislikedScore.textContent = "응답을 기다리는 중";
    elements.topNoisyStudent.textContent = "-";
    elements.topNoisyVotes.textContent = "응답을 기다리는 중";
    elements.seatResultList.className = "result-list empty-result";
    elements.noiseResultList.className = "result-list empty-result";
    elements.seatResultList.textContent = "아직 저장된 응답이 없습니다.";
    elements.noiseResultList.textContent = "아직 저장된 응답이 없습니다.";
    elements.assignmentBody.innerHTML = '<tr><td colspan="5">응답이 저장되면 자동 배치가 표시됩니다.</td></tr>';
    return;
  }

  const topSeat = seatScores[0];
  const topNoise = noiseScores[0];
  elements.topDislikedSeat.textContent = `${topSeat.seat}번 자리`;
  elements.topDislikedScore.textContent = `평균 ${topSeat.average.toFixed(1)}위`;
  elements.topNoisyStudent.textContent = `${topNoise.student}번 학생`;
  elements.topNoisyVotes.textContent = `${topNoise.votes}표`;

  elements.seatResultList.className = "result-list";
  elements.seatResultList.innerHTML = seatScores.map((score, index) => {
    const strength = Math.max(4, ((TOTAL_SEATS + 1 - score.average) / TOTAL_SEATS) * 100);
    return `
      <div class="result-row">
        <span class="result-rank">${index + 1}위</span>
        <span class="result-label">${score.seat}번 자리</span>
        <span class="result-bar" aria-hidden="true"><span style="width:${strength.toFixed(1)}%"></span></span>
        <span class="result-value">평균 ${score.average.toFixed(1)}위</span>
      </div>
    `;
  }).join("");

  const maxVotes = Math.max(1, ...noiseScores.map((score) => score.votes));
  elements.noiseResultList.className = "result-list";
  elements.noiseResultList.innerHTML = noiseScores.map((score, index) => `
    <div class="result-row">
      <span class="result-rank">${index + 1}위</span>
      <span class="result-label">${score.student}번 학생</span>
      <span class="result-bar" aria-hidden="true"><span style="width:${Math.max(2, (score.votes / maxVotes) * 100)}%"></span></span>
      <span class="result-value">${score.votes}표</span>
    </div>
  `).join("");

  elements.assignmentBody.innerHTML = noiseScores.map((studentScore, index) => {
    const seatScore = seatScores[index];
    return `
      <tr>
        <td>${index + 1}위</td>
        <td><strong>${studentScore.student}번 학생</strong></td>
        <td>${studentScore.votes}표</td>
        <td><strong>${seatScore.seat}번 자리</strong></td>
        <td>${index + 1}위 · 평균 ${seatScore.average.toFixed(1)}</td>
      </tr>
    `;
  }).join("");
}

function showView(viewName) {
  if (viewName === "noise" && (!state.respondent || !isValidRanking(state.ranking))) {
    showToast("응답자 번호와 27개 자리 순위를 먼저 완성해 주세요.");
    viewName = "ranking";
  }

  state.currentView = viewName;
  elements.views.forEach((view) => {
    view.hidden = view.id !== `${viewName}-view`;
  });
  elements.steps.forEach((step) => {
    const isActive = step.dataset.view === viewName;
    step.classList.toggle("is-active", isActive);
    step.setAttribute("aria-current", isActive ? "step" : "false");
  });

  if (viewName === "noise") renderNoise();
  if (viewName === "results") renderResults();
  document.querySelector(".steps").scrollIntoView({ behavior: "smooth", block: "start" });
}

function startNewResponse() {
  state.respondent = null;
  state.ranking = [];
  state.noiseVote = null;
  elements.studentNumber.value = "";
  renderRanking();
  renderNoise();
  showView("ranking");
}

elements.studentNumber.addEventListener("change", () => {
  const selected = Number(elements.studentNumber.value);
  state.respondent = selected || null;
  const savedResponse = state.data.responses[selected];
  state.ranking = savedResponse ? [...savedResponse.ranking] : [];
  state.noiseVote = savedResponse ? savedResponse.noiseVote : null;
  renderRanking();
  renderNoise();
  if (savedResponse) showToast(`${selected}번의 기존 응답을 불러왔습니다.`);
});

elements.seatGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".seat");
  if (!button) return;
  const seat = Number(button.dataset.seat);
  const existingIndex = state.ranking.indexOf(seat);

  if (existingIndex >= 0) {
    state.ranking.splice(existingIndex, 1);
  } else if (state.ranking.length < TOTAL_SEATS) {
    state.ranking.push(seat);
  }
  renderRanking();
});

elements.resetRanking.addEventListener("click", () => {
  state.ranking = [];
  renderRanking();
  showToast("자리 순위를 다시 선택할 수 있어요.");
});

elements.nextStep.addEventListener("click", () => showView("noise"));
elements.backToRanking.addEventListener("click", () => showView("ranking"));

elements.noiseGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".student-vote");
  if (!button || button.disabled) return;
  state.noiseVote = Number(button.dataset.student);
  renderNoise();
});

elements.submitResponse.addEventListener("click", () => {
  if (!state.respondent || !state.noiseVote || !isValidRanking(state.ranking)) {
    showToast("응답 내용을 모두 완성해 주세요.");
    return;
  }
  state.data.responses[state.respondent] = {
    ranking: [...state.ranking],
    noiseVote: state.noiseVote,
    submittedAt: new Date().toISOString(),
  };
  saveData();
  updateProgress();
  showView("results");
  showToast(`${state.respondent}번 응답을 이 기기에 저장했습니다.`);
});

elements.steps.forEach((step) => {
  step.addEventListener("click", () => showView(step.dataset.view));
});

elements.newResponse.addEventListener("click", startNewResponse);
elements.printResults.addEventListener("click", () => window.print());

elements.exportData.addEventListener("click", () => {
  const payload = JSON.stringify(state.data, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quiet-class-survey-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("설문 데이터를 JSON 파일로 백업했습니다.");
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
  const confirmed = window.confirm(`저장된 ${responseCount}명의 응답을 모두 삭제할까요? 먼저 JSON 백업을 권장합니다.`);
  if (!confirmed) return;
  state.data = emptyData();
  saveData();
  updateProgress();
  startNewResponse();
  showToast("모든 설문 데이터를 초기화했습니다.");
});

buildStudentOptions();
buildSeats();
buildNoiseGrid();
renderRanking();
renderNoise();
updateProgress();
