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

const levels = ['ممتاز', 'جيد جداً', 'جيد', 'متوسط', 'يحتاج متابعة'];

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `تعذّر إكمال الطلب (${response.status}).`);
  }

  return data;
}

export default function TeacherPage() {
  const [students, setStudents] = useState(null);
  const [rosterError, setRosterError] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [week, setWeek] = useState('');
  const [ratings, setRatings] = useState({});
  const [changes, setChanges] = useState({});
  const [loadedKey, setLoadedKey] = useState('');
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    setWeek(today);

    const controller = new AbortController();

    request('/api/roster', { signal: controller.signal })
      .then(setStudents)
      .catch(error => {
        if (!controller.signal.aborted) setRosterError(error.message);
      });

    return () => controller.abort();
  }, []);

  const roster = students ?? [];
  const grades = [...new Set(roster.map(student => student.grade))];
  const sections = [
    ...new Set(
      roster.filter(student => student.grade === grade)
        .map(student => student.section)
    ),
  ];

  const visible = roster.filter(
    student => student.grade === grade && student.section === section
  );
  const ids = visible.map(student => student.id).join(',');
  const selectionKey = JSON.stringify([subject, grade, section, week]);

  useEffect(() => {
    setLoadedKey('');
    setLoadError('');
    setChanges({});
    setMessage('');

    if (!subject || !week || !ids) return;

    const controller = new AbortController();
    const query = new URLSearchParams({ subject, week, ids });

    request(`/api/ratings?${query}`, { signal: controller.signal })
      .then(rows => {
        if (controller.signal.aborted) return;
        setRatings(Object.fromEntries(
          rows.map(row => [row.student_id, row.rating])
        ));
        setLoadedKey(selectionKey);
      })
      .catch(error => {
        if (!controller.signal.aborted) setLoadError(error.message);
      });

    return () => controller.abort();
  }, [subject, week, ids, selectionKey, retry]);

  const hasChanges = Object.keys(changes).length > 0;

  function changeSelection(update) {
    if (hasChanges && !window.confirm('عندك تقييمات غير محفوظة. تريد تغيير الاختيار؟')) {
      return;
    }
    update();
  }

  async function saveRatings() {
    if (saving || loadedKey !== selectionKey || !hasChanges) return;

    setSaving(true);
    setMessage('');

    try {
      const entries = Object.entries(changes).map(([id, rating]) => ({
        id: Number(id),
        rating: rating || null,
      }));

      await request('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, week, entries }),
      });

      setRatings(previous => ({ ...previous, ...changes }));
      setChanges({});
      setMessage('تم حفظ التقييمات في Supabase.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content teacher-screen" dir="rtl">
      <a href="/">العودة إلى حنان</a>
      <h1>تقييم الطلاب</h1>

      {rosterError && <p role="alert">{rosterError}</p>}
      {!students && !rosterError && <p role="status">جارٍ تحميل الطلاب…</p>}
      {students?.length === 0 && <p>ماكو طلاب في القائمة.</p>}

      {students?.length > 0 && (
        <div className="panel">
          <div className="filters teacher-filters">
            <label>
              المادة
              <select disabled={saving} value={subject}
                onChange={event => {
                  const value = event.target.value;
                  changeSelection(() => setSubject(value));
                }}>
                <option value="">اختر المادة</option>
                {subjects.map(name => <option key={name}>{name}</option>)}
              </select>
            </label>

            <label>
              الصف
              <select disabled={saving} value={grade}
                onChange={event => {
                  const value = event.target.value;
                  changeSelection(() => {
                    setGrade(value);
                    setSection('');
                  });
                }}>
                <option value="">اختر الصف</option>
                {grades.map(name => <option key={name}>{name}</option>)}
              </select>
            </label>

            <label>
              الشعبة
              <select disabled={saving || !grade} value={section}
                onChange={event => {
                  const value = event.target.value;
                  changeSelection(() => setSection(value));
                }}>
                <option value="">اختر الشعبة</option>
                {sections.map(name => <option key={name}>{name}</option>)}
              </select>
            </label>

            <label>
              الأسبوع المنتهي في
              <input type="date" disabled={saving} value={week}
                onChange={event => {
                  const value = event.target.value;
                  changeSelection(() => setWeek(value));
                }}
              />
            </label>
          </div>

          {subject && section && week && ids && loadedKey !== selectionKey && (
            loadError ? (
              <div className="panel-heading">
                <p role="alert">{loadError}</p>
                <button className="secondary" onClick={() => setRetry(value => value + 1)}>
                  إعادة المحاولة
                </button>
              </div>
            ) : <p className="panel-heading" role="status">جارٍ تحميل التقييمات…</p>
          )}

          {loadedKey === selectionKey && (
            <>
              <div className="panel-heading">
                <h2>{grade} · الشعبة {section} · {subject}</h2>
                <span>{visible.length} طالب</span>
              </div>

              <div className="table-scroll">
                <table className="students teacher-table">
                  <thead>
                    <tr>
                      <th scope="col">الطالب</th>
                      <th scope="col">تقييم {subject}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(student => (
                      <tr key={student.id}>
                        <td>{student.full_name}</td>
                        <td>
                          <select
                            aria-label={`تقييم ${student.full_name}`}
                            disabled={saving}
                            value={changes[student.id] ?? ratings[student.id] ?? ''}
                            onChange={event => {
                              const value = event.target.value;
                              setChanges(previous => ({ ...previous, [student.id]: value }));
                              setMessage('');
                            }}
                          >
                            <option value="">بدون تقييم</option>
                            {levels.map(level => <option key={level}>{level}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="panel-heading">
                <button className="primary" disabled={saving || !hasChanges}
                  onClick={saveRatings}>
                  {saving ? 'جارٍ الحفظ…' : 'حفظ التقييمات'}
                </button>
                <p role="status">{message}</p>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}