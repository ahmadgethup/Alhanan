'use client';

import { useState } from 'react';

const fields = [
  ['full_name', 'اسم الطالب', 160],
  ['grade', 'الصف', 80],
  ['section', 'الشعبة', 20],
  ['enrollment_status', 'الحالة (اختياري)', 60],
];

export default function StudentManager({ students, refresh }) {
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

  function open(student) {
    setError('');
    setMessage('');
    setDraft(student ? {
      ...student,
      enrollment_status: student.enrollment_status ?? '',
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
    if (saving) return;

    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error ?? `تعذّر الحفظ (${response.status}).`);
      }

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
    <section className="student-manager" aria-labelledby="student-list-title">
      <header className="manager-toolbar">
        <div>
          <h2 id="student-list-title">إدارة الطلاب</h2>
          <span>{visible.length} من {students.length} طالب</span>
        </div>
        <button type="button" disabled={saving || Boolean(draft)} onClick={() => open()}>
          ＋ إضافة طالب
        </button>
      </header>

      {message && <p role="status">{message}</p>}

      {draft && (
        <form className="manager-editor" onSubmit={save}>
          <h3>{draft.id === null ? 'إضافة طالب' : 'تعديل معلومات الطالب'}</h3>

          <div className="manager-fields">
            {fields.map(([key, label, maxLength]) => (
              <label key={key}>
                {label}
                <input
                  value={draft[key]}
                  maxLength={maxLength}
                  required={key !== 'enrollment_status'}
                  disabled={saving}
                  list={key === 'grade' ? 'manager-grades' : undefined}
                  onChange={event => {
                    const value = event.target.value;
                    setDraft(previous => ({ ...previous, [key]: value }));
                  }}
                />
              </label>
            ))}
          </div>

          <datalist id="manager-grades">
            {grades.map(value => <option key={value} value={value} />)}
          </datalist>

          {error && <p role="alert">{error}</p>}

          <div className="manager-toolbar">
            <button type="submit" disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ بيانات الطالب'}
            </button>
            <button type="button" className="quiet" disabled={saving} onClick={() => setDraft(null)}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div className="manager-fields">
        <label>
          البحث بالاسم
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} />
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
        <div className="manager-table">
          <table>
            <thead>
              <tr>
                {['اسم الطالب', 'الصف', 'الشعبة', 'الحالة', 'الإجراء'].map(label => (
                  <th key={label} scope="col">{label}</th>
                ))}
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
                      type="button"
                      className="quiet"
                      aria-label={`تعديل بيانات ${student.full_name}`}
                      disabled={saving || Boolean(draft)}
                      onClick={() => {
                        open(student);
                        document.getElementById('student-list-title')?.scrollIntoView({ block: 'start' });
                      }}
                    >
                      تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>ماكو طلاب مطابقين للبحث.</p>}

      <style jsx>{`
        .student-manager {
          margin-block: 20px;
          padding: clamp(14px, 3vw, 24px);
          border: 1px solid #dce7de;
          border-radius: 16px;
          background: #fff;
          color: #182922;
          box-shadow: 0 4px 18px #1829220a;
        }
        h2, h3 { margin: 0; }
        .manager-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .manager-toolbar span { color: #52665b; font-size: 14px; }
        .manager-fields {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
          gap: 12px;
          margin-block: 16px;
        }
        label { display: grid; gap: 6px; min-width: 0; font-weight: 600; }
        input, select {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          min-height: 42px;
          padding: 8px 10px;
          border: 1px solid #cad9cf;
          border-radius: 8px;
          background: #fff;
          color: inherit;
          font: inherit;
        }
        button {
          min-height: 38px;
          padding: 7px 14px;
          border: 1px solid #19583f;
          border-radius: 8px;
          background: #19583f;
          color: white;
          cursor: pointer;
          font: inherit;
        }
        button.quiet { background: #f1f7f3; color: #19583f; border-color: #dce7de; }
        button:disabled { opacity: .55; cursor: default; }
        :is(button, input, select):focus-visible { outline: 3px solid #b66d2d; outline-offset: 2px; }
        .manager-editor {
          margin-top: 16px;
          padding: 16px;
          border: 1px solid #e9dcc9;
          border-radius: 12px;
          background: #fffcf6;
        }
        .manager-table { max-height: 56vh; overflow: auto; }
        table { width: 100%; min-width: 480px; border-collapse: collapse; }
        th, td { padding: 10px 12px; text-align: start; border-bottom: 1px solid #e7eee9; }
        thead { position: sticky; top: 0; background: #eef5f0; }
        tbody tr:nth-child(even) { background: #fafcfb; }
      `}</style>
    </section>
  );
}