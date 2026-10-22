const STORAGE_KEY = 'smart_notes_v1';
const THEME_KEY = 'smart_notes_theme';
const MODE_KEY = 'smart_notes_view_mode';
const ALLOWED_CATEGORIES = ['Работа', 'Личное', 'Идеи', 'Срочно'];

const defaultNotes = [
  {
    id: Date.now(),
    title: 'Добро пожаловать в Умные Заметки PRO ⚡',
    content: [
      '# Обновлённое рабочее пространство',
      'Теперь ваш блокнот работает как полноценное **PWA-приложение** с защитой от XSS, интерактивным Markdown и умным импортом бэкапов.',
      '',
      '### Чек-лист возможностей:',
      '- [x] Импорт и слияние JSON-бэкапов (кнопка 📂 в левой панели)',
      '- [x] Безопасный рендеринг без уязвимостей `innerHTML`',
      '- [ ] Кликните прямо по этому чек-боксу в окне просмотра!',
      '☐ Поддерживаются и классические символы чек-боксов',
      '',
      '> Совет: используйте режим **🌗 Сплит** для одновременного редактирования и клика по задачам.'
    ].join('\n'),
    category: 'Идеи',
    pinned: true,
    updatedAt: new Date().toISOString()
  }
];

function sanitizeNote(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.slice(0, 300) : '';
  const content = typeof raw.content === 'string' ? raw.content : '';
  const category = ALLOWED_CATEGORIES.includes(raw.category) ? raw.category : 'Работа';
  const pinned = Boolean(raw.pinned);
  const parsedDate = Date.parse(raw.updatedAt);
  const updatedAt = !Number.isNaN(parsedDate) ? new Date(parsedDate).toISOString() : new Date().toISOString();
  const id = (typeof raw.id === 'number' || typeof raw.id === 'string') ? raw.id : (Date.now() + index);
  return { id, title, content, category, pinned, updatedAt };
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultNotes;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultNotes;
    const cleaned = parsed.map((item, idx) => sanitizeNote(item, idx)).filter(Boolean);
    return cleaned.length > 0 ? cleaned : defaultNotes;
  } catch (e) {
    console.error('Ошибка чтения localStorage:', e);
    return defaultNotes;
  }
}

let notes = loadNotes();
let activeNoteId = notes[0]?.id || null;
let currentFilterTag = 'Все';
let searchQuery = '';
let currentViewMode = localStorage.getItem(MODE_KEY) || 'split';

// DOM-элементы
const notesListEl = document.getElementById('notesList');
const noteTitleEl = document.getElementById('noteTitle');
const noteContentEl = document.getElementById('noteContent');
const markdownPreviewEl = document.getElementById('markdownPreview');
const workspaceEl = document.getElementById('workspace');
const noteCategoryEl = document.getElementById('noteCategory');
const pinNoteBtn = document.getElementById('pinNoteBtn');
const voiceBtn = document.getElementById('voiceBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const newNoteBtn = document.getElementById('newNoteBtn');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const tagsFilterEl = document.getElementById('tagsFilter');
const wordCountEl = document.getElementById('wordCount');
const tasksProgressEl = document.getElementById('tasksProgress');
const saveStatusEl = document.getElementById('saveStatus');
const themeBtn = document.getElementById('themeBtn');
const addTodoBtn = document.getElementById('addTodoBtn');
const addDateBtn = document.getElementById('addDateBtn');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
const downloadMdBtn = document.getElementById('downloadMdBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFileInput = document.getElementById('importFileInput');
const viewModeGroup = document.getElementById('viewModeGroup');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalTitle = document.getElementById('modalTitle');
const modalText = document.getElementById('modalText');
const modalActions = document.getElementById('modalActions');
const toastContainer = document.getElementById('toastContainer');
const installPwaBtn = document.getElementById('installPwaBtn');

// Уведомления (Toast)
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3200);
}

// Модальное окно
function openModal({ title, text, buttons }) {
  modalTitle.textContent = title;
  modalText.textContent = text;
  modalActions.replaceChildren();

  buttons.forEach(btnCfg => {
    const btn = document.createElement('button');
    btn.className = btnCfg.className || 'icon-btn';
    btn.textContent = btnCfg.label;
    btn.addEventListener('click', () => {
      modalBackdrop.hidden = true;
      if (btnCfg.onClick) btnCfg.onClick();
    });
    modalActions.appendChild(btn);
  });

  modalBackdrop.hidden = false;
}

// Тема (по умолчанию dark)
const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
});

// Сохранение
function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  const timeStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  saveStatusEl.textContent = `Сохранено в ${timeStr}`;
}

function formatDate(isoStr) {
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Подсчет задач в заметке
function getTaskStats(content = '') {
  const lines = content.split('\n');
  let total = 0;
  let done = 0;
  lines.forEach(line => {
    if (/^\s*(?:[-*]\s+[[ xX]]|[☐☑])/u.test(line)) {
      total++;
      if (/^\s*(?:[-*]\s+[[xX]]|☑)/u.test(line)) done++;
    }
  });
  return { total, done };
}

// Безопасная отрисовка карточек заметок (100% защита от XSS через DOM API)
function renderNotesList() {
  notesListEl.replaceChildren();

  const filtered = notes
    .filter(n => {
      const matchesTag = currentFilterTag === 'Все' || n.category === currentFilterTag;
      const q = searchQuery.toLowerCase();
      const matchesSearch = n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
      return matchesTag && matchesSearch;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Заметок не найдено';
    notesListEl.appendChild(empty);
    return;
  }

  filtered.forEach(note => {
    const card = document.createElement('div');
    card.className = `note-card${note.id === activeNoteId ? ' active' : ''}`;

    const header = document.createElement('div');
    header.className = 'note-card-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'note-card-title';
    titleEl.textContent = note.title || 'Без названия';
    header.appendChild(titleEl);

    if (note.pinned) {
      const pinSpan = document.createElement('span');
      pinSpan.textContent = '📌';
      header.appendChild(pinSpan);
    }

    const snippetEl = document.createElement('div');
    snippetEl.className = 'note-card-snippet';
    snippetEl.textContent = note.content.replace(/[#>*_`~]/g, '') || 'Пустая заметка...';

    const metaEl = document.createElement('div');
    metaEl.className = 'note-card-meta';

    const badgesWrap = document.createElement('div');
    badgesWrap.className = 'meta-badges';

    const catBadge = document.createElement('span');
    catBadge.className = 'badge';
    catBadge.textContent = note.category;
    badgesWrap.appendChild(catBadge);

    const taskStats = getTaskStats(note.content);
    if (taskStats.total > 0) {
      const taskBadge = document.createElement('span');
      taskBadge.className = 'badge-tasks';
      taskBadge.textContent = `✓ ${taskStats.done}/${taskStats.total}`;
      badgesWrap.appendChild(taskBadge);
    }

    const dateSpan = document.createElement('span');
    dateSpan.textContent = formatDate(note.updatedAt);

    metaEl.append(badgesWrap, dateSpan);
    card.append(header, snippetEl, metaEl);

    card.addEventListener('click', () => {
      activeNoteId = note.id;
      renderNotesList();
      renderActiveNote();
    });

    notesListEl.appendChild(card);
  });
}

// Экранирование HTML для безопасного Markdown-парсера
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(safeText) {
  return safeText
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

// Безопасный рендеринг Markdown + интерактивных чек-боксов
function renderMarkdownPreview(content) {
  markdownPreviewEl.replaceChildren();
  if (!content.trim()) {
    const placeholder = document.createElement('div');
    placeholder.className = 'empty-state';
    placeholder.textContent = 'Предпросмотр Markdown появится здесь...';
    markdownPreviewEl.appendChild(placeholder);
    return;
  }

  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBuffer = [];

  lines.forEach((line, lineIdx) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = codeBuffer.join('\n');
        pre.appendChild(code);
        markdownPreviewEl.appendChild(pre);
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Проверка на чек-бокс: "- [ ] ", "- [x] ", "☐ ", "☑ "
    const mdTaskMatch = line.match(/^(\s*[-*]\s+\[([ xX])\]\s*)(.*)$/);
    const symbolTaskMatch = line.match(/^(\s*([☐☑])\s*)(.*)$/u);

    if (mdTaskMatch || symbolTaskMatch) {
      const isChecked = mdTaskMatch
        ? mdTaskMatch[2].toLowerCase() === 'x'
        : symbolTaskMatch[2] === '☑';
      const labelText = mdTaskMatch ? mdTaskMatch[3] : symbolTaskMatch[3];

      const labelEl = document.createElement('label');
      labelEl.className = 'md-task-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'md-task-checkbox';
      checkbox.checked = isChecked;
      checkbox.addEventListener('change', () => toggleTaskAtLine(lineIdx));

      const span = document.createElement('span');
      span.className = `md-task-label${isChecked ? ' completed' : ''}`;
      span.innerHTML = formatInlineMarkdown(escapeHtml(labelText || 'Задача'));

      labelEl.append(checkbox, span);
      markdownPreviewEl.appendChild(labelEl);
      return;
    }

    // Заголовки
    if (/^###\s+/.test(line)) {
      const h3 = document.createElement('h3');
      h3.innerHTML = formatInlineMarkdown(escapeHtml(line.replace(/^###\s+/, '')));
      markdownPreviewEl.appendChild(h3);
      return;
    }
    if (/^##\s+/.test(line)) {
      const h2 = document.createElement('h2');
      h2.innerHTML = formatInlineMarkdown(escapeHtml(line.replace(/^##\s+/, '')));
      markdownPreviewEl.appendChild(h2);
      return;
    }
    if (/^#\s+/.test(line)) {
      const h1 = document.createElement('h1');
      h1.innerHTML = formatInlineMarkdown(escapeHtml(line.replace(/^#\s+/, '')));
      markdownPreviewEl.appendChild(h1);
      return;
    }

    // Цитаты
    if (/^>\s*/.test(line)) {
      const bq = document.createElement('blockquote');
      bq.innerHTML = formatInlineMarkdown(escapeHtml(line.replace(/^>\s*/, '')));
      markdownPreviewEl.appendChild(bq);
      return;
    }

    // Списки
    if (/^\s*[-*]\s+/.test(line)) {
      const ul = document.createElement('ul');
      const li = document.createElement('li');
      li.innerHTML = formatInlineMarkdown(escapeHtml(line.replace(/^\s*[-*]\s+/, '')));
      ul.appendChild(li);
      markdownPreviewEl.appendChild(ul);
      return;
    }

    if (line.trim() === '') {
      return;
    }

    const p = document.createElement('p');
    p.innerHTML = formatInlineMarkdown(escapeHtml(line));
    markdownPreviewEl.appendChild(p);
  });
}

// Переключение задачи по клику в превью
function toggleTaskAtLine(lineIndex) {
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;

  const lines = note.content.split('\n');
  const line = lines[lineIndex];
  if (typeof line !== 'string') return;

  if (/^(\s*[-*]\s+\[)([ xX])(\]\s*.*)$/.test(line)) {
    lines[lineIndex] = line.replace(/^(\s*[-*]\s+\[)([ xX])(\]\s*.*)$/, (_, p1, state, p3) => {
      const next = state.toLowerCase() === 'x' ? ' ' : 'x';
      return `${p1}${next}${p3}`;
    });
  } else if (/^(\s*)([☐☑])(\s*.*)$/u.test(line)) {
    lines[lineIndex] = line.replace(/^(\s*)([☐☑])(\s*.*)$/u, (_, p1, symbol, p3) => {
      const next = symbol === '☑' ? '☐' : '☑';
      return `${p1}${next}${p3}`;
    });
  }

  note.content = lines.join('\n');
  note.updatedAt = new Date().toISOString();
  noteContentEl.value = note.content;
  updateStats(note.content);
  renderMarkdownPreview(note.content);
  saveNotes();
  renderNotesList();
}

function renderActiveNote() {
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) {
    noteTitleEl.value = '';
    noteContentEl.value = '';
    noteTitleEl.disabled = true;
    noteContentEl.disabled = true;
    markdownPreviewEl.replaceChildren();
    wordCountEl.textContent = '0 слов • 0 символов';
    tasksProgressEl.textContent = '';
    return;
  }

  noteTitleEl.disabled = false;
  noteContentEl.disabled = false;
  noteTitleEl.value = note.title;
  noteContentEl.value = note.content;
  noteCategoryEl.value = note.category;
  pinNoteBtn.classList.toggle('pinned-active', Boolean(note.pinned));
  updateStats(note.content);
  renderMarkdownPreview(note.content);
}

function updateStats(text) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCountEl.textContent = `${words} слов • ${chars} символов`;

  const stats = getTaskStats(text);
  tasksProgressEl.textContent = stats.total > 0 ? `Задачи: ${stats.done}/${stats.total}` : '';
}

function updateActiveNote() {
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;

  note.title = noteTitleEl.value;
  note.content = noteContentEl.value;
  note.category = noteCategoryEl.value;
  note.updatedAt = new Date().toISOString();

  updateStats(note.content);
  renderMarkdownPreview(note.content);
  saveNotes();
  renderNotesList();
}

noteTitleEl.addEventListener('input', updateActiveNote);
noteContentEl.addEventListener('input', updateActiveNote);
noteCategoryEl.addEventListener('change', updateActiveNote);

// Переключение режима редактора (Edit / Split / Preview)
function applyViewMode(mode) {
  currentViewMode = mode;
  localStorage.setItem(MODE_KEY, mode);
  workspaceEl.className = `workspace mode-${mode}`;
  viewModeGroup.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

viewModeGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  applyViewMode(btn.dataset.mode);
});

// Голосовой ввод (Speech Recognition)
let recognition = null;
let isRecording = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'ru-RU';
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (finalTranscript) {
      insertTextAtCursor(finalTranscript.trim() + ' ');
    }
  };

  recognition.onerror = (event) => {
    console.warn('Ошибка распознавания речи:', event.error);
    stopRecording();
    if (event.error === 'not-allowed') {
      showToast('Доступ к микрофону заблокирован в настройках браузера');
    } else {
      showToast('Ошибка голосового ввода');
    }
  };

  recognition.onend = () => {
    if (isRecording) {
      try {
        recognition.start();
      } catch (e) {
        stopRecording();
      }
    }
  };
} else {
  if (voiceBtn) voiceBtn.style.display = 'none';
}

function startRecording() {
  if (!recognition) return;
  try {
    recognition.start();
    isRecording = true;
    voiceBtn.classList.add('recording');
    voiceBtn.title = 'Слушаю... (нажмите для остановки)';
    showToast('Слушаю вас...');
  } catch (e) {
    console.error(e);
  }
}

function stopRecording() {
  if (!recognition) return;
  isRecording = false;
  try {
    recognition.stop();
  } catch (e) {}
  voiceBtn.classList.remove('recording');
  voiceBtn.title = 'Голосовой ввод';
}

function insertTextAtCursor(textToInsert) {
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;

  const cursor = noteContentEl.selectionStart ?? noteContentEl.value.length;
  const text = noteContentEl.value;
  const prefix = (cursor > 0 && !/\s$/.test(text.slice(0, cursor))) ? ' ' : '';
  
  noteContentEl.value = text.slice(0, cursor) + prefix + textToInsert + text.slice(cursor);
  updateActiveNote();
  
  const newPos = cursor + prefix.length + textToInsert.length;
  noteContentEl.focus();
  noteContentEl.setSelectionRange(newPos, newPos);
}

if (voiceBtn) {
  voiceBtn.addEventListener('click', () => {
    if (!SpeechRecognition) {
      showToast('Ваш браузер не поддерживает голосовой ввод');
      return;
    }
    if (isRecording) {
      stopRecording();
      showToast('Голосовой ввод остановлен');
    } else {
      startRecording();
    }
  });
}

// Создание новой заметки (сбрасываем поиск и фильтр "Все", чтобы новая запись точно была видна)
function createNewNote() {
  searchQuery = '';
  searchInput.value = '';
  clearSearchBtn.hidden = true;

  currentFilterTag = 'Все';
  document.querySelectorAll('.tag-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.tag === 'Все');
  });

  const newNote = {
    id: Date.now(),
    title: '',
    content: '',
    category: 'Работа',
    pinned: false,
    updatedAt: new Date().toISOString()
  };
  
  notes.unshift(newNote);
  activeNoteId = newNote.id;
  
  saveNotes();
  renderNotesList();
  renderActiveNote();
  noteTitleEl.focus();
}

newNoteBtn.addEventListener('click', createNewNote);

// Горячая клавиша Cmd/Ctrl + N
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    createNewNote();
  }
});

// Закрепление
pinNoteBtn.addEventListener('click', () => {
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
  note.pinned = !note.pinned;
  note.updatedAt = new Date().toISOString();
  saveNotes();
  renderNotesList();
  renderActiveNote();
});

// Удаление через кастомное модальное окно
deleteNoteBtn.addEventListener('click', () => {
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;

  openModal({
    title: 'Удалить заметку?',
    text: `Заметка «${note.title || 'Без названия'}» будет удалена безвозвратно.`,
    buttons: [
      { label: 'Отмена', className: 'icon-btn' },
      {
        label: 'Удалить',
        className: 'icon-btn btn-danger',
        onClick: () => {
          notes = notes.filter(n => n.id !== activeNoteId);
          activeNoteId = notes[0]?.id || null;
          saveNotes();
          renderNotesList();
          renderActiveNote();
          showToast('Заметка удалена');
        }
      }
    ]
  });
});

// Поиск и фильтрация
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  clearSearchBtn.hidden = !searchQuery;
  renderNotesList();
});

clearSearchBtn.addEventListener('click', () => {
  searchQuery = '';
  searchInput.value = '';
  clearSearchBtn.hidden = true;
  renderNotesList();
});

tagsFilterEl.addEventListener('click', (e) => {
  const chip = e.target.closest('.tag-chip');
  if (!chip) return;
  document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  currentFilterTag = chip.dataset.tag;
  renderNotesList();
});

// Быстрая вставка интерактивного чек-бокса
addTodoBtn.addEventListener('click', () => {
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
  const cursor = noteContentEl.selectionStart ?? noteContentEl.value.length;
  const text = noteContentEl.value;
  const prefix = (cursor > 0 && text[cursor - 1] !== '\n') ? '\n- [ ] ' : '- [ ] ';
  noteContentEl.value = text.slice(0, cursor) + prefix + text.slice(cursor);
  updateActiveNote();
  noteContentEl.focus();
  const nextPos = cursor + prefix.length;
  noteContentEl.setSelectionRange(nextPos, nextPos);
});

addDateBtn.addEventListener('click', () => {
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
  const nowStr = new Date().toLocaleDateString('ru-RU') + ' ';
  const cursor = noteContentEl.selectionStart ?? noteContentEl.value.length;
  const text = noteContentEl.value;
  noteContentEl.value = text.slice(0, cursor) + nowStr + text.slice(cursor);
  updateActiveNote();
  noteContentEl.focus();
});

// Выгрузка в TXT и MD
function downloadCurrentNote(ext) {
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
  const header = ext === 'md' ? `# ${note.title || 'Без названия'}\n\n` : `${note.title || 'Без названия'}\n\n`;
  const blob = new Blob([header + note.content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(note.title || 'Заметка').replace(/[\\/:*?"<>|]/g, '_')}.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

downloadTxtBtn.addEventListener('click', () => downloadCurrentNote('txt'));
downloadMdBtn.addEventListener('click', () => downloadCurrentNote('md'));

// Экспорт всех заметок в JSON
exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `notes_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Бэкап JSON сохранён');
});

// Импорт бэкапа из JSON с валидацией и выбором режима
importBtn.addEventListener('click', () => {
  importFileInput.value = '';
  importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed)) {
        throw new Error('Файл не содержит массив заметок');
      }
      const importedNotes = parsed.map((item, idx) => sanitizeNote(item, idx)).filter(Boolean);
      if (importedNotes.length === 0) {
        showToast('В выбранном файле нет корректных заметок');
        return;
      }

      openModal({
        title: 'Импорт резервной копии',
        text: `Найдено заметок в файле: ${importedNotes.length}. Объединить их с текущими записями или полностью заменить базу?`,
        buttons: [
          { label: 'Отмена', className: 'icon-btn' },
          {
            label: 'Заменить все',
            className: 'icon-btn btn-danger',
            onClick: () => {
              notes = importedNotes;
              activeNoteId = notes[0]?.id || null;
              saveNotes();
              renderNotesList();
              renderActiveNote();
              showToast(`Загружено заметок: ${importedNotes.length}`);
            }
          },
          {
            label: 'Объединить',
            className: 'icon-btn',
            onClick: () => {
              const map = new Map();
              notes.forEach(n => map.set(String(n.id), n));
              importedNotes.forEach(inc => {
                const key = String(inc.id);
                const existing = map.get(key);
                if (!existing || new Date(inc.updatedAt) >= new Date(existing.updatedAt)) {
                  map.set(key, inc);
                }
              });
              notes = Array.from(map.values());
              activeNoteId = notes[0]?.id || null;
              saveNotes();
              renderNotesList();
              renderActiveNote();
              showToast(`База объединена (всего заметок: ${notes.length})`);
            }
          }
        ]
      });
    } catch (err) {
      showToast('Ошибка: некорректный формат JSON-файла');
    }
  };
  reader.readAsText(file);
});

// Настройка PWA и Service Worker
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installPwaBtn.style.display = 'inline-flex';
});

installPwaBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installPwaBtn.style.display = 'none';
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service Worker registration warning:', err);
    });
  });
}

// Инициализация
applyViewMode(currentViewMode);
renderNotesList();
renderActiveNote();