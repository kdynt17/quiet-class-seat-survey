const TOTAL_STUDENTS = 27;
const TOTAL_SEATS = 27;
const APPS_SCRIPT_URL = String(window.SEAT_SURVEY_CONFIG?.appsScriptUrl || "").trim();

const state = {
  respondent: null,
  ranking: [],
  responses: {},
  currentView: "ranking",
  syncing: false,
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
  syncState: document.querySelector("#sync-state"),
  syncCopy: document.querySelector("#sync-copy"),
  resultsStatus: document.querySelector("#results-status"),
  summaryResponses: document.querySelector("#summary-responses"),
  summaryPercent: document.querySelector("#summary-percent"),
  mostDislikedSeat: document.querySelector("#most-disliked-seat"),
  mostDislikedVotes: document.querySelector("#most-disliked-votes"),
  avoidTopThree: document.querySelector("#avoid-top-three"),
  seatResultList: document.querySelector("#seat-result-list"),
  studentStatusGrid: document.querySelector("#student-status-grid"),
  newResponse: document.querySelector("#new-response"),
  refreshResults: document.querySelector("#refresh-results"),
  printResults: document.querySelector("#print-results"),
  lastSync: document.querySelector("#last-sync"),
  chartStatus: document.querySelector("#chart-status"),
  chartResponseCount: document.querySelector("#chart-response-count"),
  chartTopSeat: document.querySelector("#chart-top-seat"),
  chartTopDetail: document.querySelector("#chart-top-detail"),
  chartSeatGrid: document.querySelector("#chart-seat-grid"),
  refreshChart: document.querySelector("#refresh-chart"),
  printChart: document.querySelector("#print-chart"),
  chartLastSync: document.querySelector("#chart-last-sync"),
  toast: document.querySelector("#toast"),
  viewTriggers: [...document.querySelectorAll("[data-view]")],
  views: [...document.querySelectorAll(".view-section")],
};

function isConfigured() {
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(APPS_SCRIPT_URL);
}

function isValidRanking(ranking) {
  return Array.isArray(ranking)
    && ranking.length === TOTAL_SEATS
    && new Set(ranking).size === TOTAL_SEATS
    && ranking.every((seat) => Number.isInteger(seat) && seat >= 1 && seat <= TOTAL_SEATS);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => elements.toast.classList.remove("is-visible"), 3000);
}

function setSyncStatus(mode, message) {
  elements.syncState.className = `save-state is-${mode}`;
  elements.syncCopy.textContent = message;
}

function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    if (!isConfigured()) {
      reject(new Error("Apps Script 웹 앱 주소가 아직 설정되지 않았습니다."));
      return;
    }

    const callbackName = `__seatSurvey_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({ action, callback: callbackName, _: Date.now().toString(), ...params });
    let timeoutId;

    const cleanup = () => {
      clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (payload) => {
      cleanup();
      if (payload?.ok) resolve(payload);
      else reject(new Error(payload?.error || "Google Sheets 요청에 실패했습니다."));
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("Apps Script에 연결하지 못했습니다."));
    };
    script.src = `${APPS_SCRIPT_URL}?${query.toString()}`;
    document.head.append(script);
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Apps Script 응답 시간이 초과되었습니다."));
    }, 15000);
  });
}

function normalizeResponses(items) {
  const normalized = {};
  (Array.isArray(items) ? items : []).forEach((item) => {
    const student = Number(item.student);
    const ranking = Array.isArray(item.ranking) ? item.ranking.map(Number) : [];
    if (student >= 1 && student <= TOTAL_STUDENTS && isValidRanking(ranking)) {
      normalized[student] = { ranking, submittedAt: String(item.submittedAt || "") };
    }
  });
  return normalized;
}

async function refreshCloudData({ quiet = false } = {}) {
  if (!isConfigured()) {
    setSyncStatus("offline", "Apps Script 배포 대기");
    elements.progressCopy.textContent = "Apps Script 배포 후 공동 저장이 시작돼요";
    return false;
  }

  state.syncing = true;
  setSyncStatus("connecting", "Google Sheets 동기화 중");
  elements.refreshResults.disabled = true;
  elements.refreshChart.disabled = true;
  try {
    const payload = await jsonp("results");
    state.responses = normalizeResponses(payload.responses);
    updateProgress();
    renderResults();
    renderChart();
    const now = new Date();
    const syncMessage = `${now.toLocaleString("ko-KR")}에 Google Sheets와 동기화했습니다.`;
    elements.lastSync.textContent = syncMessage;
    elements.chartLastSync.textContent = syncMessage;
    setSyncStatus("online", "Google Sheets 연결됨");
    if (!quiet) showToast("Google Sheets의 최신 응답을 불러왔습니다.");
    return true;
  } catch (error) {
    console.error(error);
    setSyncStatus("error", "Sheets 연결 확인 필요");
    if (!quiet) showToast(error.message);
    return false;
  } finally {
    state.syncing = false;
    elements.refreshResults.disabled = false;
    elements.refreshChart.disabled = false;
  }
}

function buildStudentOptions() {
  elements.studentNumber.insertAdjacentHTML(
    "beforeend",
    Array.from({ length: TOTAL_STUDENTS }, (_, index) => `<option value="${index + 1}">${index + 1}번</option>`).join(""),
  );
}

function buildSeats() {
  elements.seatGrid.innerHTML = Array.from({ length: TOTAL_SEATS }, (_, index) => {
    const seat = index + 1;
    return `
      <button class="seat" type="button" data-seat="${seat}" aria-label="${seat}번 자리 선택">
        <span>자리</span><strong>${seat}</strong><i class="rank-badge" aria-hidden="true"></i>
      </button>`;
  }).join("");
}

function renderRanking() {
  document.querySelectorAll(".seat").forEach((seatButton) => {
    const seat = Number(seatButton.dataset.seat);
    const rankIndex = state.ranking.indexOf(seat);
    seatButton.classList.toggle("is-ranked", rankIndex >= 0);
    seatButton.setAttribute("aria-pressed", String(rankIndex >= 0));
    seatButton.querySelector(".rank-badge").textContent = rankIndex >= 0 ? `${rankIndex + 1}` : "";
  });

  elements.chosenCount.textContent = state.ranking.length;
  elements.remainingCount.textContent = TOTAL_SEATS - state.ranking.length;
  elements.nextRank.textContent = state.ranking.length === TOTAL_SEATS ? "완료" : `${state.ranking.length + 1}순위`;
  elements.submitPreference.disabled = state.syncing || state.ranking.length !== TOTAL_SEATS || !state.respondent;
  const savedResponse = state.respondent ? state.responses[state.respondent] : null;
  elements.submitPreference.firstChild.textContent = savedResponse ? "수정한 응답을 시트에 저장 " : "Google Sheets에 저장 ";

  if (!state.ranking.length) {
    elements.rankingList.innerHTML = '<li class="empty-ranking">책상을 누르면 기피 순위가 여기에 표시돼요.</li>';
    return;
  }
  elements.rankingList.innerHTML = state.ranking.map((seat, index) => `
    <li><span class="rank-number">${index + 1}순위</span><span class="seat-name">${seat}번 자리</span></li>
  `).join("");
  elements.rankingList.scrollTop = elements.rankingList.scrollHeight;
}

function updateProgress() {
  const count = Object.keys(state.responses).length;
  const percent = Math.round((count / TOTAL_STUDENTS) * 100);
  elements.responseCount.textContent = count;
  elements.progressBar.style.width = `${percent}%`;
  elements.progressCopy.textContent = count === 0
    ? "첫 번째 응답을 기다리고 있어요"
    : count === TOTAL_STUDENTS
      ? "27명의 기피 자리 순위가 모두 모였어요"
      : `${TOTAL_STUDENTS - count}명의 응답이 더 필요해요`;
}

function calculateResults() {
  const students = Object.keys(state.responses).map(Number).sort((a, b) => a - b);
  const seatStats = Array.from({ length: TOTAL_SEATS }, (_, index) => ({
    seat: index + 1,
    firstDislikeVotes: 0,
    totalRank: 0,
    count: 0,
    averageRank: Infinity,
  }));

  students.forEach((student) => {
    const { ranking } = state.responses[student];
    seatStats[ranking[0] - 1].firstDislikeVotes += 1;
    ranking.forEach((seat, rankIndex) => {
      seatStats[seat - 1].totalRank += rankIndex + 1;
      seatStats[seat - 1].count += 1;
    });
  });

  seatStats.forEach((stat) => {
    stat.averageRank = stat.count ? stat.totalRank / stat.count : Infinity;
  });
  seatStats.sort((a, b) => b.firstDislikeVotes - a.firstDislikeVotes || a.averageRank - b.averageRank || a.seat - b.seat);
  return { students, seatStats };
}

function renderResults() {
  const { students, seatStats } = calculateResults();
  const count = students.length;
  const percent = Math.round((count / TOTAL_STUDENTS) * 100);
  const completed = new Set(students);

  elements.summaryResponses.textContent = count;
  elements.summaryPercent.textContent = `${percent}% 완료`;
  elements.resultsStatus.textContent = count === TOTAL_STUDENTS
    ? "27명의 응답을 모두 반영한 최종 기피 자리 추천입니다."
    : `${count}명의 응답을 반영한 현재 결과입니다. 응답이 추가되면 추천도 달라질 수 있어요.`;
  elements.studentStatusGrid.innerHTML = Array.from({ length: TOTAL_STUDENTS }, (_, index) => {
    const student = index + 1;
    const done = completed.has(student);
    return `<span class="student-status ${done ? "is-done" : ""}"><b>${student}</b><small>${done ? "완료" : "대기"}</small></span>`;
  }).join("");

  if (!count) {
    elements.mostDislikedSeat.textContent = "-";
    elements.mostDislikedVotes.textContent = "응답을 기다리는 중";
    elements.avoidTopThree.textContent = "-";
    elements.seatResultList.className = "result-list empty-result";
    elements.seatResultList.textContent = "아직 저장된 응답이 없습니다.";
    return;
  }

  const topSeat = seatStats[0];
  elements.mostDislikedSeat.textContent = `${topSeat.seat}번 자리`;
  elements.mostDislikedVotes.textContent = `가장 싫음 ${topSeat.firstDislikeVotes}표 · 평균 ${topSeat.averageRank.toFixed(1)}순위`;
  elements.avoidTopThree.textContent = seatStats.slice(0, 3).map((stat) => stat.seat).join(" · ");

  const maxVotes = Math.max(1, ...seatStats.map((stat) => stat.firstDislikeVotes));
  elements.seatResultList.className = "result-list";
  elements.seatResultList.innerHTML = seatStats.map((stat, index) => `
    <div class="result-row">
      <span class="result-rank">${index + 1}위</span>
      <span class="result-label">${stat.seat}번 자리</span>
      <span class="result-bar" aria-hidden="true"><span style="width:${Math.max(2, (stat.firstDislikeVotes / maxVotes) * 100)}%"></span></span>
      <span class="result-value">1순위 ${stat.firstDislikeVotes}표 · 평균 ${stat.averageRank.toFixed(1)}</span>
    </div>
  `).join("");
}

function renderChart() {
  const { students, seatStats } = calculateResults();
  const count = students.length;

  elements.chartResponseCount.textContent = count;
  elements.chartStatus.textContent = count === TOTAL_STUDENTS
    ? "27명의 응답을 모두 반영한 최종 기피 자리표입니다."
    : count
      ? `${count}명의 응답을 반영한 현재 자리표입니다. 새 응답에 따라 순위가 달라질 수 있어요.`
      : "아직 저장된 응답이 없어 자리 번호만 표시합니다.";

  if (!count) {
    elements.chartTopSeat.textContent = "-";
    elements.chartTopDetail.textContent = "응답을 기다리는 중";
    elements.chartSeatGrid.innerHTML = Array.from({ length: TOTAL_SEATS }, (_, index) => `
      <article class="stat-seat is-pending" aria-label="${index + 1}번 자리, 집계 대기">
        <span class="stat-rank">집계 대기</span>
        <strong>${index + 1}</strong>
        <span class="stat-votes">1순위 0표</span>
        <small>평균 -</small>
      </article>
    `).join("");
    return;
  }

  const topSeat = seatStats[0];
  elements.chartTopSeat.textContent = `${topSeat.seat}번 자리`;
  elements.chartTopDetail.textContent = `1순위 ${topSeat.firstDislikeVotes}표 · 평균 ${topSeat.averageRank.toFixed(1)}순위`;

  const statsBySeat = new Map(seatStats.map((stat, index) => [stat.seat, { ...stat, avoidRank: index + 1 }]));
  elements.chartSeatGrid.innerHTML = Array.from({ length: TOTAL_SEATS }, (_, index) => {
    const seat = index + 1;
    const stat = statsBySeat.get(seat);
    const heatClass = stat.avoidRank <= 5 ? "heat-top" : stat.avoidRank <= 14 ? "heat-mid" : "heat-low";
    const label = `${seat}번 자리, 기피 ${stat.avoidRank}위, 1순위 ${stat.firstDislikeVotes}표, 평균 ${stat.averageRank.toFixed(1)}순위`;
    return `
      <article class="stat-seat ${heatClass}" aria-label="${label}">
        <span class="stat-rank">기피 ${stat.avoidRank}위</span>
        <strong>${seat}</strong>
        <span class="stat-votes">1순위 ${stat.firstDislikeVotes}표</span>
        <small>평균 ${stat.averageRank.toFixed(1)}위</small>
      </article>
    `;
  }).join("");
}

function showView(viewName) {
  state.currentView = viewName;
  elements.views.forEach((view) => { view.hidden = view.id !== `${viewName}-view`; });
  elements.viewTriggers.forEach((trigger) => {
    const active = trigger.dataset.view === viewName;
    trigger.classList.toggle("is-active", active);
    trigger.setAttribute("aria-current", active ? (trigger.classList.contains("step") ? "step" : "page") : "false");
  });
  if (viewName === "results" || viewName === "chart") {
    if (viewName === "results") renderResults();
    else renderChart();
    refreshCloudData({ quiet: true });
  }
  document.querySelector(".steps").scrollIntoView({ behavior: "smooth", block: "start" });
}

function startNewResponse() {
  state.respondent = null;
  state.ranking = [];
  elements.studentNumber.value = "";
  renderRanking();
  showView("ranking");
}

elements.studentNumber.addEventListener("change", () => {
  const selected = Number(elements.studentNumber.value);
  state.respondent = selected || null;
  const saved = state.responses[selected];
  state.ranking = saved ? [...saved.ranking] : [];
  renderRanking();
  if (saved) showToast(`${selected}번의 기존 기피 순위를 불러왔습니다.`);
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
  showToast("기피 순위를 다시 선택할 수 있어요.");
});

elements.submitPreference.addEventListener("click", async () => {
  if (!state.respondent || !isValidRanking(state.ranking)) {
    showToast("응답자 번호와 27개 자리 순위를 모두 완성해 주세요.");
    return;
  }
  if (!isConfigured()) {
    showToast("Apps Script 배포가 끝난 뒤 저장할 수 있습니다.");
    return;
  }

  const student = state.respondent;
  elements.submitPreference.disabled = true;
  state.syncing = true;
  setSyncStatus("connecting", "Google Sheets에 저장 중");
  try {
    await jsonp("submit", { student: String(student), ranking: state.ranking.join(",") });
    await refreshCloudData({ quiet: true });
    showView("results");
    showToast(`${student}번의 기피 순위를 Google Sheets에 저장했습니다.`);
  } catch (error) {
    console.error(error);
    setSyncStatus("error", "Sheets 저장 실패");
    showToast(error.message);
  } finally {
    state.syncing = false;
    renderRanking();
  }
});

elements.viewTriggers.forEach((trigger) => trigger.addEventListener("click", () => showView(trigger.dataset.view)));
elements.newResponse.addEventListener("click", startNewResponse);
elements.refreshResults.addEventListener("click", () => refreshCloudData());
elements.printResults.addEventListener("click", () => window.print());
elements.refreshChart.addEventListener("click", () => refreshCloudData());
elements.printChart.addEventListener("click", () => window.print());

buildStudentOptions();
buildSeats();
renderRanking();
updateProgress();
renderResults();
renderChart();
refreshCloudData({ quiet: true });
