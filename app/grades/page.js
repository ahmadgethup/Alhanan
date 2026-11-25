'use client';

import MonthlyGrades from '../components/MonthlyGrades';

export default function GradesPage() {
  return (
    <div className="grades-page" dir="rtl" lang="ar">
      <div className="grades-shell">
        <header className="grades-header">
          <div className="grades-brand">
            <img
              src="/hanan-logo.png"
              alt=""
              width={54}
              height={46}
            />
            <strong>ثانوية حنان الأهلية للبنين</strong>
          </div>

          <a href="/teacher">العودة إلى شاشة المعلم ←</a>
        </header>

        <MonthlyGrades mode="teacher" />
      </div>

      <style jsx>{`
        .grades-page {
          width: 100%;
          min-height: 100vh;
          margin: 0;
          background: #f5f8fb;
          color: #172c3a;
          font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif;
        }

        .grades-page,
        .grades-page * {
          box-sizing: border-box;
        }

        .grades-shell {
          width: min(100%, 1320px);
          margin-inline: auto;
          padding: 18px clamp(14px, 4vw, 40px) 40px;
        }

        .grades-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #dce7ee;
        }

        .grades-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .grades-brand img {
          object-fit: contain;
        }

        .grades-header a {
          padding: 8px 12px;
          border: 1px solid #dce7ee;
          border-radius: 9px;
          background: #fff;
          color: #24678f;
          text-decoration: none;
          font-size: 14px;
        }

        .grades-header a:focus-visible {
          outline: 3px solid #72afd1;
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}