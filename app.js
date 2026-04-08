const STORAGE_KEY = "tomokore_game_state_v1";

const MAIN_CHARACTER_IDS = ["student_01", "student_02", "student_03", "student_04", "student_05"];

const EVENTS = [
  {
    id: "event_001",
    name: "席替え",
    day: 3,
    description: "席替えで周囲の空気が少しソワソワしている。",
    effects: { friendlinessModifier: -2, pressureToleranceModifier: -3 },
  },
  {
    id: "event_002",
    name: "文化祭準備",
    day: 5,
    description: "準備で忙しく、クラス全体が少しピリついている。",
    effects: { friendlinessModifier: -5, pressureToleranceModifier: -10 },
  },
  {
    id: "event_003",
    name: "テスト期間",
    day: 8,
    description: "全員余裕がなく、雑談が刺さりにくい。",
    effects: { friendlinessModifier: -4, pressureToleranceModifier: -4 },
  },
];

const state = {
  playerName: "",
  currentDay: 1,
  currentEventId: "none",
  students: [],
  eventsApplied: {},
  selectedStudentId: null,
  lastResult: null,
};

const traitHints = {
  calm: "落ち着いた会話を好む",
  cheerful: "明るいテンションに乗りやすい",
  strict: "圧に敏感で丁寧さ重視",
  witty: "ユーモアがあると好反応",
  careful: "距離感に慎重",
};

function createDefaultStudents() {
  const baseNames = [
    "佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "清水", "斎藤", "阿部", "森", "池田", "橋本", "山崎", "石川", "前田", "藤田", "小川", "後藤", "岡田", "長谷川", "村上", "近藤", "石井", "坂本", "遠藤", "青木", "藤井", "西村", "福田", "太田", "三浦", "岡本",
  ];

  return baseNames.slice(0, 44).map((name, idx) => {
    const id = `student_${String(idx + 1).padStart(2, "0")}`;
    const isMainCharacter = MAIN_CHARACTER_IDS.includes(id);
    const personality = ["calm", "cheerful", "strict", "witty", "careful"][idx % 5];

    return {
      id,
      name,
      role: isMainCharacter ? "主要キャラ" : "クラスメイト",
      isMainCharacter,
      affection: Math.floor(Math.random() * 11) - 5,
      talkCount: 0,
      traits: {
        personality,
        friendliness: 45 + (idx % 20),
        caution: 30 + (idx % 30),
        humor: 25 + ((idx * 7) % 50),
        pressureTolerance: 20 + ((idx * 11) % 50),
        syntaxTolerance: {
          ojisan: 15 + ((idx * 13) % 70),
          mother: 10 + ((idx * 17) % 60),
          chappy: 20 + ((idx * 19) % 70),
        },
      },
    };
  });
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);
    return true;
  } catch {
    return false;
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      playerName: state.playerName,
      currentDay: state.currentDay,
      currentEventId: state.currentEventId,
      students: state.students,
      eventsApplied: state.eventsApplied,
    })
  );
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  state.playerName = "";
  state.currentDay = 1;
  state.currentEventId = "none";
  state.students = [];
  state.eventsApplied = {};
  state.selectedStudentId = null;
  state.lastResult = null;
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function syntaxTransform(message, syntax) {
  const trimmed = message.trim();

  if (syntax === "ojisan") {
    const emoji = ["😊", "✨", "👍", "😆"][Math.floor(Math.random() * 4)];
    return `${trimmed}〜！${emoji} ${emoji} ところで今なにしてる〜？`;
  }
  if (syntax === "mother") {
    return `${trimmed}って言ってるよね？？ なんでそうなるの！？ちゃんとして！！`;
  }
  return `それってすごくいいね！${trimmed}なら絶対いけるよ〜！応援してる🌟`;
}

function evaluateConversation(student, message, syntax) {
  const len = message.trim().length;
  const exclamations = (message.match(/[!?！？]/g) || []).length;
  const tolerance = student.traits.syntaxTolerance[syntax];
  const currentEvent = EVENTS.find((e) => e.id === state.currentEventId);
  const eventPressure = currentEvent?.effects.pressureToleranceModifier ?? 0;

  let delta = 0;

  delta += Math.round((tolerance - 50) / 10);
  if (len < 4) delta -= 2;
  else if (len <= 30) delta += 2;
  else if (len > 80) delta -= 2;

  if (exclamations >= 3 && student.traits.pressureTolerance + eventPressure < 40) {
    delta -= 4;
  }

  if (syntax === "chappy" && student.traits.personality === "cheerful") delta += 3;
  if (syntax === "mother" && student.traits.personality === "strict") delta -= 3;
  if (syntax === "ojisan" && student.traits.caution > 50) delta -= 3;

  if (student.affection > 40) delta += 1;
  if (student.affection < -40) delta -= 1;

  delta = Math.max(-15, Math.min(15, delta));
  const updatedAffection = Math.max(-100, Math.min(100, student.affection + delta));

  let mood = "微妙";
  let moodClass = "meh";
  if (delta >= 4) {
    mood = "良い";
    moodClass = "good";
  } else if (delta <= -4) {
    mood = "最悪";
    moodClass = "bad";
  }

  return { delta, updatedAffection, mood, moodClass };
}

function maybeAdvanceDay() {
  state.currentDay += 1;
  const todayEvent = EVENTS.find((e) => e.day === state.currentDay && !state.eventsApplied[e.id]);

  if (todayEvent) {
    state.currentEventId = todayEvent.id;
    state.eventsApplied[todayEvent.id] = true;
    saveState();
    document.getElementById("eventTitle").textContent = todayEvent.name;
    document.getElementById("eventDescription").textContent = todayEvent.description;
    document.getElementById(
      "eventImpact"
    ).textContent = `影響: friendliness ${todayEvent.effects.friendlinessModifier}, pressureTolerance ${todayEvent.effects.pressureToleranceModifier}`;
    showScreen("eventScreen");
    return true;
  }

  saveState();
  return false;
}

function renderMain() {
  document.getElementById("playerNameLabel").textContent = state.playerName;
  document.getElementById("dayLabel").textContent = state.currentDay;

  const eventLabel =
    EVENTS.find((e) => e.id === state.currentEventId)?.name ?? "通常日";
  document.getElementById("eventLabel").textContent = eventLabel;

  const container = document.getElementById("studentsList");
  container.innerHTML = "";

  state.students.forEach((student) => {
    const card = document.createElement("article");
    card.className = `student-card ${student.isMainCharacter ? "main" : ""}`;
    card.innerHTML = `
      <h3>${student.name}</h3>
      <p>${student.role}</p>
      <p>好感度: ${student.affection}</p>
      <p>空気影響: ${student.traits.friendliness}</p>
      <button data-student-id="${student.id}">話しかける</button>
    `;
    container.appendChild(card);
  });
}

function openTalkScreen(studentId) {
  state.selectedStudentId = studentId;
  const student = state.students.find((s) => s.id === studentId);
  if (!student) return;

  document.getElementById("talkTargetName").textContent = student.name;
  document.getElementById("talkTargetHint").textContent = traitHints[student.traits.personality];
  document.getElementById("messageInput").value = "";
  document.getElementById("charCounter").textContent = "0 / 120";

  showScreen("talkScreen");
}

function handleSendConversation() {
  const message = document.getElementById("messageInput").value.trim();
  if (!message) {
    alert("メッセージを入力してください");
    return;
  }

  const syntax = document.querySelector('input[name="syntax"]:checked').value;
  const student = state.students.find((s) => s.id === state.selectedStudentId);
  if (!student) return;

  const converted = syntaxTransform(message, syntax);
  const result = evaluateConversation(student, message, syntax);

  student.affection = result.updatedAffection;
  student.talkCount += 1;

  if (student.talkCount % 3 === 0) {
    student.traits.caution = Math.max(10, student.traits.caution - 1);
    student.traits.syntaxTolerance[syntax] = Math.min(100, student.traits.syntaxTolerance[syntax] + 1);
  }

  state.lastResult = {
    original: message,
    converted,
    delta: result.delta,
    updatedAffection: result.updatedAffection,
    mood: result.mood,
    moodClass: result.moodClass,
  };

  saveState();

  document.getElementById("resultOriginal").textContent = state.lastResult.original;
  document.getElementById("resultConverted").textContent = state.lastResult.converted;
  document.getElementById("resultDelta").textContent =
    state.lastResult.delta >= 0 ? `+${state.lastResult.delta}` : `${state.lastResult.delta}`;
  document.getElementById("resultTotal").textContent = state.lastResult.updatedAffection;

  const moodEl = document.getElementById("resultMood");
  moodEl.textContent = state.lastResult.mood;
  moodEl.className = `mood ${state.lastResult.moodClass}`;

  showScreen("resultScreen");
}

function init() {
  const hasSave = loadState();
  const continueBtn = document.getElementById("continueBtn");
  continueBtn.disabled = !hasSave;

  document.querySelectorAll("button[data-action='new']").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.students = createDefaultStudents();
      state.currentDay = 1;
      state.currentEventId = "none";
      state.eventsApplied = {};
      showScreen("setupScreen");
    });
  });

  continueBtn.addEventListener("click", () => {
    if (!loadState()) return;
    renderMain();
    showScreen("mainScreen");
  });

  document.querySelectorAll("button[data-action='reset']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("保存データをリセットしますか？")) return;
      resetState();
      document.getElementById("continueBtn").disabled = true;
      showScreen("titleScreen");
    });
  });

  document.getElementById("setupSubmitBtn").addEventListener("click", () => {
    const name = document.getElementById("playerNameInput").value.trim();
    if (!name) {
      alert("プレイヤー名を入力してください");
      return;
    }

    state.playerName = name;
    if (!state.students.length) state.students = createDefaultStudents();
    saveState();
    renderMain();
    showScreen("mainScreen");
  });

  document.getElementById("studentsList").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-student-id]");
    if (!button) return;
    openTalkScreen(button.dataset.studentId);
  });

  document.getElementById("messageInput").addEventListener("input", (event) => {
    document.getElementById("charCounter").textContent = `${event.target.value.length} / 120`;
  });

  document.getElementById("sendBtn").addEventListener("click", handleSendConversation);

  document.getElementById("resultNextBtn").addEventListener("click", () => {
    const openedEvent = maybeAdvanceDay();
    if (!openedEvent) {
      renderMain();
      showScreen("mainScreen");
    }
  });

  document.getElementById("eventNextBtn").addEventListener("click", () => {
    renderMain();
    showScreen("mainScreen");
  });

  document.querySelectorAll("button[data-action='openSettings']").forEach((btn) => {
    btn.addEventListener("click", () => showScreen("settingsScreen"));
  });

  document.querySelectorAll("button[data-back='title']").forEach((btn) => {
    btn.addEventListener("click", () => showScreen("titleScreen"));
  });

  document.querySelectorAll("button[data-back='main']").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderMain();
      showScreen("mainScreen");
    });
  });
}

init();
