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

const levels = ['ممتاز', 'جيد جداً', 'جيد', 'متوسط', 'يحتاج متابعة'];
const number = new Intl.NumberFormat('ar-IQ');

async function request(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data === null) {
    throw new Error(
      data?.error || `تعذّر إكمال الطلب (${response.status}).`
    );
  }

  return data;
}

export default function TeacherPage() {
  const [students, setStudents] = useState(null);
  const [rosterError, setRosterError] = useState('');
  const [rosterRetry, setRosterRetry] = useState(0);

  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [week, setWeek] = useState('');

  const [loaded, setLoaded] = useState(null);
  const [changes, setChanges] = useState({});
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setWeek(
      new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Baghdad',
      }).format(new Date())
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    request('/api/roster', { signal: controller.signal })
      .then(rows => {
        if (!Array.isArray(rows)) {
          throw new Error('قائمة الطلاب المستلمة غير صالحة.');
        }

        if (!controller.signal.aborted) setStudents(rows);
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setRosterError(error.message);
        }
      });

    return () => controller.abort();
  }, [rosterRetry]);

  const roster = students ?? [];

  const grades = [
    ...new Set(roster.map(student => student.grade)),
  ];

  const sections = [
    ...new Set(
      roster
        .filter(student => student.grade === grade)
        .map(student => student.section)
    ),
  ];

  const visible = roster.filter(
    student => student.grade === grade && student.section === section
  );

  const ready = Boolean(subject && grade && section && week);
  const selection = JSON.stringify([subject, grade, section, week]);
  const active = ready && loaded?.selection === selection;
  const changedCount = Object.keys(changes).length;

  const savedCount = active
    ? visible.filter(student => Boolean(loaded.ratings[student.id])).length
    : 0;

  useEffect(() => {
    if (!ready) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ subject, week });

    request(`/api/ratings?${params}`, {
      signal: controller.signal,
    })
      .then(rows => {
        if (controller.signal.aborted) return;

        if (!Array.isArray(rows)) {
          throw new Error('بيانات التقييمات المستلمة غير صالحة.');
        }

        setLoaded({
          selection,
          ratings: Object.fromEntries(
            rows.map(row => [row.student_id, row.rating])
          ),
        });
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setLoadError(error.message);
        }
      });

    return () => controller.abort();
  }, [ready, selection, subject, week, retry]);

  useEffect(() => {
    if (!changedCount && !saving) return;

    function warnBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
    };
  }, [changedCount, saving]);

  function confirmLeave() {
    return (
      !changedCount ||
      window.confirm('عندك تقييمات غير محفوظة. تريد المتابعة؟')
    );
  }

  function handleNavigation(event) {
    if (saving || !confirmLeave()) {
      event.preventDefault();
    }
  }

  function changeSelection(update) {
    if (saving || !confirmLeave()) return;

    setLoaded(null);
    setChanges({});
    setLoadError('');
    setMessage(null);
    update();
  }

  function changeRating(id, value) {
    setMessage(null);

    setChanges(previous => {
      const next = { ...previous };

      if (value === (loaded.ratings[id] ?? '')) {
        delete next[id];
      } else {
        next[id] = value;
      }

      return next;
    });
  }

  async function save() {
    if (saving || !changedCount || !active) return;

    setSaving(true);
    setMessage(null);

    try {
      const entries = Object.entries(changes).map(([id, rating]) => ({
        id: Number(id),
        rating: rating || null,
      }));

      await request('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          week,
          entries,
        }),
      });

      setLoaded(previous => ({
        ...previous,
        ratings: {
          ...previous.ratings,
          ...changes,
        },
      }));

      setChanges({});
      setMessage({
        type: 'success',
        text: 'تم حفظ التقييمات في قاعدة البيانات.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="teacher-page" dir="rtl" lang="ar">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        precedence="teacher-font"
      />

      <div className="teacher-shell">
        <header className="teacher-header">
          <div className="teacher-brand">
            <img
              src="/hanan-logo.png"
              alt=""
              width={52}
              height={43}
            />
            <span>ثانوية حنان الأهلية للبنين</span>
          </div>

          <Link
            className="teacher-back"
            href="/"
            onClick={handleNavigation}
          >
            العودة إلى حنان <span aria-hidden="true">←</span>
          </Link>
        </header>

        <nav className="teacher-tabs" aria-label="أقسام المعلم">
          <span className="teacher-tab current" aria-current="page">
            تقييم الطلاب
          </span>

          <Link
            href="/grades"
            className="teacher-tab grades-tab"
            onClick={handleNavigation}
          >
            الدرجات الشهرية
            <span aria-hidden="true">←</span>
          </Link>
        </nav>

        <section className="teacher-intro" aria-labelledby="teacher-title">
          <div>
            <span className="teacher-eyebrow">المتابعة والتقييم</span>
            <h1 id="teacher-title">تقييم الطلاب</h1>
            <p>
              اختَر المادة والصف والشعبة والأسبوع حتى تظهر قائمة الطلاب.
            </p>
          </div>

          <Link
            href="/grades"
            className="teacher-grades-link"
            onClick={handleNavigation}
          >
            <span className="grades-icon" aria-hidden="true">١٠٠</span>
            <span>
              <strong>إدخال الدرجات الشهرية</strong>
              <small>درجات الطلاب وبطاقاتهم الشهرية</small>
            </span>
            <span aria-hidden="true">←</span>
          </Link>
        </section>

        {rosterError && (
          <div className="teacher-notice warning">
            <p role="alert">{rosterError}</p>
            <button
              type="button"
              onClick={() => {
                setRosterError('');
                setRosterRetry(value => value + 1);
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {!students && !rosterError && (
          <p className="teacher-notice" role="status">
            جارٍ تحميل الطلاب…
          </p>
        )}

        {students?.length === 0 && (
          <p className="teacher-notice">ماكو طلاب في القائمة.</p>
        )}

        {students?.length > 0 && (
          <div className="teacher-filters-card">
            <label>
              المادة
              <select
                value={subject}
                disabled={saving}
                onChange={event => {
                  const value = event.target.value;
                  changeSelection(() => setSubject(value));
                }}
              >
                <option value="">اختر المادة</option>
                {subjects.map(name => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>

            <label>
              الصف
              <select
                value={grade}
                disabled={saving}
                onChange={event => {
                  const value = event.target.value;

                  changeSelection(() => {
                    setGrade(value);
                    setSection('');
                  });
                }}
              >
                <option value="">اختر الصف</option>
                {grades.map(name => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>

            <label>
              الشعبة
              <select
                value={section}
                disabled={saving || !grade}
                onChange={event => {
                  const value = event.target.value;
                  changeSelection(() => setSection(value));
                }}
              >
                <option value="">اختر الشعبة</option>
                {sections.map(name => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>

            <label>
              الأسبوع المنتهي في
              <input
                type="date"
                dir="ltr"
                value={week}
                disabled={saving}
                onChange={event => {
                  const value = event.target.value;
                  changeSelection(() => setWeek(value));
                }}
              />
            </label>
          </div>
        )}

        {ready && !active && (
          loadError ? (
            <div className="teacher-notice warning">
              <p role="alert">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadError('');
                  setRetry(value => value + 1);
                }}
              >
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <p className="teacher-notice" role="status">
              جارٍ تحميل التقييمات…
            </p>
          )
        )}

        {active && (
          <section className="teacher-roster" aria-labelledby="roster-title">
            <div className="roster-header">
              <div>
                <h2 id="roster-title">{subject}</h2>
                <p>{grade} · الشعبة {section}</p>
              </div>

              <div className="roster-progress">
                <span>
                  <strong>{number.format(savedCount)}</strong>
                  {' من '}
                  {number.format(visible.length)}
                  {' تقييم محفوظ'}
                </span>

                <progress
                  max={visible.length || 1}
                  value={savedCount}
                  aria-label="التقييمات المحفوظة في الشعبة"
                />
              </div>
            </div>

            <div className="roster-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="row-number">ت</th>
                    <th scope="col">اسم الطالب</th>
                    <th scope="col" className="rating-column">التقييم</th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map((student, index) => {
                    const pending = Object.hasOwn(changes, student.id);

                    const rating =
                      changes[student.id] ??
                      loaded.ratings[student.id] ??
                      '';

                    return (
                      <tr
                        key={student.id}
                        className={pending ? 'pending-row' : ''}
                      >
                        <td className="row-number">
                          {number.format(index + 1)}
                        </td>

                        <th scope="row">{student.full_name}</th>

                        <td className="rating-column">
                          <select
                            className={rating ? 'rating-rated' : 'rating-empty'}
                            aria-label={`تقييم ${student.full_name}`}
                            disabled={saving}
                            value={rating}
                            onChange={event =>
                              changeRating(student.id, event.target.value)
                            }
                          >
                            <option value="">غير مقيّم</option>
                            {levels.map(level => (
                              <option key={level}>{level}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="teacher-save">
              <div className="save-feedback">
                {message ? (
                  <p
                    className={message.type}
                    role={message.type === 'error' ? 'alert' : 'status'}
                  >
                    {message.text}
                  </p>
                ) : changedCount > 0 ? (
                  <p className="pending" role="status">
                    تغييرات غير محفوظة: {number.format(changedCount)}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                disabled={saving || !changedCount}
                onClick={save}
              >
                {saving ? 'جارٍ الحفظ…' : 'حفظ التقييمات'}
              </button>
            </div>
          </section>
        )}
      </div>

      <style jsx global>{`
        main.teacher-page {
          --teacher-ink: #172620;
          --teacher-muted: #51645a;
          --teacher-green: #21634b;
          --teacher-border: #dce6df;
          width: 100%;
          max-width: none;
          margin: 0;
          min-height: 100vh;
          background: #f5f8f6;
          color: var(--teacher-ink);
          font: 16px/1.7 'IBM Plex Sans Arabic', Tahoma, sans-serif;
        }

        .teacher-page,
        .teacher-page * {
          box-sizing: border-box;
        }

        .teacher-page .teacher-shell {
          width: min(100%, 1280px);
          margin-inline: auto;
          padding: 0 clamp(14px, 4vw, 40px) 32px;
        }

        .teacher-page .teacher-header,
        .teacher-page .teacher-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .teacher-page .teacher-header {
          justify-content: space-between;
          flex-wrap: wrap;
          padding-block: 14px;
          border-bottom: 1px solid var(--teacher-border);
        }

        .teacher-page .teacher-brand {
          font-weight: 700;
        }

        .teacher-page .teacher-brand img {
          object-fit: contain;
          flex-shrink: 0;
        }

        .teacher-page .teacher-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border: 1px solid var(--teacher-border);
          border-radius: 9px;
          background: #fff;
          color: var(--teacher-green);
          text-decoration: none;
          font-weight: 600;
        }

        .teacher-page .teacher-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 20px;
        }

        .teacher-page .teacher-tab {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 9px 18px;
          border: 1px solid var(--teacher-border);
          border-radius: 10px;
          background: #fff;
          color: var(--teacher-green);
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
        }

        .teacher-page .teacher-tab.current {
          border-color: var(--teacher-green);
          background: var(--teacher-green);
          color: #fff;
        }

        .teacher-page .grades-tab {
          border-color: #cbdfea;
          color: #24678f;
        }

        .teacher-page .teacher-intro {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin: 18px 0;
          padding: 24px clamp(16px, 3vw, 28px);
          border: 1px solid var(--teacher-border);
          border-radius: 16px;
          background: linear-gradient(110deg, #fff, #eaf4ed);
        }

        .teacher-page .teacher-eyebrow {
          color: var(--teacher-green);
          font-size: 13px;
          font-weight: 600;
        }

        .teacher-page .teacher-intro h1 {
          margin: 4px 0;
          font-size: clamp(28px, 4vw, 42px);
          font-weight: 700;
          line-height: 1.35;
        }

        .teacher-page .teacher-intro p,
        .teacher-page .roster-header p {
          margin: 5px 0 0;
          color: var(--teacher-muted);
        }

        .teacher-page .teacher-grades-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border: 1px solid #cbdfea;
          border-radius: 13px;
          background: #fff;
          color: #24678f;
          text-decoration: none;
        }

        .teacher-page .teacher-grades-link strong,
        .teacher-page .teacher-grades-link small {
          display: block;
        }

        .teacher-page .teacher-grades-link strong {
          font-size: 15px;
        }

        .teacher-page .teacher-grades-link small {
          color: #637987;
          font-size: 12px;
        }

        .teacher-page .grades-icon {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 11px;
          background: #edf6fc;
          font-weight: 700;
          flex-shrink: 0;
        }

        .teacher-page .teacher-filters-card,
        .teacher-page .teacher-roster {
          border: 1px solid var(--teacher-border);
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 4px 14px #17262008;
        }

        .teacher-page .teacher-filters-card {
          display: grid;
          grid-template-columns: 1.25fr 1fr .8fr 1fr;
          gap: 14px;
          padding: 16px;
        }

        .teacher-page .teacher-filters-card label {
          display: grid;
          min-width: 0;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
        }

        .teacher-page select,
        .teacher-page input {
          width: 100%;
          min-width: 0;
          min-height: 42px;
          padding: 7px 9px;
          border: 1px solid #cbdad1;
          border-radius: 8px;
          background: #fff;
          color: var(--teacher-ink);
          font: inherit;
          font-size: 15px;
          font-weight: 500;
        }

        .teacher-page select:disabled,
        .teacher-page input:disabled {
          opacity: .65;
        }

        .teacher-page .teacher-notice {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin: 16px 0;
          padding: 12px 16px;
          border: 1px solid var(--teacher-border);
          border-radius: 10px;
          background: #fff;
        }

        .teacher-page .teacher-notice p {
          margin: 0;
        }

        .teacher-page .teacher-notice.warning {
          background: #fff4e8;
          color: #8b471c;
        }

        .teacher-page .teacher-notice button {
          padding: 6px 12px;
          border: 1px solid currentColor;
          border-radius: 8px;
          background: #fff;
          color: #8b471c;
          cursor: pointer;
          font: inherit;
        }

        .teacher-page .teacher-roster {
          margin-top: 16px;
        }

        .teacher-page .roster-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 16px 18px;
        }

        .teacher-page .roster-header h2 {
          margin: 0;
          font-size: 22px;
        }

        .teacher-page .roster-progress {
          display: grid;
          gap: 6px;
          width: min(100%, 220px);
          color: var(--teacher-green);
          font-size: 14px;
        }

        .teacher-page .roster-progress progress {
          appearance: none;
          width: 100%;
          height: 8px;
          overflow: hidden;
          border: 0;
          border-radius: 999px;
          background: #e7eee9;
        }

        .teacher-page progress::-webkit-progress-bar {
          background: #e7eee9;
        }

        .teacher-page progress::-webkit-progress-value {
          border-radius: 999px;
          background: var(--teacher-green);
        }

        .teacher-page progress::-moz-progress-bar {
          border-radius: 999px;
          background: var(--teacher-green);
        }

        .teacher-page .roster-table {
          overflow-x: auto;
        }

        .teacher-page .roster-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .teacher-page .roster-table th,
        .teacher-page .roster-table td {
          padding: 9px 14px;
          border-block-start: 1px solid var(--teacher-border);
          text-align: start;
        }

        .teacher-page .roster-table thead {
          background: #eef4f0;
          color: #345044;
        }

        .teacher-page .roster-table tbody th {
          font-weight: 500;
        }

        .teacher-page .row-number {
          width: 48px;
          color: var(--teacher-muted);
        }

        .teacher-page .rating-column {
          width: clamp(125px, 24%, 240px);
        }

        .teacher-page .roster-table tbody tr:nth-child(even):not(.pending-row) {
          background: #fafcfb;
        }

        .teacher-page .roster-table .pending-row {
          background: #fff4e8;
        }

        .teacher-page .rating-empty {
          background: #f6f8f7;
          color: var(--teacher-muted);
        }

        .teacher-page .rating-rated {
          background: #eaf5ee;
          border-color: #c4ddcd;
          color: var(--teacher-green);
        }

        .teacher-page .teacher-save {
          position: sticky;
          bottom: 0;
          z-index: 1;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 16px;
          border-top: 1px solid var(--teacher-border);
          border-radius: 0 0 14px 14px;
          background: #fff;
          box-shadow: 0 -6px 20px #17262010;
        }

        .teacher-page .save-feedback p {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .teacher-page .save-feedback .success {
          color: var(--teacher-green);
        }

        .teacher-page .save-feedback .pending,
        .teacher-page .save-feedback .error {
          color: #8b471c;
        }

        .teacher-page .teacher-save button {
          margin-inline-start: auto;
          padding: 9px 18px;
          border: 0;
          border-radius: 9px;
          background: var(--teacher-green);
          color: #fff;
          cursor: pointer;
          font: inherit;
          font-weight: 700;
        }

        .teacher-page .teacher-save button:not(:disabled):hover {
          background: #184e3a;
        }

        .teacher-page .teacher-save button:disabled {
          opacity: .55;
          cursor: default;
        }

        .teacher-page :is(a, button, select, input):focus-visible {
          outline: 3px solid #378165;
          outline-offset: 3px;
        }

        @media (max-width: 760px) {
          .teacher-page .teacher-filters-card {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .teacher-page .teacher-grades-link {
            width: 100%;
          }
        }

        @media (max-width: 420px) {
          .teacher-page .roster-table th,
          .teacher-page .roster-table td {
            padding-inline: 8px;
          }

          .teacher-page .row-number {
            width: 28px;
          }

          .teacher-page .teacher-save button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}