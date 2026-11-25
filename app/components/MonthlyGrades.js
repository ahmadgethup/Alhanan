'use client';

import { useEffect, useState } from 'react';

const subjects = [
  'التربية الإسلامية',
  'اللغة العربية',
  'اللغة الإنجليزية',
  'الرياضيات',
  'الأحياء',
  'الكيمياء',
  'الفيزياء',
  'الاجتماعيات',
  'الحاسوب',
];

const emptyNotes = { positive: '', negative: '', notes: '' };

function monthLabel(month) {
  if (!month) return '';

  return new Intl.DateTimeFormat('ar-IQ', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}

async function request(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => null);

  if (!response.ok || data === null) {
    throw new Error(
      data?.error ||
      'تعذّر إكمال الطلب. تأكد من الاتصال وتسجيل الدخول لقسم الحاسبات.'
    );
  }

  return data;
}

function scoreKey(id, subject) {
  return JSON.stringify([String(id), subject]);
}

function mergeRows(previous, incoming, getKey) {
  const rows = new Map(previous.map(row => [getKey(row), row]));

  for (const row of incoming) rows.set(getKey(row), row);

  return [...rows.values()];
}

async function exportMonthlyCards(students, grades, notes, month) {
  const { jsPDF } = await import('jspdf');

  await document.fonts.ready;

  const logo = new Image();
  logo.src = '/hanan-logo.png';

  const hasLogo = await logo.decode()
    .then(() => true)
    .catch(() => false);

  const scores = new Map(
    grades.map(row => [scoreKey(row.student_id, row.subject), row.score])
  );

  const observations = new Map(
    notes.map(row => [String(row.student_id), row])
  );

  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 2263;

  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('تعذّر تجهيز بطاقات PDF.');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const blue = '#34799b';
  const ink = '#182e3b';
  const paleBlue = '#e4f1f7';
  const font = '"IBM Plex Sans Arabic", Tahoma, Arial, sans-serif';

  function text(value, x, y, size = 26, bold = false, align = 'right', max = 1300) {
    ctx.direction = 'rtl';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ink;
    ctx.font = `${bold ? '700' : '400'} ${size}px ${font}`;
    ctx.fillText(String(value), x, y, max);
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function headerBox(x, y, width, height, title) {
    ctx.fillStyle = paleBlue;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    text(title, x + width / 2, y + height / 2, 27, true, 'center');
  }

  function wrappedLines(value, width, size) {
    ctx.font = `400 ${size}px ${font}`;

    const lines = [];

    for (const paragraph of String(value || '—').split('\n')) {
      let current = '';

      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = current ? `${current} ${word}` : word;

        if (current && ctx.measureText(candidate).width > width) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }

      lines.push(current);
    }

    return lines;
  }

  function paragraph(value, x, y, width, height, initialSize = 23) {
    let size = initialSize;
    let lines = wrappedLines(value, width, size);

    while (size > 10 && lines.length * size * 1.55 > height) {
      size -= 1;
      lines = wrappedLines(value, width, size);
    }

    const lineHeight = Math.min(size * 1.55, height / Math.max(1, lines.length));

    lines.forEach((value, index) => {
      text(value, x, y + lineHeight * (index + 0.5), size, false, 'right', width);
    });
  }

  function drawCard(student, top) {
    const left = 80;
    const right = 1520;
    const width = right - left;
    const height = 1000;
    const observation = observations.get(String(student.id)) || emptyNotes;

    ctx.strokeStyle = blue;
    ctx.lineWidth = 2;

    ctx.fillStyle = '#fff';
    ctx.fillRect(left, top, width, height);

    // زخارف الزوايا الهادئة.
    ctx.fillStyle = '#e9f4fa';
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left + 145, top);
    ctx.lineTo(left, top + 95);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(right, top + height);
    ctx.lineTo(right - 145, top + height);
    ctx.lineTo(right, top + height - 95);
    ctx.closePath();
    ctx.fill();

    ctx.strokeRect(left, top, width, height);

    if (hasLogo) {
      const logoWidth = 128;
      const logoHeight = logoWidth * logo.naturalHeight / logo.naturalWidth;

      ctx.drawImage(
        logo,
        right - 155,
        top + 38,
        logoWidth,
        logoHeight
      );
    }

    text(
      'ثانوية حنان الأهلية للبنين',
      800,
      top + 65,
      39,
      true,
      'center',
      1000
    );

    text(
      'بطاقة الدرجات الشهرية',
      800,
      top + 120,
      32,
      false,
      'center'
    );

    ctx.strokeStyle = '#80afc4';
    line(650, top + 158, 950, top + 158);

    text(
      `اسم الطالب: ${student.full_name}`,
      right - 30,
      top + 208,
      27,
      true,
      'right',
      630
    );

    text(
      `الصف والشعبة: ${student.grade} / ${student.section}`,
      850,
      top + 208,
      24,
      false,
      'right',
      440
    );

    text(
      `الشهر: ${monthLabel(month)}`,
      390,
      top + 208,
      23,
      false,
      'right',
      285
    );

    ctx.strokeStyle = blue;

    // جدول المواد والدرجات: يسار البطاقة.
    const tableX = 110;
    const tableRight = 925;
    const divider = 360;
    const tableTop = top + 260;
    const rowHeight = 57;

    ctx.fillStyle = paleBlue;
    ctx.fillRect(tableX, tableTop, tableRight - tableX, rowHeight);

    text('المادة', 640, tableTop + 28, 28, true, 'center');
    text('الدرجة', 235, tableTop + 28, 28, true, 'center');

    subjects.forEach((subject, index) => {
      const y = tableTop + (index + 1) * rowHeight;
      const score = scores.get(scoreKey(student.id, subject));

      if (index % 2 === 1) {
        ctx.fillStyle = '#f7fbfd';
        ctx.fillRect(tableX, y, tableRight - tableX, rowHeight);
      }

      text(
        subject,
        tableRight - 22,
        y + rowHeight / 2,
        27,
        false,
        'right',
        tableRight - divider - 42
      );

      const missing = score === null || score === undefined;

      text(
        missing ? 'لم تُدخل الدرجة' : String(score),
        (tableX + divider) / 2,
        y + rowHeight / 2,
        missing ? 20 : 31,
        !missing,
        'center',
        divider - tableX - 24
      );
    });

    ctx.strokeRect(
      tableX,
      tableTop,
      tableRight - tableX,
      rowHeight * 10
    );

    line(divider, tableTop, divider, tableTop + rowHeight * 10);

    for (let row = 1; row < 10; row += 1) {
      line(
        tableX,
        tableTop + row * rowHeight,
        tableRight,
        tableTop + row * rowHeight
      );
    }

    // السلوك والملاحظات: يمين البطاقة.
    const sideX = 965;
    const sideWidth = 525;

    headerBox(sideX, tableTop, sideWidth, 57, 'السلوك');

    ctx.strokeRect(sideX, tableTop + 57, sideWidth, 180);

    const middle = sideX + sideWidth / 2;
    line(middle, tableTop + 57, middle, tableTop + 237);

    text(
      'الموجب',
      sideX + sideWidth * 0.75,
      tableTop + 88,
      25,
      true,
      'center'
    );

    text(
      'السالب',
      sideX + sideWidth * 0.25,
      tableTop + 88,
      25,
      true,
      'center'
    );

    paragraph(
      observation.positive,
      sideX + sideWidth - 18,
      tableTop + 112,
      sideWidth / 2 - 36,
      112
    );

    paragraph(
      observation.negative,
      middle - 18,
      tableTop + 112,
      sideWidth / 2 - 36,
      112
    );

    const notesTop = tableTop + 260;

    headerBox(sideX, notesTop, sideWidth, 57, 'ملاحظات');
    ctx.strokeRect(sideX, notesTop + 57, sideWidth, 253);

    if (observation.notes) {
      paragraph(
        observation.notes,
        sideX + sideWidth - 20,
        notesTop + 70,
        sideWidth - 40,
        225,
        24
      );
    } else {
      ctx.strokeStyle = '#a8c7d6';

      for (let row = 0; row < 5; row += 1) {
        const y = notesTop + 104 + row * 38;
        line(sideX + 20, y, sideX + sideWidth - 20, y);
      }

      ctx.strokeStyle = blue;
    }

    // خطوط إلى جانب التسميات.
    text('مدير المدرسة', 895, top + 910, 26, true);
    line(140, top + 910, 700, top + 910);

    text('المرشد', 1490, top + 910, 26, true);
    line(1010, top + 910, 1380, top + 910);

    text('ولي الأمر', 1490, top + 965, 26, true);
    line(1010, top + 965, 1355, top + 965);
  }

  for (let index = 0; index < students.length; index += 2) {
    if (index) pdf.addPage();

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawCard(students[index], 75);

    if (students[index + 1]) {
      ctx.strokeStyle = '#a9c2cf';
      ctx.setLineDash([10, 12]);
      line(80, 1127, 1520, 1127);
      ctx.setLineDash([]);

      drawCard(students[index + 1], 1180);
    }

    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.94),
      'JPEG',
      0,
      0,
      210,
      297
    );

    // السماح للواجهة بالتحديث أثناء تجهيز عدد كبير من الصفحات.
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  pdf.save(`hanan-monthly-cards-${month}.pdf`);
}

export default function MonthlyGrades({ mode = 'teacher' }) {
  const admin = mode === 'computer';

  const [students, setStudents] = useState(null);
  const [rosterError, setRosterError] = useState('');
  const [rosterRetry, setRosterRetry] = useState(0);

  const [month, setMonth] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [search, setSearch] = useState('');

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [changes, setChanges] = useState({});
  const [noteChanges, setNoteChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Baghdad',
    }).format(new Date());

    setMonth(today.slice(0, 7));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setRosterError('');

    request('/api/roster', { signal: controller.signal })
      .then(rows => {
        if (!Array.isArray(rows)) throw new Error('قائمة الطلاب غير صالحة.');

        if (!controller.signal.aborted) setStudents(rows);
      })
      .catch(cause => {
        if (!controller.signal.aborted) setRosterError(cause.message);
      });

    return () => controller.abort();
  }, [rosterRetry]);

  const key = JSON.stringify([mode, month, admin ? '' : subject]);
  const ready = Boolean(month && (admin || subject));
  const active = ready && data?.key === key;
  const busy = saving || exporting;

  const changedCount = admin
    ? Object.keys(noteChanges).length
    : Object.keys(changes).length;

  useEffect(() => {
    setError('');

    if (!ready) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ month });

    if (!admin) params.set('subject', subject);

    Promise.all([
      request(`/api/grades?${params}`, { signal: controller.signal }),
      admin
        ? request(
            `/api/students/monthly?${new URLSearchParams({ month })}`,
            { signal: controller.signal }
          )
        : Promise.resolve([]),
    ])
      .then(([grades, notes]) => {
        if (!Array.isArray(grades) || !Array.isArray(notes)) {
          throw new Error('البيانات المستلمة غير صالحة.');
        }

        if (!controller.signal.aborted) {
          setData({ key, grades, notes });
        }
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause.message);
      });

    return () => controller.abort();
  }, [ready, key, month, subject, admin, retry]);

  useEffect(() => {
    if (!changedCount && !saving) return;

    function warn(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changedCount, saving]);

  function changeFilter(update) {
    if (busy) return;

    if (changedCount &&
        !window.confirm('عندك تغييرات غير محفوظة. تريد تغيير الاختيار؟')) {
      return;
    }

    setChanges({});
    setNoteChanges({});
    setMessage('');
    update();
  }

  const roster = students ?? [];
  const grades = [...new Set(roster.map(student => student.grade))];

  const sections = [...new Set(
    roster
      .filter(student => !grade || student.grade === grade)
      .map(student => student.section)
  )];

  const visible = roster.filter(student =>
    (admin
      ? (!grade || student.grade === grade) &&
        (!section || student.section === section)
      : Boolean(grade && section) &&
        student.grade === grade &&
        student.section === section
    ) &&
    student.full_name.includes(search.trim())
  );

  const scores = new Map(
    (active ? data.grades : []).map(row => [
      scoreKey(row.student_id, row.subject),
      row.score,
    ])
  );

  const savedNotes = new Map(
    (active ? data.notes : []).map(row => [String(row.student_id), row])
  );

  let completed = 0;

  for (const student of visible) {
    for (const name of admin ? subjects : [subject]) {
      const value = scores.get(scoreKey(student.id, name));

      if (value !== undefined && value !== null) completed += 1;
    }
  }

  const expected = visible.length * (admin ? subjects.length : 1);

  function editScore(id, value) {
    setMessage('');

    setChanges(previous => {
      const next = { ...previous };
      const saved = scores.get(scoreKey(id, subject));
      const original = saved === undefined || saved === null ? '' : String(saved);

      if (value === original) delete next[id];
      else next[id] = value;

      return next;
    });
  }

  function editNote(id, field, value) {
    setMessage('');

    setNoteChanges(previous => {
      const saved = savedNotes.get(String(id)) || emptyNotes;

      const draft = {
        positive: saved.positive || '',
        negative: saved.negative || '',
        notes: saved.notes || '',
        ...previous[id],
        [field]: value,
      };

      const next = { ...previous };

      const same = ['positive', 'negative', 'notes'].every(
        name => draft[name] === (saved[name] || '')
      );

      if (same) delete next[id];
      else next[id] = draft;

      return next;
    });
  }

  async function save() {
    if (busy || !active || !changedCount) return;

    setMessage('');
    setSaving(true);

    try {
      if (admin) {
        const entries = Object.entries(noteChanges).map(([id, values]) => ({
          id: Number(id),
          ...values,
        }));

        const result = await request('/api/students/monthly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month, entries }),
        });

        setData(previous => ({
          ...previous,
          notes: mergeRows(
            previous.notes,
            result.rows,
            row => String(row.student_id)
          ),
        }));

        setNoteChanges({});
        setMessage(`تم حفظ السلوك والملاحظات لـ ${result.saved} طالب.`);
      } else {
        const entries = Object.entries(changes).map(([id, value]) => ({
          id: Number(id),
          score: value === '' ? null : Number(value),
        }));

        if (entries.some(row =>
          row.score !== null &&
          (!Number.isFinite(row.score) || row.score < 0 || row.score > 100)
        )) {
          throw new Error('الدرجة يجب أن تكون بين ٠ و١٠٠.');
        }

        const result = await request('/api/grades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month, subject, entries }),
        });

        setData(previous => ({
          ...previous,
          grades: mergeRows(
            previous.grades,
            result.rows,
            row => scoreKey(row.student_id, row.subject)
          ),
        }));

        setChanges({});
        setMessage(`تم حفظ ${result.saved} درجة في قاعدة البيانات.`);
      }
    } catch (cause) {
      setMessage(cause.message);
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    if (!active || busy || changedCount || !visible.length) return;

    setExporting(true);
    setMessage('جارٍ تجهيز البطاقات…');

    try {
      // جلب أحدث نسخة محفوظة قبل إنشاء الملف.
      const params = new URLSearchParams({ month });

      const [freshGrades, freshNotes] = await Promise.all([
        request(`/api/grades?${params}`),
        request(`/api/students/monthly?${params}`),
      ]);

      if (!Array.isArray(freshGrades) || !Array.isArray(freshNotes)) {
        throw new Error('تعذّر قراءة بيانات البطاقات.');
      }

      setData({ key, grades: freshGrades, notes: freshNotes });

      await exportMonthlyCards(
        visible,
        freshGrades,
        freshNotes,
        month
      );

      setMessage(
        `تم تجهيز ${visible.length} بطاقة في ${Math.ceil(visible.length / 2)} صفحة.`
      );
    } catch (cause) {
      setMessage(cause.message || 'تعذّر تنزيل البطاقات.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="monthly-screen" dir="rtl" lang="ar">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        precedence="monthly-font"
      />

      <div className="monthly-heading">
        <div>
          <span className="monthly-badge">الدرجات من ١٠٠</span>
          <h2>{admin ? 'الدرجات والبطاقات الشهرية' : 'إدخال درجات الطلاب'}</h2>
          <p>
            {admin
              ? 'راجع الدرجات، أضف السلوك والملاحظات، ثم نزّل البطاقات.'
              : 'اختر المادة والصف والشعبة والشهر، ثم أدخل الدرجات واحفظها.'}
          </p>
        </div>
        <span className="monthly-heading-icon" aria-hidden="true">١٠٠</span>
      </div>

      {rosterError && (
        <div className="monthly-notice" role="alert">
          <p>{rosterError}</p>
          <button type="button" onClick={() => setRosterRetry(value => value + 1)}>
            إعادة تحميل الطلاب
          </button>
        </div>
      )}

      {!students && !rosterError && <p role="status">جارٍ تحميل الطلاب…</p>}

      <div className="monthly-filters">
        <label>
          الشهر
          <input
            type="month"
            min="1900-01"
            max="2200-12"
            required
            dir="ltr"
            value={month}
            disabled={busy}
            onChange={event => {
              const value = event.target.value;
              changeFilter(() => setMonth(value));
            }}
          />
        </label>

        {!admin && (
          <label>
            المادة
            <select
              value={subject}
              disabled={busy}
              onChange={event => {
                const value = event.target.value;
                changeFilter(() => setSubject(value));
              }}
            >
              <option value="">اختر المادة</option>
              {subjects.map(name => <option key={name}>{name}</option>)}
            </select>
          </label>
        )}

        <label>
          الصف
          <select
            value={grade}
            disabled={busy}
            onChange={event => {
              const value = event.target.value;
              changeFilter(() => {
                setGrade(value);
                setSection('');
              });
            }}
          >
            <option value="">{admin ? 'كل الصفوف' : 'اختر الصف'}</option>
            {grades.map(name => <option key={name}>{name}</option>)}
          </select>
        </label>

        <label>
          الشعبة
          <select
            value={section}
            disabled={busy || (!admin && !grade)}
            onChange={event => {
              const value = event.target.value;
              changeFilter(() => setSection(value));
            }}
          >
            <option value="">{admin ? 'كل الشعب' : 'اختر الشعبة'}</option>
            {sections.map(name => <option key={name}>{name}</option>)}
          </select>
        </label>

        {admin && (
          <label>
            البحث بالاسم
            <input
              type="search"
              value={search}
              disabled={busy}
              onChange={event => setSearch(event.target.value)}
            />
          </label>
        )}
      </div>

      {ready && !active && !error && <p role="status">جارٍ تحميل الدرجات…</p>}

      {error && (
        <div className="monthly-notice" role="alert">
          <p>{error}</p>
          <button
            type="button"
            disabled={busy || changedCount > 0}
            onClick={() => {
              setData(null);
              setError('');
              setRetry(value => value + 1);
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {active && (
        <>
          <div className="monthly-summary">
            <div>
              <strong>{monthLabel(month)}</strong>
              <span>{visible.length} طالب في القائمة</span>
            </div>

            <div>
              <strong>{completed} / {expected}</strong>
              <span>درجة محفوظة</span>
            </div>

            {admin && (
              <button
                type="button"
                className="monthly-primary"
                disabled={busy || !!changedCount || !visible.length}
                onClick={download}
              >
                {exporting ? 'جارٍ تجهيز PDF…' : 'تنزيل بطاقات الدرجات PDF'}
              </button>
            )}
          </div>

          {admin && (
            <p className="monthly-help">
              يمكن تنزيل البطاقات قبل اكتمال الدرجات.
              الملف يشمل الطلاب الظاهرين حسب البحث والصف والشعبة.
              احفظ تعديلات السلوك قبل التنزيل.
            </p>
          )}

          {visible.length > 0 ? (
            <div className="monthly-table-wrap">
              <table className={admin ? 'monthly-admin-table' : ''}>
                <thead>
                  <tr>
                    <th scope="col">ت</th>
                    <th scope="col">اسم الطالب</th>

                    {admin ? (
                      <>
                        {subjects.map(name => <th scope="col" key={name}>{name}</th>)}
                        <th scope="col">السلوك الموجب</th>
                        <th scope="col">السلوك السالب</th>
                        <th scope="col">ملاحظات</th>
                      </>
                    ) : <th scope="col">الدرجة / ١٠٠</th>}
                  </tr>
                </thead>

                <tbody>
                  {visible.map((student, index) => {
                    const id = String(student.id);
                    const saved = scores.get(scoreKey(id, subject));
                    const score = changes[id] ??
                      (saved === undefined || saved === null ? '' : String(saved));

                    const observation = noteChanges[id] ||
                      savedNotes.get(id) || emptyNotes;

                    const pending = admin
                      ? Object.hasOwn(noteChanges, id)
                      : Object.hasOwn(changes, id);

                    return (
                      <tr key={id} className={pending ? 'monthly-pending' : ''}>
                        <td>{index + 1}</td>
                        <th scope="row">
                          {student.full_name}
                          {admin && <small>{student.grade} · {student.section}</small>}
                        </th>

                        {admin ? (
                          <>
                            {subjects.map(name => {
                              const value = scores.get(scoreKey(id, name));

                              return (
                                <td key={name} className="monthly-score-cell">
                                  {value === null || value === undefined
                                    ? <span className="monthly-missing">—</span>
                                    : value}
                                </td>
                              );
                            })}

                            {['positive', 'negative', 'notes'].map(field => (
                              <td key={field}>
                                <textarea
                                  rows={3}
                                  maxLength={field === 'notes' ? 500 : 200}
                                  value={observation[field] || ''}
                                  disabled={busy}
                                  aria-label={`${
                                    field === 'positive'
                                      ? 'السلوك الموجب'
                                      : field === 'negative'
                                        ? 'السلوك السالب'
                                        : 'ملاحظات'
                                  } للطالب ${student.full_name}`}
                                  onChange={event =>
                                    editNote(id, field, event.target.value)
                                  }
                                />
                              </td>
                            ))}
                          </>
                        ) : (
                          <td className="monthly-score-input">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              max="100"
                              step="any"
                              placeholder="لم تُدخل"
                              value={score}
                              disabled={busy}
                              aria-label={`درجة ${student.full_name} في ${subject}`}
                              onChange={event => editScore(id, event.target.value)}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="monthly-help">
              {!admin && (!grade || !section)
                ? 'اختر الصف والشعبة لعرض الطلاب.'
                : 'لا يوجد طلاب مطابقون للاختيار.'}
            </p>
          )}

          <div className="monthly-save-bar">
            <p role="status" aria-live="polite">
              {message || (
                changedCount
                  ? `${changedCount} طالب لديهم تغييرات غير محفوظة`
                  : 'البيانات المعروضة هي آخر نسخة تم تحميلها.'
              )}
            </p>

            <button
              type="button"
              className="monthly-primary"
              disabled={busy || !changedCount}
              onClick={save}
            >
              {saving
                ? 'جارٍ الحفظ…'
                : admin
                  ? 'حفظ السلوك والملاحظات'
                  : 'حفظ الدرجات'}
            </button>
          </div>
        </>
      )}

      <style jsx global>{`
        .monthly-screen {
          --monthly-blue: #24678f;
          --monthly-ink: #172c3a;
          --monthly-border: #dce7ee;
          width: 100%;
          min-width: 0;
          color: var(--monthly-ink);
          font: 16px/1.7 'IBM Plex Sans Arabic', Tahoma, sans-serif;
        }

        .monthly-screen * {
          box-sizing: border-box;
        }

        .monthly-screen .monthly-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
          padding: clamp(18px, 3vw, 28px);
          border: 1px solid #d5e7f1;
          border-radius: 18px;
          background: linear-gradient(115deg, #fff, #eaf5fc);
        }

        .monthly-screen .monthly-heading h2 {
          margin: 8px 0 3px;
          color: #173c55;
          font-size: clamp(24px, 3vw, 34px);
          line-height: 1.4;
        }

        .monthly-screen .monthly-heading p {
          margin: 0;
          color: #587083;
        }

        .monthly-screen .monthly-badge {
          display: inline-block;
          padding: 3px 10px;
          border: 1px solid #cbe0ed;
          border-radius: 999px;
          background: #fff;
          color: var(--monthly-blue);
          font-size: 12px;
          font-weight: 600;
        }

        .monthly-screen .monthly-heading-icon {
          display: grid;
          flex-shrink: 0;
          place-items: center;
          width: 78px;
          height: 78px;
          border: 1px solid #cae0ed;
          border-radius: 23px;
          background: #fff;
          color: var(--monthly-blue);
          font-size: 28px;
          font-weight: 700;
          box-shadow: 0 8px 25px #24678f0d;
        }

        .monthly-screen .monthly-filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
          gap: 14px;
          padding: 18px;
          border: 1px solid var(--monthly-border);
          border-radius: 14px;
          background: #fff;
        }

        .monthly-screen label {
          display: grid;
          gap: 6px;
          min-width: 0;
          color: #334f61;
          font-size: 14px;
          font-weight: 600;
        }

        .monthly-screen input,
        .monthly-screen select,
        .monthly-screen textarea {
          width: 100%;
          min-width: 0;
          min-height: 43px;
          padding: 8px 11px;
          border: 1px solid #c9dbe7;
          border-radius: 9px;
          background: #fff;
          color: var(--monthly-ink);
          font: inherit;
          font-size: 15px;
        }

        .monthly-screen textarea {
          min-width: 185px;
          min-height: 95px;
          resize: vertical;
        }

        .monthly-screen input:disabled,
        .monthly-screen select:disabled,
        .monthly-screen textarea:disabled {
          opacity: .65;
        }

        .monthly-screen button {
          padding: 9px 16px;
          border: 1px solid #c9dbe7;
          border-radius: 9px;
          background: #fff;
          color: var(--monthly-blue);
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          font-weight: 600;
        }

        .monthly-screen button.monthly-primary {
          border-color: var(--monthly-blue);
          background: var(--monthly-blue);
          color: #fff;
        }

        .monthly-screen button:disabled {
          opacity: .5;
          cursor: default;
        }

        .monthly-screen .monthly-summary {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 14px 30px;
          margin-top: 18px;
          padding: 18px;
          border: 1px solid var(--monthly-border);
          border-radius: 14px;
          background: #fff;
        }

        .monthly-screen .monthly-summary div {
          display: grid;
        }

        .monthly-screen .monthly-summary strong {
          font-size: 19px;
        }

        .monthly-screen .monthly-summary span {
          color: #637987;
          font-size: 13px;
        }

        .monthly-screen .monthly-summary button {
          margin-inline-start: auto;
        }

        .monthly-screen .monthly-help {
          margin: 12px 0;
          color: #617684;
          font-size: 14px;
        }

        .monthly-screen .monthly-table-wrap {
          max-height: 65vh;
          overflow: auto;
          margin-top: 16px;
          border: 1px solid var(--monthly-border);
          border-radius: 14px;
          background: #fff;
        }

        .monthly-screen table {
          width: 100%;
          border-collapse: collapse;
        }

        .monthly-screen .monthly-admin-table {
          min-width: 1900px;
        }

        .monthly-screen th,
        .monthly-screen td {
          padding: 12px;
          border-bottom: 1px solid #e6eef3;
          text-align: start;
          vertical-align: middle;
        }

        .monthly-screen thead {
          position: sticky;
          top: 0;
          z-index: 1;
          background: #eaf3f9;
          color: #28556f;
        }

        .monthly-screen thead th {
          font-size: 13px;
          line-height: 1.6;
        }

        .monthly-screen tbody th {
          min-width: 170px;
          font-size: 15px;
          font-weight: 500;
        }

        .monthly-screen tbody th small {
          display: block;
          margin-top: 3px;
          color: #6e8290;
          font-size: 12px;
        }

        .monthly-screen tbody tr:nth-child(even) {
          background: #fafcfe;
        }

        .monthly-screen tbody tr.monthly-pending {
          background: #fff7e9;
        }

        .monthly-screen .monthly-score-cell {
          text-align: center;
          font-weight: 600;
        }

        .monthly-screen .monthly-missing {
          color: #9aabb6;
        }

        .monthly-screen .monthly-score-input {
          width: 170px;
        }

        .monthly-screen .monthly-score-input input {
          min-width: 100px;
          text-align: center;
          font-size: 18px;
          font-weight: 600;
        }

        .monthly-screen .monthly-save-bar {
          position: sticky;
          bottom: 0;
          z-index: 2;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 14px;
          padding: 14px 18px;
          border: 1px solid var(--monthly-border);
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 -6px 22px #173c550a;
        }

        .monthly-screen .monthly-save-bar p {
          margin: 0;
          font-size: 14px;
        }

        .monthly-screen .monthly-notice {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          margin-block: 14px;
          padding: 14px;
          border: 1px solid #efdab9;
          border-radius: 12px;
          background: #fff8ef;
          color: #805021;
        }

        .monthly-screen .monthly-notice p {
          margin: 0;
        }

        .monthly-screen :is(button, input, select, textarea):focus-visible {
          outline: 3px solid #72afd1;
          outline-offset: 3px;
        }

        @media (max-width: 600px) {
          .monthly-screen .monthly-heading-icon {
            display: none;
          }

          .monthly-screen .monthly-filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            padding: 12px;
          }

          .monthly-screen .monthly-summary button,
          .monthly-screen .monthly-save-bar button {
            width: 100%;
          }

          .monthly-screen th,
          .monthly-screen td {
            padding: 9px;
          }
        }
      `}</style>
    </section>
  );
}