'use client';

import Link from 'next/link';
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

const fields = [
  ['full_name', 'اسم الطالب', 160],
  ['grade', 'الصف', 80],
  ['section', 'الشعبة', 20],
  ['enrollment_status', 'الحالة (اختياري)', 60],
];

const percentage = new Intl.NumberFormat('ar-IQ', {
  style: 'percent',
  maximumFractionDigits: 2,
});

function percent(done, total) {
  return percentage.format(total ? done / total : 0);
}

async function request(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `تعذّر إكمال الطلب (${response.status}).`);
  }

  if (data === null) {
    throw new Error('الرد المستلم غير صالح.');
  }

  return data;
}

async function readList(url, signal) {
  const rows = await request(url, { signal });
  if (!Array.isArray(rows)) throw new Error('تعذّر قراءة القائمة.');
  return rows;
}

function todayInBaghdad() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Baghdad',
  }).format(new Date());
}

async function exportReports(students, ratings, week) {
  const { jsPDF } = await import('jspdf');
  await document.fonts.ready;

  const logo = new Image();
  logo.src = '/hanan-logo.png';
  const hasLogo = await logo.decode().then(() => true).catch(() => false);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 1980;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذّر تجهيز صفحات PDF.');

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  function text(value, x, y, size, bold = false, width = 1100) {
    ctx.fillStyle = '#173728';
    ctx.font = `${bold ? 'bold ' : ''}${size}px Arial, sans-serif`;
    ctx.fillText(value, x, y, width);
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawReport(student, top) {
    const left = 85;
    const right = 1315;
    const divider = 650;
    const tableTop = top + 218;
    const rowHeight = 50;
    const tableHeight = (subjects.length + 1) * rowHeight;
    const studentRatings = ratings.get(String(student.id));

    if (hasLogo) {
      const height = 130 * logo.naturalHeight / logo.naturalWidth;
      ctx.drawImage(logo, left, top + 12, 130, height);
    }

    text('مدرسة حنان الأهلية', right, top + 24, 28);
    text('تقرير متابعة الطالب الأسبوعي', right, top + 77, 44, true);
    text(`الطالب: ${student.full_name}`, right, top + 132, 36, true, 1050);
    text(`${student.grade} · الشعبة ${student.section}`, right, top + 181, 30, false, 620);
    text(`الأسبوع المنتهي في ${week}`, divider - 25, top + 181, 28, false, 510);

    ctx.fillStyle = '#e0ede4';
    ctx.fillRect(left, tableTop, right - left, rowHeight);
    text('المادة', right - 25, tableTop + 25, 32, true);
    text('التقييم', divider - 25, tableTop + 25, 32, true);

    subjects.forEach((subject, index) => {
      const y = tableTop + (index + 1) * rowHeight;
      ctx.fillStyle = index % 2 ? '#f5f8f5' : '#fff';
      ctx.fillRect(left, y, right - left, rowHeight);

      text(subject, right - 25, y + 25, 30, false, right - divider - 50);
      text(
        studentRatings?.get(subject) || 'غير مقيّم حتى الآن',
        divider - 25,
        y + 25,
        29,
        false,
        divider - left - 50,
      );
    });

    ctx.strokeStyle = '#a8b7ad';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, tableTop, right - left, tableHeight);
    line(divider, tableTop, divider, tableTop + tableHeight);

    for (let index = 1; index <= subjects.length; index += 1) {
      const y = tableTop + index * rowHeight;
      line(left, y, right, y);
    }

    text('الملاحظات: ................................................', right, top + 768, 28);
    text('توقيع الإدارة: ........................', right, top + 832, 28);
    text('توقيع ولي الأمر: ........................', divider - 25, top + 832, 28);
  }

  for (let index = 0; index < students.length; index += 2) {
    if (index) pdf.addPage();

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawReport(students[index], 55);

    if (students[index + 1]) {
      ctx.strokeStyle = '#96a99c';
      ctx.setLineDash([12, 12]);
      line(85, 990, 1315, 990);
      ctx.setLineDash([]);
      drawReport(students[index + 1], 1045);
    }

    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);

    if (index % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  pdf.save(`hanan-weekly-reports-${week}.pdf`);
  return Math.ceil(students.length / 2);
}

function StudentManager({ students, refresh }) {
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const grades = [...new Set(students.map(student => student.grade))];
  const sections = [...new Set(
    students.filter(student => !grade || student.grade === grade)
      .map(student => student.section)
  )];

  const visible = students.filter(student =>
    (!grade || student.grade === grade) &&
    (!section || student.section === section) &&
    student.full_name.includes(search.trim())
  );

  function openEditor(student) {
    setError('');
    setMessage('');
    setDraft(student ? {
      id: Number(student.id),
      full_name: student.full_name,
      grade: student.grade,
      section: student.section,
      enrollment_status: student.enrollment_status ?? '',
    } : {
      id: null,
      full_name: '',
      grade,
      section,
      enrollment_status: '',
    });

    document.getElementById('students-title')?.scrollIntoView({ block: 'start' });
  }

  async function save(event) {
    event.preventDefault();
    if (saving || !draft) return;

    setSaving(true);
    setError('');

    try {
      await request('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });

      setDraft(null);

      try {
        await refresh();
        setMessage('تم حفظ بيانات الطالب.');
      } catch {
        setMessage('تم حفظ الطالب. حدّث الصفحة لإعادة تحميل القائمة.');
      }
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="computer-card" aria-labelledby="students-title">
      <div className="computer-toolbar">
        <div>
          <h2 id="students-title">قائمة الطلاب</h2>
          <p className="computer-muted">{visible.length} من {students.length} طالب</p>
        </div>
        <button type="button" className="computer-primary"
          disabled={saving || Boolean(draft)} onClick={() => openEditor()}>
          ＋ إضافة طالب
        </button>
      </div>

      {message && <p className="computer-status" role="status">{message}</p>}

      {draft && (
        <form className="computer-editor" onSubmit={save}>
          <h3>{draft.id === null ? 'إضافة طالب' : 'تعديل معلومات الطالب'}</h3>
          <div className="computer-fields">
            {fields.map(([key, label, limit]) => (
              <label key={key}>
                {label}
                <input
                  value={draft[key]}
                  maxLength={limit}
                  required={key !== 'enrollment_status'}
                  disabled={saving}
                  list={key === 'grade' ? 'existing-grades' : undefined}
                  onChange={event => {
                    const value = event.target.value;
                    setDraft(previous => ({ ...previous, [key]: value }));
                  }}
                />
              </label>
            ))}
          </div>
          <datalist id="existing-grades">
            {grades.map(value => <option key={value} value={value} />)}
          </datalist>

          {error && <p className="computer-error" role="alert">{error}</p>}

          <div className="computer-actions">
            <button className="computer-primary" type="submit" disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ بيانات الطالب'}
            </button>
            <button className="computer-quiet" type="button" disabled={saving}
              onClick={() => setDraft(null)}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div className="computer-fields">
        <label>
          البحث بالاسم
          <input type="search" value={search}
            onChange={event => setSearch(event.target.value)} />
        </label>
        <label>
          الصف
          <select value={grade} onChange={event => {
            setGrade(event.target.value);
            setSection('');
          }}>
            <option value="">كل الصفوف</option>
            {grades.map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>
          الشعبة
          <select value={section} onChange={event => setSection(event.target.value)}>
            <option value="">كل الشعب</option>
            {sections.map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>

      {visible.length ? (
        <div className="computer-table computer-roster">
          <table>
            <thead>
              <tr>
                <th scope="col">اسم الطالب</th>
                <th scope="col">الصف</th>
                <th scope="col">الشعبة</th>
                <th scope="col">الحالة</th>
                <th scope="col">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(student => (
                <tr key={student.id}>
                  <th scope="row">{student.full_name}</th>
                  <td>{student.grade}</td>
                  <td>{student.section}</td>
                  <td>{student.enrollment_status || '—'}</td>
                  <td>
                    <button type="button" className="computer-quiet"
                      aria-label={`تعديل بيانات ${student.full_name}`}
                      disabled={saving || Boolean(draft)}
                      onClick={() => openEditor(student)}>
                      تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="computer-muted">ماكو طلاب مطابقين للبحث.</p>}
    </section>
  );
}

export default function ComputerPage() {
  const [tab, setTab] = useState('students');
  const [students, setStudents] = useState(null);
  const [rosterError, setRosterError] = useState('');
  const [rosterAttempt, setRosterAttempt] = useState(0);
  const [date, setDate] = useState('');
  const [query, setQuery] = useState(null);
  const [ratings, setRatings] = useState(null);
  const [ratingsError, setRatingsError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  useEffect(() => {
    const week = todayInBaghdad();
    setDate(week);
    setQuery({ week });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    readList('/api/roster', controller.signal)
      .then(rows => {
        if (!controller.signal.aborted) setStudents(rows);
      })
      .catch(error => {
        if (!controller.signal.aborted) setRosterError(error.message);
      });

    return () => controller.abort();
  }, [rosterAttempt]);

  useEffect(() => {
    if (!query) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ week: query.week });

    readList(`/api/ratings?${params}`, controller.signal)
      .then(rows => {
        if (!controller.signal.aborted) setRatings(rows);
      })
      .catch(error => {
        if (!controller.signal.aborted) setRatingsError(error.message);
      });

    return () => controller.abort();
  }, [query]);

  const ratingsByStudent = new Map();
  for (const row of ratings ?? []) {
    if (!row.rating || !subjects.includes(row.subject)) continue;
    const id = String(row.student_id);
    if (!ratingsByStudent.has(id)) ratingsByStudent.set(id, new Map());
    ratingsByStudent.get(id).set(row.subject, row.rating);
  }

  const groups = new Map();
  let done = 0;

  for (const student of students ?? []) {
    const key = JSON.stringify([student.grade, student.section]);

    if (!groups.has(key)) {
      groups.set(key, {
        grade: student.grade,
        section: student.section,
        count: 0,
        ratings: new Map(),
      });
    }

    const group = groups.get(key);
    group.count += 1;

    for (const subject of ratingsByStudent.get(String(student.id))?.keys() ?? []) {
      group.ratings.set(subject, (group.ratings.get(subject) ?? 0) + 1);
      done += 1;
    }
  }

  const studentCount = students?.length ?? 0;
  const required = studentCount * subjects.length;
  const canExport = Boolean(studentCount && query && ratings !== null);

  async function refreshRoster() {
    const rows = await readList('/api/roster');
    setStudents(rows);
    setRosterError('');
  }

  function showProgress(event) {
    event.preventDefault();
    if (!date || exporting) return;

    setRatings(null);
    setRatingsError('');
    setExportMessage('');
    setQuery({ week: date });
  }

  async function downloadPdf() {
    if (!canExport || exporting) return;
    setExporting(true);
    setExportMessage('');

    try {
      const pages = await exportReports(students, ratingsByStudent, query.week);
      setExportMessage(`تم تجهيز ${pages} صفحة.`);
    } catch {
      setExportMessage('تعذّر تنزيل PDF. حاول مرة ثانية.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="hanan-computer" dir="rtl" lang="ar">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        precedence="hanan-font"
      />

      <div className="computer-shell">
        <header className="computer-toolbar computer-header">
          <div className="computer-brand">
            <img src="/hanan-logo.png" alt="" width={50} height={42} />
            <strong>مدرسة حنان الأهلية</strong>
          </div>
          <Link className="computer-back" href="/">العودة إلى حنان ←</Link>
        </header>

        <h1>قسم الحاسبات</h1>
        <nav className="computer-actions computer-nav" aria-label="أقسام لوحة الحاسبات">
          <button type="button" className="computer-quiet" aria-pressed={tab === 'students'}
            onClick={() => setTab('students')}>
            إدارة الطلاب
          </button>
          <button type="button" className="computer-quiet" aria-pressed={tab === 'reports'}
            onClick={() => setTab('reports')}>
            الإنجاز والتقارير
          </button>
        </nav>

        {rosterError && (
          <div className="computer-card">
            <p className="computer-error" role="alert">{rosterError}</p>
            <button type="button" className="computer-quiet" onClick={() => {
              setRosterError('');
              setRosterAttempt(value => value + 1);
            }}>
              إعادة تحميل الطلاب
            </button>
          </div>
        )}

        {!students && !rosterError && <p role="status">جارٍ تحميل الطلاب…</p>}

        <div hidden={tab !== 'students'}>
          {students && <StudentManager students={students} refresh={refreshRoster} />}
        </div>

        <div hidden={tab !== 'reports'}>
          <section className="computer-card" aria-labelledby="reports-title">
            <h2 id="reports-title">التقارير الأسبوعية</h2>
            <form className="computer-week" onSubmit={showProgress}>
              <label>
                الأسبوع المنتهي في
                <input type="date" dir="ltr" required value={date} disabled={exporting}
                  onChange={event => setDate(event.target.value)} />
              </label>
              <button className="computer-primary" type="submit" disabled={!date || exporting}>
                عرض الإنجاز
              </button>
            </form>

            {ratingsError && <p className="computer-error" role="alert">{ratingsError}</p>}
            {query && ratings === null && !ratingsError && (
              <p role="status">جارٍ تحميل التقييمات…</p>
            )}

            {students && ratings !== null && (
              <>
                <dl className="computer-metrics">
                  <div><dt>الأسبوع</dt><dd dir="ltr">{query.week}</dd></div>
                  <div><dt>الطلاب</dt><dd>{studentCount}</dd></div>
                  <div><dt>التقييمات المحفوظة</dt><dd>{done} من {required}</dd></div>
                  <div><dt>الإنجاز</dt><dd>{percent(done, required)}</dd></div>
                </dl>

                <div className="computer-actions">
                  <button className="computer-primary" type="button"
                    disabled={exporting || !canExport} onClick={downloadPdf}>
                    {exporting ? 'جارٍ تجهيز PDF…' : 'تنزيل كتاب التقييمات PDF'}
                  </button>
                  <span role="status">{exportMessage}</span>
                </div>

                {[...groups.entries()].map(([key, group]) => (
                  <details key={key} className="computer-group">
                    <summary>{group.grade} · الشعبة {group.section} · {group.count} طالب</summary>
                    <div className="computer-table">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">المادة</th>
                            <th scope="col">التقييمات المحفوظة</th>
                            <th scope="col">الإنجاز</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjects.map(subject => {
                            const count = group.ratings.get(subject) ?? 0;

                            return (
                              <tr key={subject}>
                                <th scope="row">{subject}</th>
                                <td>{count} من {group.count}</td>
                                <td>{percent(count, group.count)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </>
            )}
          </section>
        </div>
      </div>

      <style jsx global>{`
        .hanan-computer {
          --computer-ink: #172820;
          --computer-muted: #506457;
          --computer-green: #205e46;
          --computer-border: #dce7df;
          width: 100%;
          min-height: 100vh;
          background: #f3f7f4;
          color: var(--computer-ink);
          font: 16px/1.65 'IBM Plex Sans Arabic', Tahoma, sans-serif;
        }

        .hanan-computer * { box-sizing: border-box; }
        .hanan-computer [hidden] { display: none !important; }

        .hanan-computer .computer-shell {
          width: min(100%, 1240px);
          margin-inline: auto;
          padding: 18px clamp(14px, 4vw, 44px) 48px;
        }

        .hanan-computer .computer-toolbar,
        .hanan-computer .computer-actions,
        .hanan-computer .computer-brand {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }

        .hanan-computer .computer-toolbar { justify-content: space-between; }

        .hanan-computer .computer-header {
          padding-bottom: 14px;
          border-bottom: 1px solid var(--computer-border);
        }

        .hanan-computer .computer-brand img { object-fit: contain; }
        .hanan-computer .computer-back { color: var(--computer-green); text-decoration: none; }

        .hanan-computer h1 {
          margin: 24px 0 14px;
          font-size: clamp(29px, 4vw, 43px);
          line-height: 1.3;
        }

        .hanan-computer h2, .hanan-computer h3 { margin: 0; }
        .hanan-computer .computer-nav { margin-bottom: 16px; }
        .hanan-computer .computer-muted { margin: 4px 0 0; color: var(--computer-muted); }

        .hanan-computer .computer-card {
          padding: clamp(14px, 3vw, 23px);
          border: 1px solid var(--computer-border);
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 6px 22px #17282008;
        }

        .hanan-computer .computer-primary,
        .hanan-computer .computer-quiet {
          min-height: 42px;
          padding: 7px 14px;
          border: 1px solid var(--computer-border);
          border-radius: 9px;
          cursor: pointer;
          font: inherit;
          font-weight: 600;
        }

        .hanan-computer .computer-quiet {
          background: #fff;
          color: var(--computer-green);
        }

        .hanan-computer .computer-primary,
        .hanan-computer .computer-nav button[aria-pressed='true'] {
          border-color: var(--computer-green);
          background: var(--computer-green);
          color: #fff;
        }

        .hanan-computer button:disabled { opacity: .55; cursor: default; }

        .hanan-computer .computer-fields {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 175px), 1fr));
          gap: 12px;
          margin-block: 16px;
        }

        .hanan-computer label {
          display: grid;
          gap: 5px;
          min-width: 0;
          font-weight: 600;
        }

        .hanan-computer input,
        .hanan-computer select {
          width: 100%;
          min-width: 0;
          min-height: 42px;
          padding: 7px 10px;
          border: 1px solid #cad9cf;
          border-radius: 8px;
          background: #fff;
          color: var(--computer-ink);
          font: inherit;
        }

        .hanan-computer .computer-editor {
          margin-top: 16px;
          padding: 16px;
          border: 1px solid #eadbc6;
          border-radius: 12px;
          background: #fffcf5;
        }

        .hanan-computer .computer-table { overflow: auto; }
        .hanan-computer .computer-roster { max-height: 56vh; }

        .hanan-computer table {
          width: 100%;
          min-width: 360px;
          border-collapse: collapse;
        }

        .hanan-computer .computer-roster table { min-width: 520px; }

        .hanan-computer th,
        .hanan-computer td {
          padding: 10px 12px;
          border-bottom: 1px solid #e6eee8;
          text-align: start;
        }

        .hanan-computer thead { background: #eef5f0; }
        .hanan-computer .computer-roster thead { position: sticky; top: 0; }
        .hanan-computer tbody th { font-weight: 600; }
        .hanan-computer tbody tr:nth-child(even) { background: #fafcfb; }

        .hanan-computer .computer-week {
          display: flex;
          flex-wrap: wrap;
          align-items: end;
          gap: 12px;
          margin-block: 14px;
        }

        .hanan-computer .computer-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
          gap: 10px;
          margin-block: 16px;
        }

        .hanan-computer .computer-metrics div {
          padding: 10px 13px;
          border: 1px solid var(--computer-border);
          border-radius: 10px;
          background: #f4f8f5;
        }

        .hanan-computer .computer-metrics dt {
          color: var(--computer-muted);
          font-size: 14px;
        }

        .hanan-computer .computer-metrics dd {
          margin: 4px 0 0;
          text-align: start;
          font-weight: 700;
        }

        .hanan-computer .computer-metrics dd[dir='ltr'] { text-align: right; }

        .hanan-computer .computer-group {
          margin-top: 12px;
          border: 1px solid var(--computer-border);
          border-radius: 10px;
        }

        .hanan-computer .computer-group summary {
          padding: 10px 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .hanan-computer .computer-error { color: #914717; }
        .hanan-computer .computer-status { color: var(--computer-green); }

        .hanan-computer :is(a, button, input, select, summary):focus-visible {
          outline: 3px solid #a7652c;
          outline-offset: 3px;
        }
      `}</style>
    </section>
  );
}