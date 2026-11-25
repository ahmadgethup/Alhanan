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

const emptyNotes = {
  positive: '',
  negative: '',
  notes: '',
};

const number = new Intl.NumberFormat('ar-IQ');

function classKey(grade, section) {
  return JSON.stringify([grade, section]);
}

function scoreKey(id, subject) {
  return JSON.stringify([String(id), subject]);
}

function today() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Baghdad',
  }).format(new Date());
}

function monthLabel(month) {
  return new Intl.DateTimeFormat('ar-IQ', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function percent(done, total) {
  return new Intl.NumberFormat('ar-IQ', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(total ? done / total : 0);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data === null) {
    throw new Error(
      data?.error ||
      'تعذّر إكمال الطلب. تحقق من الاتصال وتسجيل الدخول لقسم الحاسبات.'
    );
  }

  return data;
}

async function readList(url, signal) {
  const rows = await request(url, { signal });

  if (!Array.isArray(rows)) {
    throw new Error('البيانات المستلمة غير صالحة.');
  }

  return rows;
}

function useUnsavedWarning(dirty) {
  useEffect(() => {
    if (!dirty) return;

    function warn(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

function mergeRows(previous, incoming, getKey) {
  const rows = new Map(previous.map(row => [getKey(row), row]));

  for (const row of incoming) {
    rows.set(getKey(row), row);
  }

  return [...rows.values()];
}

async function exportBook(students, options) {
  const monthly = options.kind === 'monthly';

  /*
   * الاسم الذي يظهر على البطاقة يدخله المستخدم.
   * الشهر المستخدم لجلب الدرجات من قاعدة البيانات يبقى كما هو.
   */
  let printedMonth = '';

  if (monthly) {
    const entered = window.prompt(
      'اكتب اسم الشهر أو الامتحان كما تريد ظهوره على البطاقات:',
      'الشهر الأول'
    );

    if (entered === null) {
      throw new Error('تم إلغاء تنزيل البطاقات.');
    }

    printedMonth = entered.trim();

    if (!printedMonth) {
      throw new Error('اكتب اسم الشهر، مثل: الشهر الأول.');
    }

    if (printedMonth.length > 60) {
      throw new Error('اسم الشهر طويل. استخدم اسماً لا يتجاوز ٦٠ حرفاً.');
    }
  }

  if (!students.length) {
    throw new Error('لا يوجد طلاب لتنزيل بطاقاتهم.');
  }

  const { jsPDF } = await import('jspdf');

  await document.fonts.load('400 24px "IBM Plex Sans Arabic"');
  await document.fonts.load('700 24px "IBM Plex Sans Arabic"');
  await document.fonts.ready;

  const logo = new Image();

  // الشعار الجديد المخصص للكروت.
  logo.src = '/hanan-logo-new.png';

  try {
    await logo.decode();
  } catch {
    throw new Error(
      'تعذّر تحميل الشعار الجديد. ضع الصورة داخل public باسم hanan-logo-new.png.'
    );
  }

  const grades = new Map(
    (options.grades || []).map(row => [
      scoreKey(row.student_id, row.subject),
      row.score,
    ])
  );

  const notes = new Map(
    (options.notes || []).map(row => [
      String(row.student_id),
      row,
    ])
  );

  const advisors = new Map(
    (options.advisors || []).map(row => [
      classKey(row.grade, row.section),
      row.advisor_name,
    ])
  );

  const ratings = new Map(
    (options.ratings || []).map(row => [
      scoreKey(row.student_id, row.subject),
      row.rating,
    ])
  );

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const canvas = document.createElement('canvas');

  canvas.width = 1600;
  canvas.height = 2263;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('تعذّر تجهيز صفحات PDF.');
  }

  const blue = '#34799b';
  const green = '#27664c';
  const accent = monthly ? blue : green;
  const pale = monthly ? '#e5f2f8' : '#e9f3ec';
  const font = '"IBM Plex Sans Arabic", Tahoma, Arial, sans-serif';

  function text(
    value,
    x,
    y,
    size = 26,
    bold = false,
    align = 'right',
    max = 1300
  ) {
    ctx.direction = 'rtl';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1c303d';
    ctx.font = `${bold ? '700' : '400'} ${size}px ${font}`;

    ctx.fillText(String(value), x, y, max);
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function wrap(value, width, size) {
    ctx.font = `400 ${size}px ${font}`;

    const result = [];

    for (const paragraph of String(value).split('\n')) {
      let current = '';

      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = current ? `${current} ${word}` : word;

        if (current && ctx.measureText(next).width > width) {
          result.push(current);
          current = word;
        } else {
          current = next;
        }
      }

      result.push(current);
    }

    return result;
  }

  function paragraph(
    value,
    x,
    y,
    width,
    height,
    initialSize = 23
  ) {
    const content = String(value ?? '').trim();

    if (!content) return;

    let size = initialSize;
    let lines = wrap(content, width, size);

    while (
      size > 10 &&
      lines.length * size * 1.55 > height
    ) {
      size -= 1;
      lines = wrap(content, width, size);
    }

    const lineHeight = Math.min(
      size * 1.55,
      height / Math.max(1, lines.length)
    );

    lines.forEach((value, index) => {
      text(
        value,
        x,
        y + lineHeight * (index + 0.5),
        size,
        false,
        'right',
        width
      );
    });
  }

  function headingBox(x, y, width, height, label) {
    ctx.fillStyle = pale;

    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);

    text(
      label,
      x + width / 2,
      y + height / 2,
      27,
      true,
      'center'
    );
  }

  function drawCard(student, top) {
    const left = 80;
    const right = 1520;
    const height = 1000;

    ctx.fillStyle = '#fff';
    ctx.fillRect(left, top, right - left, height);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;

    // زخارف خفيفة في زوايا البطاقة.
    ctx.fillStyle = monthly ? '#edf6fb' : '#f0f7f2';

    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left + 140, top);
    ctx.lineTo(left, top + 100);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(right, top + height);
    ctx.lineTo(right - 140, top + height);
    ctx.lineTo(right, top + height - 100);
    ctx.closePath();
    ctx.fill();

    ctx.strokeRect(left, top, right - left, height);

    // وضع الشعار ضمن مساحة ثابتة للحفاظ على تناسبه.
    const logoBox = {
      x: right - 165,
      y: top + 30,
      width: 135,
      height: 135,
    };

    const logoScale = Math.min(
      logoBox.width / logo.naturalWidth,
      logoBox.height / logo.naturalHeight
    );

    const logoWidth = logo.naturalWidth * logoScale;
    const logoHeight = logo.naturalHeight * logoScale;

    ctx.drawImage(
      logo,
      logoBox.x + (logoBox.width - logoWidth) / 2,
      logoBox.y + (logoBox.height - logoHeight) / 2,
      logoWidth,
      logoHeight
    );

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
      monthly
        ? 'بطاقة الدرجات الشهرية'
        : 'تقرير متابعة الطالب الأسبوعي',
      800,
      top + 122,
      32,
      false,
      'center'
    );

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

    // لا يُستخدم اسم الشهر الميلادي في البطاقة الشهرية.
    text(
      monthly
        ? printedMonth
        : `الأسبوع: ${options.week}`,
      390,
      top + 208,
      24,
      false,
      'right',
      285
    );

    const tableX = 110;
    const tableRight = monthly ? 925 : 1490;
    const divider = monthly ? 360 : 720;
    const tableTop = top + 260;
    const rowHeight = 57;

    ctx.fillStyle = pale;

    ctx.fillRect(
      tableX,
      tableTop,
      tableRight - tableX,
      rowHeight
    );

    text(
      'المادة',
      (divider + tableRight) / 2,
      tableTop + 28,
      28,
      true,
      'center'
    );

    text(
      monthly ? 'الدرجة' : 'التقييم',
      (tableX + divider) / 2,
      tableTop + 28,
      28,
      true,
      'center'
    );

    subjects.forEach((subject, index) => {
      const y = tableTop + (index + 1) * rowHeight;

      if (index % 2) {
        ctx.fillStyle = '#f8fbfd';

        ctx.fillRect(
          tableX,
          y,
          tableRight - tableX,
          rowHeight
        );
      }

      text(
        subject,
        tableRight - 22,
        y + 28,
        27,
        false,
        'right',
        tableRight - divider - 42
      );

      const value = monthly
        ? grades.get(scoreKey(student.id, subject))
        : ratings.get(scoreKey(student.id, subject));

      const missing =
        value === null ||
        value === undefined ||
        value === '';

      text(
        missing
          ? monthly
            ? 'لم تُدخل الدرجة'
            : 'غير مقيّم حتى الآن'
          : String(value),
        (tableX + divider) / 2,
        y + 28,
        missing ? 20 : monthly ? 31 : 27,
        !missing,
        'center',
        divider - tableX - 26
      );
    });

    ctx.strokeStyle = accent;

    ctx.strokeRect(
      tableX,
      tableTop,
      tableRight - tableX,
      rowHeight * 10
    );

    line(
      divider,
      tableTop,
      divider,
      tableTop + rowHeight * 10
    );

    for (let row = 1; row < 10; row += 1) {
      line(
        tableX,
        tableTop + row * rowHeight,
        tableRight,
        tableTop + row * rowHeight
      );
    }

    if (monthly) {
      const observation =
        notes.get(String(student.id)) || {
          positive: '',
          negative: '',
          notes: '',
        };

      const sideX = 965;
      const sideWidth = 525;
      const middle = sideX + sideWidth / 2;

      // السلوك.
      headingBox(
        sideX,
        tableTop,
        sideWidth,
        57,
        'السلوك'
      );

      ctx.strokeRect(
        sideX,
        tableTop + 57,
        sideWidth,
        180
      );

      line(
        middle,
        tableTop + 57,
        middle,
        tableTop + 237
      );

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

      // الملاحظات: مربع فارغ بدون أي خطوط داخلية.
      const notesTop = tableTop + 260;

      headingBox(
        sideX,
        notesTop,
        sideWidth,
        57,
        'ملاحظات'
      );

      ctx.strokeRect(
        sideX,
        notesTop + 57,
        sideWidth,
        253
      );

      // تظهر الملاحظات المحفوظة فقط إن كانت موجودة.
      paragraph(
        observation.notes,
        sideX + sideWidth - 20,
        notesTop + 70,
        sideWidth - 40,
        225,
        24
      );

      const advisor = advisors.get(
        classKey(student.grade, student.section)
      );

      // اسم المرشد، بدون خط توقيع.
      text(
        `المرشد: ${advisor || 'لم يُحدد'}`,
        1490,
        top + 910,
        26,
        true,
        'right',
        515
      );

      text(
        'ولي الأمر',
        1490,
        top + 965,
        26,
        true
      );

      line(
        1010,
        top + 965,
        1355,
        top + 965
      );

      text(
        'مدير المدرسة',
        895,
        top + 910,
        26,
        true
      );

      line(
        140,
        top + 910,
        700,
        top + 910
      );
    } else {
      text(
        'الملاحظات:',
        1490,
        top + 872,
        26
      );

      text(
        'مدير المدرسة',
        1490,
        top + 950,
        26,
        true
      );

      line(
        920,
        top + 950,
        1300,
        top + 950
      );

      text(
        'ولي الأمر',
        700,
        top + 950,
        26,
        true
      );

      line(
        140,
        top + 950,
        550,
        top + 950
      );
    }
  }

  for (let index = 0; index < students.length; index += 2) {
    if (index) pdf.addPage();

    ctx.fillStyle = '#fff';
    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    drawCard(students[index], 75);

    if (students[index + 1]) {
      ctx.strokeStyle = '#b8cbd5';
      ctx.setLineDash([10, 12]);

      line(
        80,
        1127,
        1520,
        1127
      );

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

    await new Promise(resolve => setTimeout(resolve, 0));
  }

  const safeMonthName = printedMonth
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim();

  pdf.save(
    monthly
      ? `بطاقات-${safeMonthName}-${options.month}.pdf`
      : `hanan-weekly-reports-${options.week}.pdf`
  );
}

/* إدارة الطلاب */
function StudentManager({ students, refresh }) {
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useUnsavedWarning(Boolean(draft));

  const grades = [...new Set(students.map(row => row.grade))];

  const sections = [...new Set(
    students
      .filter(row => !grade || row.grade === grade)
      .map(row => row.section)
  )];

  const visible = students.filter(row =>
    (!grade || row.grade === grade) &&
    (!section || row.section === section) &&
    row.full_name.includes(search.trim())
  );

  function edit(student) {
    setMessage('');

    setDraft(student ? {
      id: Number(student.id),
      full_name: student.full_name,
      grade: student.grade,
      section: student.section,
      enrollment_status: student.enrollment_status || '',
    } : {
      id: null,
      full_name: '',
      grade,
      section,
      enrollment_status: '',
    });
  }

  async function save(event) {
    event.preventDefault();
    if (saving || !draft) return;

    setSaving(true);
    setMessage('');

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
        setMessage('تم الحفظ. أعد تحميل القائمة لعرض آخر البيانات.');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="cp-card">
      <div className="cp-toolbar">
        <div>
          <h2>إدارة الطلاب</h2>
          <p className="cp-muted">{visible.length} من {students.length} طالب</p>
        </div>
        <button disabled={saving || !!draft} onClick={() => edit()}>
          ＋ إضافة طالب
        </button>
      </div>

      {draft && (
        <form className="cp-editor" onSubmit={save}>
          <h3>{draft.id === null ? 'إضافة طالب' : 'تعديل معلومات الطالب'}</h3>

          <div className="cp-filters">
            {[
              ['full_name', 'اسم الطالب', 160],
              ['grade', 'الصف', 80],
              ['section', 'الشعبة', 20],
              ['enrollment_status', 'الحالة (اختياري)', 60],
            ].map(([field, label, limit]) => (
              <label key={field}>
                {label}
                <input
                  value={draft[field]}
                  required={field !== 'enrollment_status'}
                  maxLength={limit}
                  disabled={saving}
                  onChange={event => {
                    const value = event.target.value;
                    setDraft(previous => ({ ...previous, [field]: value }));
                  }}
                />
              </label>
            ))}
          </div>

          <div className="cp-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ الطالب'}
            </button>
            <button
              type="button"
              className="cp-quiet"
              disabled={saving}
              onClick={() => setDraft(null)}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div className="cp-filters">
        <label>
          البحث بالاسم
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
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

      {message && <p className="cp-message" role="status">{message}</p>}

      <div className="cp-table">
        <table>
          <thead>
            <tr>
              <th>اسم الطالب</th>
              <th>الصف</th>
              <th>الشعبة</th>
              <th>الحالة</th>
              <th>الإجراء</th>
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
                  <button
                    className="cp-quiet"
                    disabled={saving || !!draft}
                    onClick={() => edit(student)}
                  >
                    تعديل
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!visible.length && <p className="cp-muted">لا يوجد طلاب مطابقون.</p>}
    </section>
  );
}

/* قائمة مرشدي الصفوف */
function AdvisorManager({ students, advisors, onSaved }) {
  const [changes, setChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const changedCount = Object.keys(changes).length;
  useUnsavedWarning(changedCount > 0 || saving);

  const saved = new Map(advisors.map(row => [
    classKey(row.grade, row.section),
    row.advisor_name,
  ]));

  const classes = new Map();

  for (const student of students) {
    const key = classKey(student.grade, student.section);

    if (!classes.has(key)) {
      classes.set(key, {
        grade: student.grade,
        section: student.section,
        count: 0,
      });
    }

    classes.get(key).count += 1;
  }

  function change(key, value) {
    setMessage('');

    setChanges(previous => {
      const next = { ...previous };

      if (value === (saved.get(key) || '')) delete next[key];
      else next[key] = value;

      return next;
    });
  }

  async function save(event) {
    event.preventDefault();
    if (!changedCount || saving) return;

    setSaving(true);
    setMessage('');

    try {
      const entries = Object.entries(changes).map(([key, name]) => {
        const [grade, section] = JSON.parse(key);

        return { grade, section, advisor_name: name };
      });

      const result = await request('/api/students/advisors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });

      onSaved(result.rows);
      setChanges({});
      setMessage(`تم حفظ أسماء المرشدين لـ ${result.saved} صف وشعبة.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="cp-card">
      <div className="cp-toolbar">
        <div>
          <span className="cp-badge">إعدادات البطاقات</span>
          <h2>مرشدو الصفوف</h2>
          <p className="cp-muted">
            الاسم المحفوظ يظهر في بطاقة كل طالب حسب صفه وشعبته.
          </p>
        </div>
      </div>

      <form onSubmit={save}>
        <div className="cp-table cp-advisors-table">
          <table>
            <thead>
              <tr>
                <th>الصف</th>
                <th>الشعبة</th>
                <th>الطلاب</th>
                <th>اسم المرشد</th>
              </tr>
            </thead>
            <tbody>
              {[...classes.entries()].map(([key, group]) => (
                <tr key={key} className={Object.hasOwn(changes, key) ? 'cp-pending' : ''}>
                  <th scope="row">{group.grade}</th>
                  <td>{group.section}</td>
                  <td>{number.format(group.count)}</td>
                  <td>
                    <input
                      value={changes[key] ?? saved.get(key) ?? ''}
                      maxLength={160}
                      disabled={saving}
                      placeholder="اكتب اسم المرشد"
                      aria-label={`مرشد ${group.grade} الشعبة ${group.section}`}
                      onChange={event => change(key, event.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cp-save">
          <p role="status">
            {message || (
              changedCount
                ? `${changedCount} تغييرات غير محفوظة`
                : 'يمكن تعديل الأسماء في أي وقت.'
            )}
          </p>
          <button type="submit" disabled={saving || !changedCount}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ أسماء المرشدين'}
          </button>
        </div>
      </form>
    </section>
  );
}

/* التقييمات الأسبوعية */
function WeeklyReports({ students }) {
  const [date, setDate] = useState('');
  const [query, setQuery] = useState(null);
  const [ratings, setRatings] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const week = today();
    setDate(week);
    setQuery({ week });
  }, []);

  useEffect(() => {
    if (!query) return;

    const controller = new AbortController();

    readList(
      `/api/ratings?${new URLSearchParams({ week: query.week })}`,
      controller.signal
    ).then(rows => {
      if (!controller.signal.aborted) setRatings(rows);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause.message);
    });

    return () => controller.abort();
  }, [query]);

  const byStudent = new Map();

  for (const row of ratings || []) {
    if (!row.rating || !subjects.includes(row.subject)) continue;

    const id = String(row.student_id);

    if (!byStudent.has(id)) byStudent.set(id, new Set());
    byStudent.get(id).add(row.subject);
  }

  const groups = new Map();
  let done = 0;

  for (const student of students) {
    const key = classKey(student.grade, student.section);

    if (!groups.has(key)) {
      groups.set(key, {
        grade: student.grade,
        section: student.section,
        count: 0,
        counts: new Map(),
      });
    }

    const group = groups.get(key);
    group.count += 1;

    for (const subject of byStudent.get(String(student.id)) || []) {
      group.counts.set(subject, (group.counts.get(subject) || 0) + 1);
      done += 1;
    }
  }

  async function download() {
    if (!students.length || ratings === null || exporting) return;

    setExporting(true);
    setMessage('');

    try {
      const fresh = await readList(
        `/api/ratings?${new URLSearchParams({ week: query.week })}`
      );

      setRatings(fresh);

      await exportBook(students, {
        kind: 'weekly',
        week: query.week,
        ratings: fresh,
      });

      setMessage(`تم تجهيز ${Math.ceil(students.length / 2)} صفحة.`);
    } catch (cause) {
      setMessage(cause.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="cp-card">
      <h2>الإنجاز والتقارير الأسبوعية</h2>

      <form className="cp-inline" onSubmit={event => {
        event.preventDefault();
        if (!date || exporting) return;
        setRatings(null);
        setError('');
        setMessage('');
        setQuery({ week: date });
      }}>
        <label>
          الأسبوع المنتهي في
          <input
            type="date"
            dir="ltr"
            required
            disabled={exporting}
            value={date}
            onChange={event => setDate(event.target.value)}
          />
        </label>
        <button disabled={!date || exporting}>عرض الإنجاز</button>
      </form>

      {error && <p className="cp-error" role="alert">{error}</p>}
      {query && ratings === null && !error && <p role="status">جارٍ التحميل…</p>}

      {ratings !== null && (
        <>
          <div className="cp-metrics">
            <div><span>الطلاب</span><strong>{students.length}</strong></div>
            <div><span>التقييمات</span><strong>{done} / {students.length * subjects.length}</strong></div>
            <div><span>الإنجاز</span><strong>{percent(done, students.length * subjects.length)}</strong></div>
          </div>

          <div className="cp-actions">
            <button disabled={exporting || !students.length} onClick={download}>
              {exporting ? 'جارٍ تجهيز PDF…' : 'تنزيل كتاب التقييمات PDF'}
            </button>
            <span role="status">{message}</span>
          </div>

          {[...groups.entries()].map(([key, group]) => (
            <details className="cp-group" key={key}>
              <summary>
                {group.grade} · الشعبة {group.section} · {group.count} طالب
              </summary>
              <div className="cp-table">
                <table>
                  <thead>
                    <tr><th>المادة</th><th>المحفوظ</th><th>الإنجاز</th></tr>
                  </thead>
                  <tbody>
                    {subjects.map(subject => {
                      const count = group.counts.get(subject) || 0;

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
  );
}

/* الدرجات الشهرية والسلوك وتنزيل البطاقات */
function MonthlyCards({ students, advisors, onAdvisorsLoaded }) {
  const [month, setMonth] = useState('');
  const [query, setQuery] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [search, setSearch] = useState('');
  const [changes, setChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');

  const dirty = Object.keys(changes).length;
  const busy = saving || exporting;

  useUnsavedWarning(dirty > 0 || saving);

  useEffect(() => {
    const value = today().slice(0, 7);
    setMonth(value);
    setQuery({ month: value });
  }, []);

  useEffect(() => {
    if (!query) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ month: query.month });

    Promise.all([
      readList(`/api/grades?${params}`, controller.signal),
      readList(`/api/students/monthly?${params}`, controller.signal),
    ]).then(([grades, notes]) => {
      if (!controller.signal.aborted) {
        setData({ month: query.month, grades, notes });
      }
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause.message);
    });

    return () => controller.abort();
  }, [query]);

  const grades = [...new Set(students.map(row => row.grade))];

  const sections = [...new Set(
    students
      .filter(row => !grade || row.grade === grade)
      .map(row => row.section)
  )];

  const visible = students.filter(row =>
    (!grade || row.grade === grade) &&
    (!section || row.section === section) &&
    row.full_name.includes(search.trim())
  );

  const scores = new Map((data?.grades || []).map(row => [
    scoreKey(row.student_id, row.subject),
    row.score,
  ]));

  const notes = new Map((data?.notes || []).map(row => [
    String(row.student_id),
    row,
  ]));

  const advisorMap = new Map((advisors || []).map(row => [
    classKey(row.grade, row.section),
    row.advisor_name,
  ]));

  let completed = 0;

  for (const student of visible) {
    for (const subject of subjects) {
      const value = scores.get(scoreKey(student.id, subject));
      if (value !== null && value !== undefined) completed += 1;
    }
  }

  function edit(id, field, value) {
    setMessage('');

    setChanges(previous => {
      const saved = notes.get(String(id)) || emptyNotes;

      const draft = {
        positive: saved.positive || '',
        negative: saved.negative || '',
        notes: saved.notes || '',
        ...previous[id],
        [field]: value,
      };

      const next = { ...previous };

      if (
        ['positive', 'negative', 'notes'].every(
          name => draft[name] === (saved[name] || '')
        )
      ) {
        delete next[id];
      } else {
        next[id] = draft;
      }

      return next;
    });
  }

  function loadMonth(event) {
    event.preventDefault();

    if (!month || busy) return;

    if (dirty && !window.confirm('عندك سلوك أو ملاحظات غير محفوظة. تريد تغيير الشهر؟')) {
      return;
    }

    setChanges({});
    setData(null);
    setError('');
    setMessage('');
    setQuery({ month });
  }

  async function save() {
    if (!data || !dirty || busy) return;

    setSaving(true);
    setMessage('');

    try {
      const entries = Object.entries(changes).map(([id, values]) => ({
        id: Number(id),
        ...values,
      }));

      const result = await request('/api/students/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: data.month, entries }),
      });

      setData(previous => ({
        ...previous,
        notes: mergeRows(
          previous.notes,
          result.rows,
          row => String(row.student_id)
        ),
      }));

      setChanges({});
      setMessage('تم حفظ السلوك والملاحظات.');
    } catch (cause) {
      setMessage(cause.message);
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    if (!data || !visible.length || busy || dirty) return;

    setExporting(true);
    setMessage('جارٍ تحميل آخر البيانات وتجهيز البطاقات…');

    try {
      const params = new URLSearchParams({ month: data.month });

      // قراءة أسماء المرشدين من قاعدة البيانات وقت تنزيل الملف.
      const [freshGrades, freshNotes, freshAdvisors] = await Promise.all([
        readList(`/api/grades?${params}`),
        readList(`/api/students/monthly?${params}`),
        readList('/api/students/advisors'),
      ]);

      onAdvisorsLoaded(freshAdvisors);

      setData(previous => ({
        ...previous,
        grades: freshGrades,
        notes: freshNotes,
      }));

      await exportBook(visible, {
        kind: 'monthly',
        month: data.month,
        grades: freshGrades,
        notes: freshNotes,
        advisors: freshAdvisors,
      });

      setMessage(
        `تم تجهيز ${visible.length} بطاقة في ${Math.ceil(visible.length / 2)} صفحة.`
      );
    } catch (cause) {
      setMessage(cause.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="cp-card cp-monthly">
      <div className="cp-toolbar">
        <div>
          <span className="cp-badge">بطاقات الطلاب</span>
          <h2>الدرجات والبطاقات الشهرية</h2>
          <p className="cp-muted">
            يظهر اسم المرشد تلقائياً حسب صف الطالب وشعبته.
          </p>
        </div>
      </div>

      <form className="cp-inline" onSubmit={loadMonth}>
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
            onChange={event => setMonth(event.target.value)}
          />
        </label>
        <button disabled={busy || !month}>عرض الدرجات</button>
      </form>

      {error && <p className="cp-error" role="alert">{error}</p>}
      {query && !data && !error && <p role="status">جارٍ تحميل الدرجات…</p>}

      {data && (
        <>
          <div className="cp-filters">
            <label>
              البحث بالاسم
              <input
                type="search"
                disabled={busy}
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </label>
            <label>
              الصف
              <select disabled={busy} value={grade} onChange={event => {
                setGrade(event.target.value);
                setSection('');
              }}>
                <option value="">كل الصفوف</option>
                {grades.map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              الشعبة
              <select
                disabled={busy}
                value={section}
                onChange={event => setSection(event.target.value)}
              >
                <option value="">كل الشعب</option>
                {sections.map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>

          <div className="cp-metrics">
            <div><span>الشهر المعروض</span><strong>{monthLabel(data.month)}</strong></div>
            <div><span>الطلاب الظاهرون</span><strong>{visible.length}</strong></div>
            <div><span>الدرجات المحفوظة</span><strong>{completed} / {visible.length * subjects.length}</strong></div>
          </div>

          <div className="cp-actions">
            <button disabled={busy || !!dirty || !visible.length} onClick={download}>
              {exporting ? 'جارٍ تجهيز البطاقات…' : 'تنزيل بطاقات الدرجات PDF'}
            </button>
            <span className="cp-muted">
              التنزيل يشمل الطلاب الظاهرين، حتى إذا درجاتهم غير مكتملة.
            </span>
          </div>

          <div className="cp-table cp-monthly-table">
            <table>
              <thead>
                <tr>
                  <th>اسم الطالب</th>
                  <th>المرشد</th>
                  {subjects.map(subject => <th key={subject}>{subject}</th>)}
                  <th>السلوك الموجب</th>
                  <th>السلوك السالب</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(student => {
                  const id = String(student.id);
                  const observation = changes[id] || notes.get(id) || emptyNotes;

                  return (
                    <tr key={id} className={Object.hasOwn(changes, id) ? 'cp-pending' : ''}>
                      <th scope="row">
                        {student.full_name}
                        <small>{student.grade} · {student.section}</small>
                      </th>

                      <td className="cp-advisor-name">
                        {advisorMap.get(classKey(student.grade, student.section)) || 'لم يُحدد'}
                      </td>

                      {subjects.map(subject => (
                        <td className="cp-score" key={subject}>
                          {scores.get(scoreKey(id, subject)) ?? '—'}
                        </td>
                      ))}

                      {['positive', 'negative', 'notes'].map(field => (
                        <td key={field}>
                          <textarea
                            rows={3}
                            maxLength={field === 'notes' ? 500 : 200}
                            disabled={busy}
                            value={observation[field] || ''}
                            aria-label={`${
                              field === 'positive'
                                ? 'السلوك الموجب'
                                : field === 'negative'
                                  ? 'السلوك السالب'
                                  : 'ملاحظات'
                            } للطالب ${student.full_name}`}
                            onChange={event => edit(id, field, event.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!visible.length && <p className="cp-muted">لا يوجد طلاب مطابقون.</p>}

          <div className="cp-save">
            <p role="status">
              {message || (
                dirty
                  ? `${dirty} طالب لديهم تغييرات غير محفوظة`
                  : 'احفظ السلوك والملاحظات قبل تنزيل الكروت.'
              )}
            </p>
            <button disabled={busy || !dirty} onClick={save}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ السلوك والملاحظات'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default function ComputerPage() {
  const [tab, setTab] = useState('students');
  const [opened, setOpened] = useState({
    students: true,
    reports: false,
    monthly: false,
    advisors: false,
  });

  const [students, setStudents] = useState(null);
  const [rosterError, setRosterError] = useState('');
  const [rosterRetry, setRosterRetry] = useState(0);

  const [advisors, setAdvisors] = useState(null);
  const [advisorError, setAdvisorError] = useState('');
  const [advisorRetry, setAdvisorRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setRosterError('');

    readList('/api/roster', controller.signal)
      .then(rows => {
        if (!controller.signal.aborted) setStudents(rows);
      })
      .catch(error => {
        if (!controller.signal.aborted) setRosterError(error.message);
      });

    return () => controller.abort();
  }, [rosterRetry]);

  useEffect(() => {
    const controller = new AbortController();
    setAdvisorError('');

    readList('/api/students/advisors', controller.signal)
      .then(rows => {
        if (!controller.signal.aborted) setAdvisors(rows);
      })
      .catch(error => {
        if (!controller.signal.aborted) setAdvisorError(error.message);
      });

    return () => controller.abort();
  }, [advisorRetry]);

  async function refreshStudents() {
    const rows = await readList('/api/roster');
    setStudents(rows);
    setRosterError('');
  }

  function open(value) {
    setOpened(previous => ({ ...previous, [value]: true }));
    setTab(value);
  }

  function advisorsSaved(rows) {
    setAdvisors(previous => mergeRows(
      previous || [],
      rows,
      row => classKey(row.grade, row.section)
    ));
  }

  return (
    <section className="computer-page" dir="rtl" lang="ar">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        precedence="computer-font"
      />

      <div className="cp-shell">
        <header className="cp-header">
          <div className="cp-brand">
            <img src="/hanan-logo.png" alt="" width={54} height={46} />
            <strong>ثانوية حنان الأهلية للبنين</strong>
          </div>
          <Link href="/" className="cp-back">العودة إلى حنان ←</Link>
        </header>

        <div className="cp-intro">
          <span className="cp-badge">إدارة المنصة</span>
          <h1>قسم الحاسبات</h1>
          <p>إدارة الطلاب والتقييمات والبطاقات ومرشدي الصفوف.</p>
        </div>

        <nav className="cp-nav" aria-label="أقسام الحاسبات">
          {[
            ['students', 'إدارة الطلاب'],
            ['reports', 'الإنجاز والتقارير'],
            ['monthly', 'الدرجات والبطاقات'],
            ['advisors', 'مرشدو الصفوف'],
          ].map(([value, label]) => (
            <button
              key={value}
              className="cp-quiet"
              aria-pressed={tab === value}
              onClick={() => open(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        {rosterError && (
          <div className="cp-notice" role="alert">
            <span>{rosterError}</span>
            <button className="cp-quiet" onClick={() => setRosterRetry(value => value + 1)}>
              إعادة تحميل الطلاب
            </button>
          </div>
        )}

        {!students && !rosterError && <p role="status">جارٍ تحميل الطلاب…</p>}

        {students && (
          <>
            <div hidden={tab !== 'students'}>
              <StudentManager students={students} refresh={refreshStudents} />
            </div>

            <div hidden={tab !== 'reports'}>
              {opened.reports && <WeeklyReports students={students} />}
            </div>

            <div hidden={tab !== 'monthly'}>
              {opened.monthly && (
                <MonthlyCards
                  students={students}
                  advisors={advisors}
                  onAdvisorsLoaded={rows => {
                    setAdvisors(rows);
                    setAdvisorError('');
                  }}
                />
              )}
            </div>

            <div hidden={tab !== 'advisors'}>
              {advisorError && (
                <div className="cp-notice" role="alert">
                  <span>{advisorError}</span>
                  <button className="cp-quiet" onClick={() => setAdvisorRetry(value => value + 1)}>
                    إعادة تحميل المرشدين
                  </button>
                </div>
              )}

              {advisors === null && !advisorError && (
                <p role="status">جارٍ تحميل أسماء المرشدين…</p>
              )}

              {opened.advisors && advisors !== null && (
                <AdvisorManager
                  students={students}
                  advisors={advisors}
                  onSaved={advisorsSaved}
                />
              )}
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        .computer-page {
          --cp-ink: #192e27;
          --cp-green: #225f49;
          --cp-border: #dce6e1;
          width: 100%;
          max-width: none;
          min-height: 100vh;
          margin: 0;
          background: #f4f7f5;
          color: var(--cp-ink);
          font: 16px/1.7 'IBM Plex Sans Arabic', Tahoma, sans-serif;
        }

        .computer-page,
        .computer-page * {
          box-sizing: border-box;
        }

        .computer-page [hidden] {
          display: none !important;
        }

        .computer-page .cp-shell {
          width: min(100%, 1440px);
          margin-inline: auto;
          padding: 18px clamp(14px, 4vw, 40px) 40px;
        }

        .computer-page .cp-header,
        .computer-page .cp-brand,
        .computer-page .cp-toolbar,
        .computer-page .cp-actions,
        .computer-page .cp-save {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
        }

        .computer-page .cp-header,
        .computer-page .cp-toolbar,
        .computer-page .cp-save {
          justify-content: space-between;
        }

        .computer-page .cp-header {
          padding-bottom: 16px;
          border-bottom: 1px solid var(--cp-border);
        }

        .computer-page .cp-brand img {
          object-fit: contain;
          flex-shrink: 0;
        }

        .computer-page .cp-back {
          padding: 8px 12px;
          border: 1px solid var(--cp-border);
          border-radius: 9px;
          background: white;
          color: var(--cp-green);
          text-decoration: none;
          font-size: 14px;
        }

        .computer-page .cp-intro {
          margin-block: 22px;
          padding: 24px;
          border: 1px solid var(--cp-border);
          border-radius: 18px;
          background: linear-gradient(110deg, #fff, #eaf3ee);
        }

        .computer-page h1 {
          margin: 7px 0;
          font-size: clamp(30px, 4vw, 43px);
          line-height: 1.35;
        }

        .computer-page h2 {
          margin: 0;
          font-size: clamp(21px, 2.4vw, 28px);
        }

        .computer-page h3 {
          margin: 0;
          font-size: 19px;
        }

        .computer-page .cp-intro p,
        .computer-page .cp-muted {
          margin: 4px 0 0;
          color: #607369;
        }

        .computer-page .cp-badge {
          display: inline-flex;
          padding: 3px 10px;
          border: 1px solid #d3e2d9;
          border-radius: 999px;
          background: #fff;
          color: var(--cp-green);
          font-size: 12px;
          font-weight: 600;
        }

        .computer-page .cp-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .computer-page button {
          min-height: 42px;
          padding: 9px 15px;
          border: 1px solid var(--cp-green);
          border-radius: 10px;
          background: var(--cp-green);
          color: #fff;
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          font-weight: 600;
        }

        .computer-page button.cp-quiet {
          border-color: var(--cp-border);
          background: #fff;
          color: var(--cp-green);
        }

        .computer-page .cp-nav button[aria-pressed='true'] {
          border-color: var(--cp-green);
          background: var(--cp-green);
          color: #fff;
        }

        .computer-page button:disabled {
          opacity: .5;
          cursor: default;
        }

        .computer-page .cp-card {
          min-width: 0;
          padding: clamp(14px, 2.5vw, 24px);
          border: 1px solid var(--cp-border);
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 6px 24px #192e2707;
        }

        .computer-page label {
          display: grid;
          gap: 6px;
          min-width: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .computer-page input,
        .computer-page select,
        .computer-page textarea {
          width: 100%;
          min-width: 0;
          min-height: 43px;
          padding: 9px 11px;
          border: 1px solid #cad9d1;
          border-radius: 9px;
          background: #fff;
          color: var(--cp-ink);
          font: inherit;
          font-size: 15px;
        }

        .computer-page textarea {
          min-width: 190px;
          min-height: 95px;
          resize: vertical;
        }

        .computer-page .cp-filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 14px;
          margin-block: 18px;
        }

        .computer-page .cp-inline {
          display: flex;
          flex-wrap: wrap;
          align-items: end;
          gap: 12px;
          margin-block: 18px;
        }

        .computer-page .cp-editor {
          padding: 18px;
          margin-top: 18px;
          border: 1px solid #e9dbc4;
          border-radius: 12px;
          background: #fffcf7;
        }

        .computer-page .cp-table {
          max-height: 63vh;
          overflow: auto;
          margin-top: 16px;
          border: 1px solid var(--cp-border);
          border-radius: 12px;
        }

        .computer-page table {
          width: 100%;
          min-width: 560px;
          border-collapse: collapse;
        }

        .computer-page th,
        .computer-page td {
          padding: 11px 13px;
          border-bottom: 1px solid #e5ede8;
          text-align: start;
          vertical-align: middle;
        }

        .computer-page thead {
          position: sticky;
          top: 0;
          z-index: 1;
          background: #edf4ef;
          color: #355547;
        }

        .computer-page thead th {
          font-size: 13px;
        }

        .computer-page tbody th {
          font-weight: 500;
        }

        .computer-page tbody tr:nth-child(even) {
          background: #fafcfb;
        }

        .computer-page tbody tr.cp-pending {
          background: #fff7eb;
        }

        .computer-page .cp-table small {
          display: block;
          margin-top: 4px;
          color: #718178;
          font-size: 12px;
        }

        .computer-page .cp-advisors-table td:last-child {
          width: 43%;
          min-width: 240px;
        }

        .computer-page .cp-save {
          position: sticky;
          bottom: 0;
          z-index: 2;
          margin-top: 16px;
          padding: 14px 16px;
          border: 1px solid var(--cp-border);
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 -5px 20px #192e2708;
        }

        .computer-page .cp-save p {
          margin: 0;
          font-size: 14px;
        }

        .computer-page .cp-notice {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding: 14px;
          border: 1px solid #ebd6b8;
          border-radius: 12px;
          background: #fff8ed;
          color: #865224;
        }

        .computer-page .cp-error {
          color: #9a481d;
        }

        .computer-page .cp-message {
          padding: 10px 12px;
          border-radius: 8px;
          background: #f1f6f3;
          color: var(--cp-green);
        }

        .computer-page .cp-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 12px;
          margin-block: 18px;
        }

        .computer-page .cp-metrics div {
          display: grid;
          gap: 4px;
          padding: 14px 16px;
          border: 1px solid var(--cp-border);
          border-radius: 12px;
          background: #f6f9f7;
        }

        .computer-page .cp-metrics span {
          color: #687c70;
          font-size: 13px;
        }

        .computer-page .cp-metrics strong {
          font-size: 21px;
        }

        .computer-page .cp-group {
          margin-top: 14px;
          border: 1px solid var(--cp-border);
          border-radius: 10px;
        }

        .computer-page .cp-group summary {
          padding: 12px 14px;
          cursor: pointer;
          font-weight: 600;
        }

        .computer-page .cp-group .cp-table {
          margin: 0;
          border: 0;
        }

        .computer-page .cp-monthly {
          --cp-green: #286b94;
          --cp-border: #dce7ef;
        }

        .computer-page .cp-monthly thead {
          background: #ebf4fa;
          color: #315b74;
        }

        .computer-page .cp-monthly-table table {
          min-width: 2100px;
        }

        .computer-page .cp-monthly-table tbody th {
          min-width: 190px;
        }

        .computer-page .cp-advisor-name {
          min-width: 140px;
          color: #286b94;
          font-weight: 600;
        }

        .computer-page .cp-score {
          text-align: center;
          font-weight: 600;
        }

        .computer-page :is(a, button, input, select, textarea, summary):focus-visible {
          outline: 3px solid #76aa93;
          outline-offset: 3px;
        }

        @media (max-width: 650px) {
          .computer-page .cp-nav {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .computer-page .cp-nav button {
            padding-inline: 8px;
            font-size: 13px;
          }

          .computer-page .cp-filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .computer-page .cp-save button {
            width: 100%;
          }

          .computer-page .cp-intro {
            padding: 18px;
          }
        }
      `}</style>
    </section>
  );
}