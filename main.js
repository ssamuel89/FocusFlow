let tasks = JSON.parse(localStorage.getItem('focusflow_v2_tasks')) || [];
let timerInterval;
let timeLeft = 25 * 60;
let isTimerRunning = false;
let currentFocusTaskId = null;
let activeFilter = 'all';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    updateDate();
    renderTasks();
    setupEventListeners();
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
});

function setupEventListeners() {
    document.getElementById('addTaskBtn').addEventListener('click', addTask);
    document.getElementById('taskInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importFile').addEventListener('change', importData);
    document.getElementById('closeFocusBtn').addEventListener('click', exitFocusMode);
    document.getElementById('timerBtn').addEventListener('click', toggleTimer);
    document.getElementById('completeFocusBtn').addEventListener('click', completeFocusTask);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => filterTasks(e.target.dataset.filter, e.target));
    });
}

// --- Core Functions ---
function updateDate() {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', options);
}

function showMessage(text) {
    const box = document.getElementById('messageBox');
    box.textContent = text;
    box.style.opacity = '1';
    setTimeout(() => box.style.opacity = '0', 2500);
}

function addTask() {
    const input = document.getElementById('taskInput');
    const energy = document.querySelector('.energy-radio:checked').value;
    
    if (!input.value.trim()) {
        showMessage("Write something first! ✍️");
        return;
    }

    const newTask = {
        id: Date.now(),
        text: input.value,
        energy: energy,
        completed: false,
        subtasks: [],
        createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    saveAndRender();
    input.value = '';
    showMessage("Captured! Go focus on something else now. 🧠");
}

window.toggleTask = (id) => {
    tasks = tasks.map(t => t.id === id ? {...t, completed: !t.completed} : t);
    saveAndRender();
};

window.deleteTask = (id) => {
    tasks = tasks.filter(t => t.id !== id);
    saveAndRender();
};

window.addSubtask = (taskId) => {
    const input = document.getElementById(`subInput-${taskId}`);
    if (!input.value.trim()) return;

    tasks = tasks.map(t => {
        if (t.id === taskId) {
            return {
                ...t,
                subtasks: [...t.subtasks, { id: Date.now(), text: input.value, completed: false }]
            };
        }
        return t;
    });
    saveAndRender();
};

window.toggleSubtask = (taskId, subId) => {
    tasks = tasks.map(t => {
        if (t.id === taskId) {
            const newSubtasks = t.subtasks.map(s => s.id === subId ? {...s, completed: !s.completed} : s);
            return { ...t, subtasks: newSubtasks };
        }
        return t;
    });
    saveAndRender();
    if (currentFocusTaskId === taskId) renderFocusSubtasks();
};

window.deleteSubtask = (taskId, subId) => {
    tasks = tasks.map(t => {
        if (t.id === taskId) {
            return { ...t, subtasks: t.subtasks.filter(s => s.id !== subId) };
        }
        return t;
    });
    saveAndRender();
    if (currentFocusTaskId === taskId) renderFocusSubtasks();
};

function saveAndRender() {
    localStorage.setItem('focusflow_v2_tasks', JSON.stringify(tasks));
    renderTasks(activeFilter);
}

function renderTasks(filter = 'all') {
    activeFilter = filter;
    const list = document.getElementById('taskList');
    const empty = document.getElementById('emptyState');
    list.innerHTML = '';

    const filtered = tasks.filter(t => filter === 'all' || t.energy === filter);

    if (filtered.length === 0) {
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        filtered.forEach(task => {
            const card = document.createElement('div');
            card.className = `task-card bg-white p-5 rounded-2xl shadow-sm space-y-4 energy-${task.energy} ${task.completed ? 'opacity-60' : ''}`;
            
            const subCount = task.subtasks.length;
            const doneCount = task.subtasks.filter(s => s.completed).length;

            card.innerHTML = `
                <div class="flex items-start gap-4">
                    <input type="checkbox" ${task.completed ? 'checked' : ''} 
                        onchange="toggleTask(${task.id})"
                        class="mt-1 w-6 h-6 rounded-full border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                    <div class="flex-grow">
                        <p class="font-semibold text-slate-800 ${task.completed ? 'line-through text-slate-400' : ''}">${task.text}</p>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">${task.energy} energy</span>
                            ${subCount > 0 ? `<span class="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">${doneCount}/${subCount} steps</span>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="enterFocusMode(${task.id})" class="p-2 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">🎯</button>
                        <button onclick="deleteTask(${task.id})" class="p-2 text-slate-300 hover:text-red-500">🗑️</button>
                    </div>
                </div>
                <div class="pl-10 space-y-2">
                    <div id="subs-${task.id}" class="space-y-1">
                        ${task.subtasks.map(s => `
                            <div class="flex items-center gap-2 group">
                                <input type="checkbox" ${s.completed ? 'checked' : ''} onchange="toggleSubtask(${task.id}, ${s.id})" class="w-4 h-4 rounded border-slate-300 text-indigo-500">
                                <span class="text-sm ${s.completed ? 'line-through text-slate-400' : 'text-slate-600'}">${s.text}</span>
                                <button onclick="deleteSubtask(${task.id}, ${s.id})" class="opacity-0 group-hover:opacity-100 text-[10px] text-red-300 ml-auto">Delete</button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="flex items-center gap-2 mt-2 pt-2 border-t border-slate-50">
                        <input type="text" id="subInput-${task.id}" placeholder="Next tiny step..." class="text-xs w-full bg-slate-50 p-2 rounded-lg outline-none focus:bg-indigo-50 transition-colors" onkeypress="if(event.key === 'Enter') addSubtask(${task.id})">
                        <button onclick="addSubtask(${task.id})" class="text-xs font-bold text-indigo-500 hover:text-indigo-700">Add</button>
                    </div>
                </div>`;
            list.appendChild(card);
        });
    }
}

function filterTasks(energy, target) {
    activeFilter = energy;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-slate-800', 'text-white');
        btn.classList.add('bg-white', 'text-slate-600', 'border', 'border-slate-200');
    });
    target.classList.remove('bg-white', 'text-slate-600', 'border', 'border-slate-200');
    target.classList.add('bg-slate-800', 'text-white');
    renderTasks(energy);
}

// --- Focus Mode ---
window.enterFocusMode = (id) => {
    const task = tasks.find(t => t.id === id);
    currentFocusTaskId = id;
    document.getElementById('focusTaskTitle').textContent = task.text;
    const tag = document.getElementById('focusEnergyTag');
    tag.textContent = `${task.energy} energy`;
    const colors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
    const bgColors = { low: '#ecfdf5', medium: '#fffbeb', high: '#fef2f2' };
    tag.style.color = colors[task.energy];
    tag.style.backgroundColor = bgColors[task.energy];
    renderFocusSubtasks();
    document.getElementById('focusOverlay').classList.remove('hidden');
    document.getElementById('focusOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    resetTimer();
};

function renderFocusSubtasks() {
    const task = tasks.find(t => t.id === currentFocusTaskId);
    const container = document.getElementById('focusSubtasksContainer');
    const list = document.getElementById('focusSubtaskList');
    if (!task.subtasks || task.subtasks.length === 0) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    list.innerHTML = task.subtasks.map(s => `
        <div class="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
            <input type="checkbox" ${s.completed ? 'checked' : ''} onchange="toggleSubtask(${task.id}, ${s.id})" class="w-5 h-5 rounded-full border-2 border-slate-200 text-emerald-500">
            <span class="font-medium ${s.completed ? 'line-through text-slate-300' : 'text-slate-700'}">${s.text}</span>
        </div>`).join('');
}

function exitFocusMode() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    document.getElementById('focusOverlay').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function toggleTimer() {
    const btn = document.getElementById('timerBtn');
    if (isTimerRunning) {
        clearInterval(timerInterval);
        btn.textContent = 'Resume Timer';
        btn.className = "flex-1 bg-amber-500 text-white px-6 py-4 rounded-2xl font-bold";
    } else {
        startTimer();
        btn.textContent = 'Pause Timer';
        btn.className = "flex-1 bg-slate-800 text-white px-6 py-4 rounded-2xl font-bold";
    }
    isTimerRunning = !isTimerRunning;
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            notifySessionEnd();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    document.getElementById('timerDisplay').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const ring = document.getElementById('timerRing');
    ring.style.strokeDashoffset = 471 - (timeLeft / (25 * 60)) * 471;
}

function resetTimer() {
    timeLeft = 25 * 60;
    updateTimerDisplay();
    const btn = document.getElementById('timerBtn');
    btn.textContent = 'Start Timer';
    btn.className = "flex-1 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold";
}

function completeFocusTask() {
    toggleTask(currentFocusTaskId);
    exitFocusMode();
    showMessage("One big win for the brain! 🏆");
}

function toggleTheme() {
    document.documentElement.classList.toggle('dark');
}

// --- Data Management ---
function exportData() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `focusflow-tasks-${new Date().toISOString().split('T')[0]}.json`);
    link.click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            tasks = JSON.parse(e.target.result);
            saveAndRender();
            showMessage("Imported! 🧠");
        } catch {
            showMessage("Invalid file! ❌");
        }
    };
    reader.readAsText(file);
}