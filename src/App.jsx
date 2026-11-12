import React, { useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';

const STORAGE_KEY = 'kanban-workspace-v1';
const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];
const PRIORITY_COLORS = {
  Urgent: 'var(--p-urgent)',
  High: 'var(--p-high)',
  Medium: 'var(--p-medium)',
  Low: 'var(--p-low)',
};

const makeColumns = () => [
  {
    id: 'todo',
    title: 'To do',
    color: '#8b8b98',
    tasks: [
      {
        id: 't1',
        title: 'Define project requirements',
        description: 'Finalize the core features and project scope.',
        priority: 'High',
        tag: 'Planning',
        dueDate: '2026-11-14',
        subtasks: [],
      },
      {
        id: 't2',
        title: 'Create wireframes',
        description: 'Sketch the main screens and user flow.',
        priority: 'Medium',
        tag: 'Design',
        dueDate: '2026-11-17',
        subtasks: [],
      },
      {
        id: 't3',
        title: 'Review color palette',
        description: 'Choose the final light and dark theme colors.',
        priority: 'Low',
        tag: 'Design',
        dueDate: '',
        subtasks: [],
      },
    ],
  },
  {
    id: 'progress',
    title: 'In progress',
    color: '#8b7cf6',
    tasks: [
      {
        id: 't4',
        title: 'Build the dashboard',
        description: 'Create the main workspace layout.',
        priority: 'Urgent',
        tag: 'Development',
        dueDate: '2026-11-13',
        subtasks: [],
      },
      {
        id: 't5',
        title: 'Set up navigation',
        description: 'Connect the sidebar and board navigation.',
        priority: 'Medium',
        tag: 'Development',
        dueDate: '',
        subtasks: [],
      },
    ],
  },
  {
    id: 'review',
    title: 'In review',
    color: '#d6a34b',
    tasks: [
      {
        id: 't6',
        title: 'Check responsive layout',
        description: 'Review the layout on smaller screens.',
        priority: 'Low',
        tag: 'Testing',
        dueDate: '',
        subtasks: [],
      },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    color: '#42a887',
    tasks: [
      {
        id: 't7',
        title: 'Create project plan',
        description: 'Outline the project stages and features.',
        priority: 'High',
        tag: 'Planning',
        dueDate: '',
        subtasks: [],
      },
    ],
  },
];

const initialBoards = [
  { id: 'main', name: 'Product workspace', icon: '▦' },
  { id: 'personal', name: 'Personal tasks', icon: '◷' },
  { id: 'ideas', name: 'Ideas & backlog', icon: '◇' },
];

const makeEmptyColumns = () =>
  ['To do', 'In progress', 'In review', 'Done'].map((title, index) => ({
    id: `column-${index + 1}`,
    title,
    color: ['#8b8b98', '#8b7cf6', '#d6a34b', '#42a887'][index],
    tasks: [],
  }));

function readSavedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/* ---------- small helpers ---------- */

function formatISO(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function todayISO() {
  return formatISO(new Date());
}

function addDaysISO(iso, days) {
  const date = new Date(iso + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return formatISO(date);
}

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function downloadFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Quotes every cell. Cells starting with = + - @ get a leading apostrophe so
// spreadsheets don't treat user text as a formula.
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

// Checks an imported file and fills in anything missing so the app never
// crashes on a hand-edited or older export.
function sanitizeWorkspace(data) {
  if (
    !data ||
    !Array.isArray(data.boards) ||
    !data.boardData ||
    typeof data.boardData !== 'object'
  ) {
    throw new Error('This file is not a Kanbanspace workspace export.');
  }

  const boards = data.boards
    .filter(board => board && board.id && board.name)
    .map(board => ({
      id: String(board.id),
      name: String(board.name),
      icon: board.icon || '▦',
    }));

  if (boards.length === 0) {
    throw new Error('The file does not contain any boards.');
  }

  const boardData = {};
  boards.forEach(board => {
    const rawColumns = Array.isArray(data.boardData[board.id])
      ? data.boardData[board.id]
      : [];

    boardData[board.id] =
      rawColumns.length === 0
        ? makeEmptyColumns()
        : rawColumns
            .filter(column => column && column.id)
            .map(column => ({
              id: String(column.id),
              title: String(column.title || 'Untitled'),
              color: column.color || '#8b7cf6',
              tasks: (Array.isArray(column.tasks) ? column.tasks : [])
                .filter(task => task && task.id && task.title)
                .map(task => ({
                  id: String(task.id),
                  title: String(task.title),
                  description: String(task.description || ''),
                  priority: PRIORITIES.includes(task.priority)
                    ? task.priority
                    : 'Medium',
                  tag: String(task.tag || 'General'),
                  dueDate: String(task.dueDate || ''),
                  subtasks: (Array.isArray(task.subtasks)
                    ? task.subtasks
                    : []
                  )
                    .filter(item => item && item.id && item.title)
                    .map(item => ({
                      id: String(item.id),
                      title: String(item.title),
                      completed: Boolean(item.completed),
                    })),
                })),
            }));

    if (boardData[board.id].length === 0) {
      boardData[board.id] = makeEmptyColumns();
    }
  });

  return { boards, boardData };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}

// Horizontal bar chart made from plain elements, no chart library needed.
function BarList({ rows, emptyText }) {
  const max = Math.max(1, ...rows.map(row => row.count));

  if (rows.length === 0) {
    return <p className='analytics-empty'>{emptyText}</p>;
  }

  return (
    <ul className='bar-list'>
      {rows.map(row => (
        <li key={row.label}>
          <span className='bar-label'>{row.label}</span>
          <span className='bar-track'>
            <span
              className='bar-fill'
              style={{
                width: `${(row.count / max) * 100}%`,
                background: row.color,
              }}
            />
          </span>
          <span className='bar-value'>{row.count}</span>
        </li>
      ))}
    </ul>
  );
}

const SHORTCUTS = [
  ['Ctrl K', 'Open the command palette'],
  ['N', 'New task'],
  ['/', 'Focus search'],
  ['T', 'Switch light / dark theme'],
  ['V', 'Switch between Board and Analytics'],
  ['1 – 9', 'Jump to a board'],
  ['?', 'Show this list'],
  ['Esc', 'Close any dialog or menu'],
];

function App() {
  const saved = useMemo(() => readSavedData(), []);

  const [boards, setBoards] = useState(saved?.boards || initialBoards);
  const [boardData, setBoardData] = useState(
    saved?.boardData || {
      main: makeColumns(),
      personal: makeEmptyColumns(),
      ideas: makeEmptyColumns(),
    }
  );
  const [activeBoard, setActiveBoard] = useState(saved?.activeBoard || 'main');
  const [theme, setTheme] = useState(saved?.theme || 'light');
  const [view, setView] = useState('board');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [tagFilter, setTagFilter] = useState('All');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState('todo');
  const [editingTask, setEditingTask] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);
  // Where the dragged card would land: { columnId, beforeId }.
  const [dropTarget, setDropTarget] = useState(null);
  const [showBoardInput, setShowBoardInput] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newSubtask, setNewSubtask] = useState('');

  // command palette, menus, help, toast
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const searchRef = useRef(null);
  const importRef = useRef(null);
  const shortcutRef = useRef(() => {});
  const lastFocusRef = useRef(null);
  const modalWasOpen = useRef(false);
  const noticeTimer = useRef(null);

  const modKey =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘'
      : 'Ctrl';

  const columns = boardData[activeBoard] || [];
  const activeBoardName =
    boards.find(board => board.id === activeBoard)?.name || 'Workspace';

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ boards, boardData, activeBoard, theme })
    );
  }, [boards, boardData, activeBoard, theme]);

  // One keyboard listener for the whole app. It always calls the newest
  // handler (shortcutRef), so it never works with stale state.
  useEffect(() => {
    const listener = event => shortcutRef.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // Give focus back to the button you clicked once the task dialog closes.
  useEffect(() => {
    if (showAddTask) {
      modalWasOpen.current = true;
    } else if (modalWasOpen.current) {
      modalWasOpen.current = false;
      const el = lastFocusRef.current;
      if (el && document.body.contains(el) && el.focus) el.focus();
    }
  }, [showAddTask]);

  // Keep the highlighted palette row visible while using the arrow keys.
  useEffect(() => {
    if (!paletteOpen) return;
    const el = document.getElementById(`cmd-${paletteIndex}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [paletteIndex, paletteOpen]);

  function showToast(message) {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 3000);
  }

  function toggleTheme() {
    setTheme(current => (current === 'light' ? 'dark' : 'light'));
  }

  function updateColumns(nextColumns) {
    setBoardData(current => ({
      ...current,
      [activeBoard]: nextColumns,
    }));
  }

  function switchBoard(boardId) {
    setActiveBoard(boardId);
    setTagFilter('All');
  }

  function openNewTask(columnId = columns[0]?.id) {
    lastFocusRef.current = document.activeElement;
    setEditingTask(null);
    setNewTaskColumn(columnId);
    setNewSubtask('');
    setShowAddTask(true);
  }

  function editTask(task, columnId) {
    lastFocusRef.current = document.activeElement;
    setEditingTask({ ...task, columnId });
    setNewTaskColumn(columnId);
    setNewSubtask('');
    setShowAddTask(true);
  }

  function saveTask(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = form.get('title').trim();

    if (!title) return;

    const task = {
      id: editingTask?.id || `task-${Date.now()}`,
      title,
      description: form.get('description').trim(),
      priority: form.get('priority'),
      tag: form.get('tag').trim() || 'General',
      dueDate: form.get('dueDate'),
      subtasks: editingTask?.subtasks || [],
    };

    let next = columns.map(column => ({
      ...column,
      tasks: column.tasks.filter(item => item.id !== task.id),
    }));

    next = next.map(column =>
      column.id === newTaskColumn
        ? { ...column, tasks: [...column.tasks, task] }
        : column
    );

    updateColumns(next);
    setShowAddTask(false);
    setEditingTask(null);
  }

  function deleteTask(taskId) {
    updateColumns(
      columns.map(column => ({
        ...column,
        tasks: column.tasks.filter(task => task.id !== taskId),
      }))
    );
  }

  // ---------- drag and drop ----------

  function clearDrag() {
    setDraggedTask(null);
    setDropTarget(null);
  }

  function handleColumnDragOver(event, columnId) {
    if (!draggedTask) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const cards = Array.from(
      event.currentTarget.querySelectorAll('.task-card')
    ).filter(card => card.dataset.taskId !== draggedTask.task.id);

    let beforeId = null;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        beforeId = card.dataset.taskId;
        break;
      }
    }

    if (
      dropTarget?.columnId !== columnId ||
      dropTarget?.beforeId !== beforeId
    ) {
      setDropTarget({ columnId, beforeId });
    }
  }

  function dropTask(targetColumnId) {
    if (!draggedTask) {
      setDropTarget(null);
      return;
    }

    const taskId = draggedTask.task.id;
    const beforeId =
      dropTarget && dropTarget.columnId === targetColumnId
        ? dropTarget.beforeId
        : null;

    const movingTask =
      columns.flatMap(column => column.tasks).find(task => task.id === taskId) ||
      draggedTask.task;

    const withoutTask = columns.map(column => ({
      ...column,
      tasks: column.tasks.filter(task => task.id !== taskId),
    }));

    const next = withoutTask.map(column => {
      if (column.id !== targetColumnId) return column;

      const tasks = [...column.tasks];
      const index = beforeId
        ? tasks.findIndex(task => task.id === beforeId)
        : -1;

      if (index === -1) {
        tasks.push(movingTask);
      } else {
        tasks.splice(index, 0, movingTask);
      }

      return { ...column, tasks };
    });

    updateColumns(next);
    clearDrag();
  }

  // ---------- boards and columns ----------

  function addBoard(event) {
    event.preventDefault();
    const name = newBoardName.trim();
    if (!name) return;

    const id = `board-${Date.now()}`;

    setBoards(current => [...current, { id, name, icon: '▦' }]);

    setBoardData(current => ({
      ...current,
      [id]: makeEmptyColumns(),
    }));

    switchBoard(id);
    setNewBoardName('');
    setShowBoardInput(false);
  }

  function addColumn() {
    const title = window.prompt('Enter a name for the new column:');
    if (!title?.trim()) return;

    const id = `column-${Date.now()}`;

    updateColumns([
      ...columns,
      {
        id,
        title: title.trim(),
        color: '#8b7cf6',
        tasks: [],
      },
    ]);
  }

  function renameColumn(columnId, oldTitle) {
    const title = window.prompt('Rename this column:', oldTitle);
    if (!title?.trim()) return;

    updateColumns(
      columns.map(column =>
        column.id === columnId ? { ...column, title: title.trim() } : column
      )
    );
  }

  function deleteColumn(columnId) {
    if (columns.length <= 1) {
      window.alert('A board must have at least one column.');
      return;
    }

    const target = columns.find(column => column.id !== columnId);
    const columnToDelete = columns.find(column => column.id === columnId);

    const confirmed = window.confirm(
      `Delete "${columnToDelete.title}"? Its tasks will be moved to "${target.title}".`
    );

    if (!confirmed) return;

    updateColumns(
      columns
        .filter(column => column.id !== columnId)
        .map(column =>
          column.id === target.id
            ? {
                ...column,
                tasks: [...column.tasks, ...columnToDelete.tasks],
              }
            : column
        )
    );
  }

  // ---------- subtasks ----------

  function addSubtask() {
    const title = newSubtask.trim();
    if (!title || !editingTask) return;

    const updated = {
      ...editingTask,
      subtasks: [
        ...(editingTask.subtasks || []),
        { id: `sub-${Date.now()}`, title, completed: false },
      ],
    };

    setEditingTask(updated);
    setNewSubtask('');
    updateTaskSubtasks(updated);
  }

  function updateTaskSubtasks(updatedTask) {
    updateColumns(
      columns.map(column => ({
        ...column,
        tasks: column.tasks.map(task =>
          task.id === updatedTask.id
            ? { ...task, subtasks: updatedTask.subtasks }
            : task
        ),
      }))
    );
  }

  function toggleSubtask(subtaskId) {
    if (!editingTask) return;

    const updated = {
      ...editingTask,
      subtasks: editingTask.subtasks.map(item =>
        item.id === subtaskId ? { ...item, completed: !item.completed } : item
      ),
    };

    setEditingTask(updated);
    updateTaskSubtasks(updated);
  }

  function removeSubtask(subtaskId) {
    if (!editingTask) return;

    const updated = {
      ...editingTask,
      subtasks: editingTask.subtasks.filter(item => item.id !== subtaskId),
    };

    setEditingTask(updated);
    updateTaskSubtasks(updated);
  }

  // ---------- export / import ----------

  function exportJSON() {
    const payload = {
      app: 'kanbanspace',
      version: 1,
      exportedAt: new Date().toISOString(),
      theme,
      boards,
      boardData,
    };
    downloadFile(
      `kanbanspace-${todayISO()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    showToast('Workspace exported as JSON');
  }

  function exportCSV() {
    const rows = [
      [
        'Board',
        'Column',
        'Title',
        'Description',
        'Priority',
        'Tag',
        'Due date',
        'Subtasks done',
        'Subtasks total',
      ],
    ];

    boards.forEach(board => {
      (boardData[board.id] || []).forEach(column => {
        column.tasks.forEach(task => {
          const subs = task.subtasks || [];
          rows.push([
            board.name,
            column.title,
            task.title,
            task.description,
            task.priority,
            task.tag,
            task.dueDate,
            subs.filter(item => item.completed).length,
            subs.length,
          ]);
        });
      });
    });

    // The leading \uFEFF makes Excel read the file as UTF-8.
    const csv =
      '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    downloadFile(`kanbanspace-tasks-${todayISO()}.csv`, csv, 'text/csv');
    showToast('Tasks exported as CSV');
  }

  async function handleImport(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const imported = sanitizeWorkspace(JSON.parse(text));

      const ok = window.confirm(
        `Import ${imported.boards.length} board(s)? This REPLACES your current workspace. Export first if you want a backup.`
      );
      if (!ok) return;

      setBoards(imported.boards);
      setBoardData(imported.boardData);
      setActiveBoard(imported.boards[0].id);
      setSearch('');
      setPriorityFilter('All');
      setTagFilter('All');
      setView('board');
      showToast('Workspace imported');
    } catch (error) {
      window.alert(
        error instanceof SyntaxError
          ? 'That file is not valid JSON.'
          : error.message
      );
    }
  }

  // ---------- derived data ----------

  const today = todayISO();
  const allTasks = columns.flatMap(column => column.tasks);

  const tagCounts = allTasks.reduce((counts, task) => {
    if (task.tag) counts[task.tag] = (counts[task.tag] || 0) + 1;
    return counts;
  }, {});
  const tagList = Object.keys(tagCounts).sort((a, b) => a.localeCompare(b));

  const activeTag = tagList.includes(tagFilter) ? tagFilter : 'All';

  const visibleColumns = columns.map(column => ({
    ...column,
    tasks: column.tasks.filter(task => {
      const matchesSearch = `${task.title} ${task.description} ${task.tag}`
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesPriority =
        priorityFilter === 'All' || task.priority === priorityFilter;

      const matchesTag = activeTag === 'All' || task.tag === activeTag;

      return matchesSearch && matchesPriority && matchesTag;
    }),
  }));

  const doneColumn = columns.find(
    column =>
      column.id === 'done' || column.title.trim().toLowerCase() === 'done'
  );
  const completedCount = doneColumn ? doneColumn.tasks.length : 0;
  const progress =
    allTasks.length === 0
      ? 0
      : Math.round((completedCount / allTasks.length) * 100);

  // analytics
  const doneIds = new Set(doneColumn ? doneColumn.tasks.map(t => t.id) : []);
  const openTasks = allTasks.filter(task => !doneIds.has(task.id));
  const weekEnd = addDaysISO(today, 7);
  const overdueCount = openTasks.filter(
    task => task.dueDate && task.dueDate < today
  ).length;
  const dueSoonCount = openTasks.filter(
    task => task.dueDate && task.dueDate >= today && task.dueDate <= weekEnd
  ).length;
  const upcoming = openTasks
    .filter(task => task.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  const subtaskTotal = allTasks.reduce(
    (sum, task) => sum + (task.subtasks?.length || 0),
    0
  );
  const subtaskDone = allTasks.reduce(
    (sum, task) =>
      sum + (task.subtasks?.filter(item => item.completed).length || 0),
    0
  );
  const columnRows = columns.map(column => ({
    label: column.title,
    count: column.tasks.length,
    color: column.color,
  }));
  const priorityRows = PRIORITIES.map(priority => ({
    label: priority,
    count: allTasks.filter(task => task.priority === priority).length,
    color: PRIORITY_COLORS[priority],
  }));
  const tagRows = tagList
    .map(tag => ({
      label: tag,
      count: tagCounts[tag],
      color: 'var(--accent)',
    }))
    .sort((a, b) => b.count - a.count);

  // ---------- command palette ----------

  function openPalette() {
    setPaletteQuery('');
    setPaletteIndex(0);
    setPaletteOpen(true);
  }

  function clearFilters() {
    setSearch('');
    setPriorityFilter('All');
    setTagFilter('All');
  }

  const commands = [
    { id: 'new-task', label: 'New task', hint: 'N', run: () => openNewTask() },
    { id: 'new-column', label: 'Add column', run: addColumn },
    {
      id: 'new-board',
      label: 'Create a board',
      run: () => setShowBoardInput(true),
    },
    {
      id: 'view-board',
      label: 'Show board view',
      run: () => setView('board'),
    },
    {
      id: 'view-analytics',
      label: 'Show analytics',
      hint: 'V',
      run: () => setView('analytics'),
    },
    {
      id: 'theme',
      label: `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`,
      hint: 'T',
      run: toggleTheme,
    },
    { id: 'clear', label: 'Clear all filters', run: clearFilters },
    { id: 'export-json', label: 'Export workspace (JSON)', run: exportJSON },
    { id: 'export-csv', label: 'Export tasks (CSV)', run: exportCSV },
    {
      id: 'import-json',
      label: 'Import workspace (JSON)',
      run: () => importRef.current && importRef.current.click(),
    },
    {
      id: 'help',
      label: 'Keyboard shortcuts',
      hint: '?',
      run: () => setShowHelp(true),
    },
    ...boards
      .filter(board => board.id !== activeBoard)
      .map(board => ({
        id: `board-${board.id}`,
        label: `Go to ${board.name}`,
        run: () => {
          switchBoard(board.id);
        },
      })),
    ...tagList.map(tag => ({
      id: `tag-${tag}`,
      label: `Filter by tag: ${tag}`,
      run: () => {
        setView('board');
        setTagFilter(tag);
      },
    })),
  ];

  const filteredCommands = commands.filter(command =>
    command.label.toLowerCase().includes(paletteQuery.trim().toLowerCase())
  );
  const safeIndex = Math.min(
    paletteIndex,
    Math.max(filteredCommands.length - 1, 0)
  );

  function runCommand(command) {
    setPaletteOpen(false);
    command.run();
  }

  function handlePaletteKey(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setPaletteIndex(Math.min(safeIndex + 1, filteredCommands.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setPaletteIndex(Math.max(safeIndex - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = filteredCommands[safeIndex];
      if (command) runCommand(command);
    }
  }

  // ---------- keyboard shortcuts ----------

  shortcutRef.current = event => {
    const key = event.key;
    const mod = event.ctrlKey || event.metaKey;

    if (mod && key.toLowerCase() === 'k') {
      event.preventDefault();
      if (paletteOpen) setPaletteOpen(false);
      else openPalette();
      return;
    }

    if (key === 'Escape') {
      if (paletteOpen) setPaletteOpen(false);
      else if (showHelp) setShowHelp(false);
      else if (dataMenuOpen) setDataMenuOpen(false);
      else if (showAddTask) setShowAddTask(false);
      return;
    }

    if (mod || event.altKey) return;

    const target = event.target;
    const typing =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    if (typing || paletteOpen || showHelp || showAddTask) return;

    if (key === 'n' || key === 'N') {
      event.preventDefault();
      openNewTask();
    } else if (key === '/') {
      event.preventDefault();
      setView('board');
      if (searchRef.current) searchRef.current.focus();
    } else if (key === 't' || key === 'T') {
      toggleTheme();
    } else if (key === 'v' || key === 'V') {
      setView(current => (current === 'board' ? 'analytics' : 'board'));
    } else if (key === '?') {
      setShowHelp(true);
    } else if (/^[1-9]$/.test(key)) {
      const board = boards[Number(key) - 1];
      if (board) switchBoard(board.id);
    }
  };

  return (
    <div className={`app-shell ${theme}`}>
      <input
        ref={importRef}
        type='file'
        accept='application/json,.json'
        hidden
        onChange={handleImport}
      />

      <aside className='sidebar'>
        <div className='brand'>
          <div className='brand-mark'>K</div>
          <span>
            kanban<span className='brand-light'>space</span>
          </span>
        </div>

        <div className='workspace-label'>WORKSPACE</div>
        <div className='workspace-switch'>
          <div className='workspace-avatar'>D</div>
          <div className='workspace-info'>
            <strong>My workspace</strong>
            <span>Personal plan</span>
          </div>
          <span className='switch-arrow'>⌄</span>
        </div>

        <div className='nav-heading'>
          <span>YOUR BOARDS</span>
          <button
            className='icon-button small'
            onClick={() => setShowBoardInput(!showBoardInput)}
            title='Add board'
            aria-label='Add board'
          >
            +
          </button>
        </div>

        {showBoardInput && (
          <form className='board-create' onSubmit={addBoard}>
            <input
              autoFocus
              value={newBoardName}
              onChange={event => setNewBoardName(event.target.value)}
              placeholder='Board name'
              aria-label='New board name'
            />
            <button type='submit'>Add</button>
          </form>
        )}

        <nav className='board-nav' aria-label='Boards'>
          {boards.map(board => (
            <button
              key={board.id}
              className={`board-link ${
                activeBoard === board.id ? 'active' : ''
              }`}
              aria-current={activeBoard === board.id ? 'page' : undefined}
              onClick={() => switchBoard(board.id)}
            >
              <span className='board-link-icon'>{board.icon}</span>
              <span>{board.name}</span>
              {activeBoard === board.id && <span className='active-dot' />}
            </button>
          ))}
        </nav>

        <div className='sidebar-bottom'>
          <div className='sidebar-tip'>
            <span className='tip-icon'>✦</span>
            <strong>Stay on track</strong>
            <p>Small steps add up. Keep moving your work forward.</p>
          </div>

          <button className='theme-button' onClick={toggleTheme}>
            <span>{theme === 'light' ? '◐' : '☼'}</span>
            {theme === 'light' ? 'Dark appearance' : 'Light appearance'}
            <span className='theme-state'>
              {theme === 'light' ? 'Off' : 'On'}
            </span>
          </button>

          <div className='profile'>
            <div className='profile-avatar'>D</div>
            <div>
              <strong>My account</strong>
              <span>Workspace owner</span>
            </div>
            <span className='profile-menu'>•••</span>
          </div>
        </div>
      </aside>

      <main className='main-area'>
        <header className='topbar'>
          <div className='breadcrumb'>
            <span>Boards</span>
            <span className='breadcrumb-divider'>/</span>
            <strong>{activeBoardName}</strong>
          </div>

          <div className='topbar-actions'>
            <div className='search-box'>
              <span>⌕</span>
              <input
                ref={searchRef}
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder='Search tasks...'
                aria-label='Search tasks'
              />
              <kbd>/</kbd>
            </div>

            <button
              className='top-icon-button'
              onClick={openPalette}
              title={`Command palette (${modKey}+K)`}
              aria-label='Open command palette'
            >
              ⌘ <span className='btn-text'>Commands</span>
            </button>

            <div className='data-menu-wrap'>
              <button
                className='top-icon-button'
                onClick={() => setDataMenuOpen(open => !open)}
                aria-haspopup='menu'
                aria-expanded={dataMenuOpen}
                title='Export and import'
              >
                ⇩ <span className='btn-text'>Data</span>
              </button>

              {dataMenuOpen && (
                <>
                  <div
                    className='menu-overlay'
                    onClick={() => setDataMenuOpen(false)}
                  />
                  <div className='data-menu' role='menu'>
                    <button
                      role='menuitem'
                      onClick={() => {
                        setDataMenuOpen(false);
                        exportJSON();
                      }}
                    >
                      Export workspace (JSON)
                    </button>
                    <button
                      role='menuitem'
                      onClick={() => {
                        setDataMenuOpen(false);
                        exportCSV();
                      }}
                    >
                      Export tasks (CSV)
                    </button>
                    <button
                      role='menuitem'
                      onClick={() => {
                        setDataMenuOpen(false);
                        importRef.current && importRef.current.click();
                      }}
                    >
                      Import workspace (JSON)
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              className='top-theme-button'
              onClick={toggleTheme}
              aria-label='Toggle light and dark theme'
            >
              {theme === 'light' ? '◐' : '☼'}
            </button>
            <div className='top-avatar'>D</div>
          </div>
        </header>

        <section className='page-content'>
          <div className='page-heading'>
            <div>
              <div className='eyebrow'>PROJECT BOARD</div>
              <h1>{activeBoardName}</h1>
              <p className='page-subtitle'>
                Organize your work. Focus on what matters.
              </p>
            </div>
            <div className='page-actions'>
              <button className='add-column-button' onClick={addColumn}>
                <span>+</span> Add column
              </button>
              <button className='primary-button' onClick={() => openNewTask()}>
                <span>+</span> Add task
              </button>
            </div>
          </div>

          <div className='overview-row'>
            <div className='overview-item'>
              <span className='overview-icon total-icon'>▤</span>
              <div>
                <span className='overview-label'>Total tasks</span>
                <strong>{allTasks.length}</strong>
              </div>
            </div>

            <div className='overview-item'>
              <span className='overview-icon done-icon'>✓</span>
              <div>
                <span className='overview-label'>Completed</span>
                <strong>{completedCount}</strong>
              </div>
            </div>

            <div className='overview-item progress-overview'>
              <span className='overview-icon progress-icon'>◷</span>
              <div>
                <span className='overview-label'>Progress</span>
                <strong>{progress}%</strong>
              </div>
              <div className='progress-track'>
                <div style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className='board-toolbar'>
            <div className='view-tabs'>
              <button
                className={`view-tab ${view === 'board' ? 'active' : ''}`}
                aria-pressed={view === 'board'}
                onClick={() => setView('board')}
              >
                ▦ Board
              </button>
              <button
                className={`view-tab ${view === 'analytics' ? 'active' : ''}`}
                aria-pressed={view === 'analytics'}
                onClick={() => setView('analytics')}
              >
                ▤ Analytics
              </button>
            </div>

            {view === 'board' && (
              <div className='toolbar-right'>
                <label className='filter-label' htmlFor='priority-filter'>
                  Priority
                </label>
                <select
                  id='priority-filter'
                  value={priorityFilter}
                  onChange={event => setPriorityFilter(event.target.value)}
                >
                  <option>All</option>
                  <option>Urgent</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
                <span className='task-count'>{allTasks.length} tasks</span>
              </div>
            )}
          </div>

          {view === 'analytics' ? (
            <div className='analytics'>
              {allTasks.length === 0 ? (
                <div className='analytics-empty-state'>
                  Add some tasks to this board to see analytics.
                </div>
              ) : (
                <>
                  <div className='analytics-stats'>
                    <div className='stat-card'>
                      <span className='stat-label'>Open tasks</span>
                      <strong>{openTasks.length}</strong>
                    </div>
                    <div
                      className={`stat-card ${overdueCount > 0 ? 'alert' : ''}`}
                    >
                      <span className='stat-label'>Overdue</span>
                      <strong>{overdueCount}</strong>
                    </div>
                    <div className='stat-card'>
                      <span className='stat-label'>Due in 7 days</span>
                      <strong>{dueSoonCount}</strong>
                    </div>
                    <div className='stat-card'>
                      <span className='stat-label'>Subtasks done</span>
                      <strong>
                        {subtaskDone}/{subtaskTotal}
                      </strong>
                    </div>
                  </div>

                  <div className='analytics-grid'>
                    <section className='panel'>
                      <h3>Tasks by column</h3>
                      <BarList rows={columnRows} emptyText='No columns.' />
                    </section>

                    <section className='panel'>
                      <h3>Tasks by priority</h3>
                      <BarList rows={priorityRows} emptyText='No tasks.' />
                    </section>

                    <section className='panel'>
                      <h3>Tasks by tag</h3>
                      <BarList rows={tagRows} emptyText='No tags yet.' />
                    </section>

                    <section className='panel'>
                      <h3>Next deadlines</h3>
                      {upcoming.length === 0 ? (
                        <p className='analytics-empty'>
                          No open tasks have a due date.
                        </p>
                      ) : (
                        <ul className='deadline-list'>
                          {upcoming.map(task => (
                            <li key={task.id}>
                              <div className='deadline-main'>
                                <strong>{task.title}</strong>
                                <span
                                  className={`priority priority-${task.priority.toLowerCase()}`}
                                >
                                  <span />
                                  {task.priority}
                                </span>
                              </div>
                              <span
                                className={`due-date ${
                                  task.dueDate < today ? 'overdue' : ''
                                }`}
                              >
                                {task.dueDate < today ? 'Overdue · ' : ''}
                                {formatDate(task.dueDate)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {tagList.length > 0 && (
                <div
                  className='tag-filter-bar'
                  role='group'
                  aria-label='Filter by tag'
                >
                  <span className='tag-filter-label'>Tags</span>
                  <button
                    className={`tag-chip ${
                      activeTag === 'All' ? 'active' : ''
                    }`}
                    aria-pressed={activeTag === 'All'}
                    onClick={() => setTagFilter('All')}
                  >
                    All
                  </button>
                  {tagList.map(tag => (
                    <button
                      key={tag}
                      className={`tag-chip ${
                        activeTag === tag ? 'active' : ''
                      }`}
                      aria-pressed={activeTag === tag}
                      onClick={() =>
                        setTagFilter(activeTag === tag ? 'All' : tag)
                      }
                    >
                      {tag}
                      <span className='tag-chip-count'>{tagCounts[tag]}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className='kanban-board'>
                {visibleColumns.map(column => {
                  const isDropTarget =
                    draggedTask &&
                    dropTarget?.columnId === column.id &&
                    draggedTask.columnId !== column.id;

                  const draggedIndex =
                    draggedTask && draggedTask.columnId === column.id
                      ? column.tasks.findIndex(
                          task => task.id === draggedTask.task.id
                        )
                      : -1;
                  const nextAfterDragged =
                    draggedIndex >= 0
                      ? column.tasks[draggedIndex + 1]?.id ?? null
                      : undefined;

                  const indicatorActive =
                    draggedTask &&
                    dropTarget?.columnId === column.id &&
                    !(
                      draggedIndex >= 0 &&
                      dropTarget.beforeId === nextAfterDragged
                    );

                  return (
                    <section
                      className={`kanban-column ${
                        isDropTarget ? 'drag-over' : ''
                      }`}
                      key={column.id}
                      aria-label={column.title}
                      onDragOver={event =>
                        handleColumnDragOver(event, column.id)
                      }
                      onDragLeave={event => {
                        if (
                          !event.currentTarget.contains(event.relatedTarget)
                        ) {
                          setDropTarget(null);
                        }
                      }}
                      onDrop={event => {
                        event.preventDefault();
                        dropTask(column.id);
                      }}
                    >
                      <div className='column-header'>
                        <div className='column-title-wrap'>
                          <span
                            className='column-indicator'
                            style={{ background: column.color }}
                          />
                          <h2>{column.title}</h2>
                          <span className='column-count'>
                            {column.tasks.length}
                          </span>
                        </div>

                        <div className='column-actions'>
                          <button
                            className='icon-button small'
                            title='Rename column'
                            aria-label='Rename column'
                            onClick={() =>
                              renameColumn(column.id, column.title)
                            }
                          >
                            ✎
                          </button>
                          <button
                            className='icon-button small'
                            title='Delete column'
                            aria-label='Delete column'
                            onClick={() => deleteColumn(column.id)}
                          >
                            ×
                          </button>
                          <button
                            className='icon-button small'
                            title='Add task'
                            aria-label='Add task to this column'
                            onClick={() => openNewTask(column.id)}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className='task-list'>
                        {column.tasks.map(task => {
                          const subtaskCount = task.subtasks?.length || 0;
                          const completedSubtasks =
                            task.subtasks?.filter(item => item.completed)
                              .length || 0;
                          const isDragging =
                            draggedTask && draggedTask.task.id === task.id;
                          const isOverdue =
                            task.dueDate &&
                            task.dueDate < today &&
                            !doneIds.has(task.id);

                          return (
                            <React.Fragment key={task.id}>
                              {indicatorActive &&
                                dropTarget.beforeId === task.id && (
                                  <div className='drop-indicator' />
                                )}

                              <article
                                className={`task-card ${
                                  isDragging ? 'dragging' : ''
                                }`}
                                data-task-id={task.id}
                                draggable
                                onDragStart={event => {
                                  event.dataTransfer.effectAllowed = 'move';
                                  event.dataTransfer.setData(
                                    'text/plain',
                                    task.id
                                  );
                                  setDraggedTask({
                                    task,
                                    columnId: column.id,
                                  });
                                }}
                                onDragEnd={clearDrag}
                              >
                                <div className='task-card-top'>
                                  <span
                                    className={`priority priority-${task.priority.toLowerCase()}`}
                                  >
                                    <span />
                                    {task.priority}
                                  </span>
                                  <button
                                    className='task-menu'
                                    aria-label={`Edit task: ${task.title}`}
                                    onClick={() => editTask(task, column.id)}
                                  >
                                    •••
                                  </button>
                                </div>

                                <button
                                  className='task-title-button'
                                  onClick={() => editTask(task, column.id)}
                                >
                                  {task.title}
                                </button>

                                {task.description && (
                                  <p className='task-description'>
                                    {task.description}
                                  </p>
                                )}

                                {subtaskCount > 0 && (
                                  <div className='task-subtasks'>
                                    <div className='task-subtasks-label'>
                                      ☑ {completedSubtasks}/{subtaskCount}{' '}
                                      subtasks
                                    </div>
                                    <div className='subtask-progress'>
                                      <div
                                        style={{
                                          width: `${
                                            (completedSubtasks /
                                              subtaskCount) *
                                            100
                                          }%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                <div className='task-card-footer'>
                                  <span className='task-tag'>{task.tag}</span>
                                  {task.dueDate && (
                                    <span
                                      className={`due-date ${
                                        isOverdue ? 'overdue' : ''
                                      }`}
                                    >
                                      ◷ {formatDate(task.dueDate)}
                                      {isOverdue ? ' · Overdue' : ''}
                                    </span>
                                  )}
                                </div>
                              </article>
                            </React.Fragment>
                          );
                        })}

                        {column.tasks.length > 0 &&
                          indicatorActive &&
                          dropTarget.beforeId === null && (
                            <div className='drop-indicator' />
                          )}

                        {column.tasks.length === 0 && (
                          <div className='empty-column'>
                            <span className='empty-icon'>＋</span>
                            <p>No tasks here yet</p>
                          </div>
                        )}
                      </div>

                      <button
                        className='add-task-inline'
                        onClick={() => openNewTask(column.id)}
                      >
                        + Add a task
                      </button>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>

      {showAddTask && (
        <div
          className='modal-backdrop'
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setShowAddTask(false);
            }
          }}
        >
          <div
            className='task-modal'
            role='dialog'
            aria-modal='true'
            aria-labelledby='task-modal-title'
          >
            <div className='modal-heading'>
              <div>
                <span className='eyebrow'>
                  {editingTask ? 'UPDATE TASK' : 'NEW TASK'}
                </span>
                <h2 id='task-modal-title'>
                  {editingTask ? 'Edit task' : 'Create a task'}
                </h2>
              </div>
              <button
                className='icon-button'
                aria-label='Close'
                onClick={() => setShowAddTask(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={saveTask}>
              <label>
                Task title
                <input
                  name='title'
                  defaultValue={editingTask?.title || ''}
                  placeholder='What needs to be done?'
                  required
                  autoFocus
                />
              </label>

              <label>
                Description
                <textarea
                  name='description'
                  defaultValue={editingTask?.description || ''}
                  placeholder='Add a few details...'
                  rows='3'
                />
              </label>

              <div className='form-row'>
                <label>
                  Priority
                  <select
                    name='priority'
                    defaultValue={editingTask?.priority || 'Medium'}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </label>

                <label>
                  Column
                  <select
                    value={newTaskColumn}
                    onChange={event => setNewTaskColumn(event.target.value)}
                  >
                    {columns.map(column => (
                      <option key={column.id} value={column.id}>
                        {column.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className='form-row'>
                <label>
                  Tag
                  <input
                    name='tag'
                    defaultValue={editingTask?.tag || ''}
                    placeholder='e.g. Design'
                  />
                </label>

                <label>
                  Due date
                  <input
                    name='dueDate'
                    type='date'
                    defaultValue={editingTask?.dueDate || ''}
                  />
                </label>
              </div>

              {editingTask && (
                <div className='subtasks'>
                  <strong className='subtasks-title'>Subtasks</strong>

                  {(editingTask.subtasks || []).map(item => (
                    <div key={item.id} className='subtask-row'>
                      <input
                        type='checkbox'
                        checked={item.completed}
                        aria-label={item.title}
                        onChange={() => toggleSubtask(item.id)}
                      />
                      <span
                        className={`subtask-text ${
                          item.completed ? 'done' : ''
                        }`}
                      >
                        {item.title}
                      </span>
                      <button
                        type='button'
                        className='subtask-remove'
                        aria-label='Remove subtask'
                        onClick={() => removeSubtask(item.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <div className='subtask-add'>
                    <input
                      className='subtask-input'
                      value={newSubtask}
                      aria-label='New subtask'
                      onChange={event => setNewSubtask(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addSubtask();
                        }
                      }}
                      placeholder='Add a subtask...'
                    />
                    <button
                      type='button'
                      className='secondary-button'
                      onClick={addSubtask}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              <div className='modal-footer'>
                {editingTask && (
                  <button
                    type='button'
                    className='delete-button'
                    onClick={() => {
                      deleteTask(editingTask.id);
                      setShowAddTask(false);
                    }}
                  >
                    Delete task
                  </button>
                )}

                <button
                  type='button'
                  className='secondary-button'
                  onClick={() => setShowAddTask(false)}
                >
                  Cancel
                </button>

                <button type='submit' className='primary-button'>
                  {editingTask ? 'Save changes' : 'Create task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paletteOpen && (
        <div
          className='modal-backdrop palette-backdrop'
          onMouseDown={event => {
            if (event.target === event.currentTarget) setPaletteOpen(false);
          }}
        >
          <div
            className='palette'
            role='dialog'
            aria-modal='true'
            aria-label='Command palette'
          >
            <input
              className='palette-input'
              autoFocus
              value={paletteQuery}
              onChange={event => {
                setPaletteQuery(event.target.value);
                setPaletteIndex(0);
              }}
              onKeyDown={handlePaletteKey}
              placeholder='Type a command, board or tag...'
              role='combobox'
              aria-label='Search commands'
              aria-expanded='true'
              aria-controls='palette-list'
              aria-activedescendant={
                filteredCommands.length ? `cmd-${safeIndex}` : undefined
              }
            />
            <ul className='palette-list' id='palette-list' role='listbox'>
              {filteredCommands.length === 0 && (
                <li className='palette-empty'>No matching commands</li>
              )}
              {filteredCommands.map((command, index) => (
                <li
                  key={command.id}
                  id={`cmd-${index}`}
                  role='option'
                  aria-selected={index === safeIndex}
                  className={`palette-item ${
                    index === safeIndex ? 'active' : ''
                  }`}
                  onMouseEnter={() => setPaletteIndex(index)}
                  onClick={() => runCommand(command)}
                >
                  <span>{command.label}</span>
                  {command.hint && <kbd>{command.hint}</kbd>}
                </li>
              ))}
            </ul>
            <div className='palette-footer'>
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>Enter</kbd> run
              </span>
              <span>
                <kbd>Esc</kbd> close
              </span>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div
          className='modal-backdrop'
          onMouseDown={event => {
            if (event.target === event.currentTarget) setShowHelp(false);
          }}
        >
          <div
            className='task-modal help-modal'
            role='dialog'
            aria-modal='true'
            aria-labelledby='help-title'
          >
            <div className='modal-heading'>
              <div>
                <span className='eyebrow'>KEYBOARD</span>
                <h2 id='help-title'>Shortcuts</h2>
              </div>
              <button
                className='icon-button'
                aria-label='Close'
                autoFocus
                onClick={() => setShowHelp(false)}
              >
                ×
              </button>
            </div>
            <ul className='shortcut-list'>
              {SHORTCUTS.map(([keys, description]) => (
                <li key={keys}>
                  <span>{description}</span>
                  <kbd>{keys === 'Ctrl K' ? `${modKey} K` : keys}</kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {notice && (
        <div className='toast' role='status'>
          {notice}
        </div>
      )}
    </div>
  );
}

export default App;
