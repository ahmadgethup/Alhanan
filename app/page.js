'use client';

import Link from 'next/link';

const sections = [
  {
    href: '/teacher',
    title: 'أنا معلّم',
    description: 'تقييم طلاب الشعبة',
    icon: '✎',
    className: 'teacher-entry',
  },
  {
    href: '/computer',
    title: 'أنا من قسم الحاسبات',
    description: 'متابعة الإنجاز وتنزيل التقارير',
    icon: '▤',
    className: 'computer-entry',
  },
];

export default function HomePage() {
  return (
    <div
      className="hanan-landing"
      dir="rtl"
      lang="ar"
      style={{ minHeight: '100vh', backgroundColor: '#0b2118', color: '#f8f8ee' }}
    >
      <header className="hanan-header">
        <div className="hanan-brand">
          <img src="/hanan-logo.png" alt="" width={56} height={46} />
          <span>مدرسة حنان الأهلية</span>
        </div>

        <details className="developer-menu">
          <summary>
            <span aria-hidden="true"></span> عن المطوّر
          </summary>

          <div className="developer-profile">
            <h2>أحمد نوزاد</h2>
            <p className="developer-role">متخصص في مجال البرمجيات</p>
            <p>
              طوّرت منصة حنان لخدمة المدرسة. إذا واجهتكم مشكلة في استخدام
              المنصة أو عندكم اقتراح لتطويرها، تواصلوا وياي على تيليجرام.
            </p>
            <a
              className="developer-contact"
              href="https://t.me/Ahmaddnawzad"
              target="_blank"
              rel="noopener noreferrer"
            >
              راسلني على تيليجرام <bdi>@Ahmaddnawzad</bdi>
            </a>
          </div>
        </details>
      </header>

      <main className="hanan-hero">
        <section className="hero-copy" aria-labelledby="hanan-title">
          <div className="hero-intro">
            <p className="hero-label">منصة المتابعة الأسبوعية</p>
            <h1 id="hanan-title">متابعة <span>الطلاب</span></h1>
            <p className="hero-description">
              قيّم طلاب الشعبة، تابع تقدّمهم، وجهّز تقاريرهم الأسبوعية.
            </p>
          </div>

          <nav className="hanan-entries" aria-label="أقسام المنصة">
  {sections.map(section => {
    const cardContent = (
      <>
        <span className="entry-top" aria-hidden="true">
          <span className="entry-icon">{section.icon}</span>
          <span className="entry-arrow">←</span>
        </span>
        <strong>{section.title}</strong>
        <small>{section.description}</small>
      </>
    );

    const className = `hanan-entry ${section.className}`;

    if (section.href === '/computer') {
      return (
        <a key={section.href} href="/computer?unlock=1" className={className}>
          {cardContent}
        </a>
      );
    }

    return (
      <Link key={section.href} href={section.href} className={className}>
        {cardContent}
      </Link>
    );
  })}
</nav>
        </section>

        <div className="hanan-scene" aria-hidden="true">
          <div className="scene-glow" />
          <div className="scene-ring ring-outer" />
          <div className="scene-ring ring-inner" />
          <div className="scene-orbit"><i /></div>
          <div className="scene-orbit orbit-second"><i /></div>
          <span className="scene-star star-top">✦</span>
          <span className="scene-star star-bottom">✦</span>

          <div className="scene-logo">
            <img
              src="/hanan-logo.png"
              alt=""
              width={240}
              height={195}
              fetchPriority="high"
              style={{
                display: 'block',
                width: '100%',
                maxWidth: 240,
                height: 'auto',
                marginInline: 'auto',
              }}
            />
          </div>
        </div>
      </main>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

        .hanan-landing {
          --gold: #f2cc78;
          --ink: #f8f8ee;
          --muted: #bed0c4;
          --gutter: clamp(18px, 5vw, 64px);
          font-family: Cairo, Tahoma, sans-serif;
          background-image:
            radial-gradient(ellipse at 23% 42%, #214f37, transparent 53%),
            linear-gradient(130deg, #0b2118, #102e22 53%, #081b14);
        }

        .hanan-landing,
        .hanan-landing :global(*) {
          box-sizing: border-box;
        }

        .hanan-header,
        .hanan-hero {
          width: min(100%, 1320px);
          margin-inline: auto;
          padding-inline: var(--gutter);
        }

        .hanan-header {
          position: relative;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-block: 20px;
          border-bottom: 1px solid #e2efd51a;
        }

        .hanan-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: clamp(12px, 2vw, 16px);
          font-weight: 800;
        }

        .hanan-brand img {
          flex-shrink: 0;
          object-fit: contain;
        }

        .developer-menu {
          position: relative;
          flex-shrink: 0;
        }

        .developer-menu summary {
          cursor: pointer;
          list-style: none;
          padding: 8px 12px;
          border: 1px solid #e3f1dd33;
          border-radius: 100px;
          background: #eef9e70d;
          font-size: 12px;
          font-weight: 700;
        }

        .developer-menu summary::-webkit-details-marker {
          display: none;
        }

        .developer-menu[open] summary {
          border-color: var(--gold);
          color: var(--gold);
        }

        .developer-profile {
          position: absolute;
          inset-inline-end: 0;
          top: calc(100% + 12px);
          width: min(330px, calc(100vw - 2 * var(--gutter)));
          padding: 20px;
          border: 1px solid #dfebd7;
          border-radius: 18px;
          background: #fbfcf5;
          color: #183c29;
          box-shadow: 0 18px 55px #0006;
        }

        .developer-menu[open] .developer-profile {
          animation: hanan-rise 280ms ease both;
        }

        .developer-profile h2 {
          margin: 0;
          font-size: 22px;
        }

        .developer-profile p {
          margin: 8px 0 0;
          font-size: 14px;
          line-height: 1.85;
        }

        .developer-role {
          color: #2c6b47;
          font-weight: 800;
        }

        .developer-contact {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 4px 12px;
          margin-top: 16px;
          padding: 9px 12px;
          border-radius: 9px;
          background: #215c3a;
          color: white;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }

        .hanan-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
          align-items: center;
          gap: clamp(20px, 4vw, 60px);
          min-height: min(660px, calc(100vh - 87px));
          padding-block: 36px 56px;
        }

        .hero-intro {
          animation: hanan-rise 650ms ease-out both;
        }

        .hero-label {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 14px;
          color: var(--gold);
          font-size: 13px;
          font-weight: 800;
        }

        .hero-label::before {
          content: '';
          width: 28px;
          height: 1px;
          background: currentColor;
        }

        .hero-copy h1 {
          margin: 0;
          font-size: clamp(42px, 6.6vw, 88px);
          font-weight: 900;
          line-height: 1.25;
        }

        .hero-copy h1 span {
          color: var(--gold);
        }

        .hero-description {
          max-width: 42ch;
          margin: 18px 0 28px;
          color: var(--muted);
          font-size: clamp(15px, 1.7vw, 19px);
          line-height: 1.9;
        }

        .hanan-entries {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .hanan-entries :global(.hanan-entry) {
          --accent: #c4eed2;
          --icon-bg: #bfebce1a;
          position: relative;
          isolation: isolate;
          overflow: hidden;
          display: grid;
          align-content: start;
          gap: 5px;
          min-height: 148px;
          padding: 17px;
          border: 1px solid #b5e4c744;
          border-radius: 18px;
          background: linear-gradient(145deg, #2a5941, #173d2d);
          color: var(--ink);
          text-decoration: none;
          box-shadow: 0 14px 32px #0002;
          animation: hanan-rise 600ms 120ms ease-out both;
          transition: translate 200ms ease, border-color 200ms ease,
            box-shadow 200ms ease;
        }

        .hanan-entries :global(.computer-entry) {
          --accent: #f5d991;
          --icon-bg: #f5d99120;
          border-color: #f0cb754d;
          background: linear-gradient(145deg, #414831, #283828);
          animation-delay: 240ms;
        }

        .hanan-entries :global(.hanan-entry)::before {
          content: '';
          position: absolute;
          z-index: -1;
          inset: 0;
          background: linear-gradient(115deg, transparent 20%, #fff3 48%, transparent 76%);
          transform: translateX(110%);
          transition: transform 550ms ease;
        }

        .entry-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
          color: var(--accent);
        }

        .entry-icon {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: var(--icon-bg);
          font-size: 22px;
        }

        .entry-arrow {
          font-size: 22px;
          transition: transform 200ms ease;
        }

        .hanan-entries strong {
          font-size: 16px;
          font-weight: 800;
        }

        .hanan-entries small {
          color: #e1ecdf;
          font-size: 12px;
          line-height: 1.7;
        }

        @media (hover: hover) {
          .hanan-entries :global(.hanan-entry:hover) {
            translate: 0 -5px;
            border-color: var(--accent);
            box-shadow: 0 18px 36px #0004;
          }

          .hanan-entries :global(.hanan-entry:hover)::before {
            transform: translateX(-110%);
          }

          .hanan-entries :global(.hanan-entry:hover) .entry-arrow {
            transform: translateX(-5px);
          }
        }

        .hanan-landing :global(a:focus-visible),
        .hanan-landing summary:focus-visible {
          outline: 3px solid var(--gold);
          outline-offset: 4px;
        }

        .hanan-scene {
          position: relative;
          isolation: isolate;
          display: grid;
          place-items: center;
          width: min(100%, 370px);
          aspect-ratio: 1;
          margin-inline: auto;
          pointer-events: none;
        }

        .scene-glow,
        .scene-ring,
        .scene-orbit {
          position: absolute;
          border-radius: 50%;
        }

        .scene-glow {
          inset: 0;
          z-index: -2;
          background: radial-gradient(circle, #f6ce7450, #adc57927 43%, transparent 70%);
          animation: hanan-glow 5s ease-in-out infinite;
        }

        .ring-outer {
          inset: 4%;
          border: 1px dashed #eac56a47;
        }

        .ring-inner {
          inset: 12%;
          border: 1px solid #eac56a64;
        }

        .scene-orbit {
          inset: 4%;
          animation: hanan-orbit 14s linear infinite;
        }

        .scene-orbit i {
          position: absolute;
          top: 0;
          left: 50%;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ffe6a2;
          box-shadow: 0 0 15px 3px #ffe6a2a0;
          transform: translate(-50%, -50%);
        }

        .orbit-second {
          inset: 12%;
          animation: hanan-orbit 19s -6s linear infinite reverse;
        }

        .orbit-second i {
          width: 5px;
          height: 5px;
          background: #c4f0ca;
          box-shadow: 0 0 12px 2px #c4f0ca99;
        }

        .scene-star {
          position: absolute;
          color: var(--gold);
          font-size: clamp(14px, 3vw, 25px);
          animation: hanan-star 3s ease-in-out infinite;
        }

        .star-top {
          top: 13%;
          right: 14%;
        }

        .star-bottom {
          bottom: 16%;
          left: 10%;
          font-size: 16px;
          animation-duration: 4s;
          animation-delay: -1.5s;
        }

        .scene-logo {
          z-index: 1;
          width: min(72%, 240px);
          animation: hanan-float 4s ease-in-out infinite;
        }

        .scene-logo img {
          filter: drop-shadow(0 16px 23px #08140b9c);
        }

        @keyframes hanan-rise {
          from { opacity: .65; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes hanan-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }

        @keyframes hanan-glow {
          0%, 100% { opacity: .75; }
          50% { opacity: 1; }
        }

        @keyframes hanan-orbit {
          from { transform: rotate(-105deg); }
          to { transform: rotate(255deg); }
        }

        @keyframes hanan-star {
          0%, 100% { opacity: .55; transform: translateY(0) scale(.85); }
          50% { opacity: 1; transform: translateY(-5px) scale(1.18); }
        }

        @media (max-width: 760px) {
          .hanan-header { padding-block: 14px; }
          .hanan-brand img { width: 40px; height: 34px; }

          .hanan-hero {
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
            min-height: auto;
            padding-block: 16px 36px;
          }

          .hanan-scene {
            grid-row: 1;
            width: min(60vw, 230px);
          }

          .hero-intro { text-align: center; }
          .hero-description { margin: 12px auto 22px; }
          .hanan-entries { max-width: 540px; margin-inline: auto; }
        }

        @media (max-width: 440px) {
          .hanan-entries { grid-template-columns: 1fr; }
          .hanan-entries :global(.hanan-entry) { min-height: 108px; }
          .developer-menu { position: static; }

          .developer-profile {
            inset-inline-end: var(--gutter);
            top: calc(100% + 8px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hanan-landing :global(*),
          .hanan-entries :global(.hanan-entry)::before {
            animation: none !important;
            transition: none !important;
          }

          .hanan-entries :global(.hanan-entry:hover) { translate: none; }
          .hanan-entries :global(.hanan-entry)::before { display: none; }
          .hanan-entries :global(.hanan-entry:hover) .entry-arrow { transform: none; }
        }
      `}</style>
    </div>
  );
}