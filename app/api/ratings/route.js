const subjects = [
  'التربية الإسلامية', 'اللغة العربية', 'اللغة الإنجليزية',
  'الرياضيات', 'الأحياء', 'الكيمياء', 'الفيزياء',
  'الاجتماعيات', 'الحاسوب',
];

const levels = ['ممتاز', 'جيد جداً', 'جيد', 'متوسط', 'يحتاج متابعة'];

function reply(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function validWeek(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

async function handle(request, saving) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!base || !key?.startsWith('sb_secret_')) {
    return reply({ error: 'تحقق من متغيرات Supabase على الخادم.' }, 503);
  }

  try {
    const input = saving
      ? await request.json().catch(() => null)
      : Object.fromEntries(new URL(request.url).searchParams);

    if (!validWeek(input?.week)) {
      return reply({ error: 'اختَر تاريخ أسبوع صحيح.' }, 400);
    }

    const url = new URL('/rest/v1/hanan_ratings', base);
    const options = {
      headers: { apikey: key },
      cache: 'no-store',
      redirect: 'error',
    };

    if (saving) {
      const { subject, week, entries } = input;

      if (
        !subjects.includes(subject) ||
        !Array.isArray(entries) ||
        entries.length === 0 ||
        entries.length > 250 ||
        entries.some(row =>
          !Number.isSafeInteger(row?.id) ||
          row.id <= 0 ||
          (row.rating !== null && !levels.includes(row.rating))
        ) ||
        new Set(entries.map(row => row.id)).size !== entries.length
      ) {
        return reply({ error: 'بيانات التقييم غير صالحة.' }, 400);
      }

      url.searchParams.set('on_conflict', 'student_id,subject,week_end');

      const result = await fetch(url, {
        ...options,
        method: 'POST',
        headers: {
          ...options.headers,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(entries.map(row => ({
          student_id: row.id,
          subject,
          week_end: week,
          rating: row.rating,
        }))),
      });

      if (!result.ok) {
        return reply(
          { error: `تعذّر الحفظ في Supabase (${result.status}).` },
          502,
        );
      }

      return reply({ saved: entries.length });
    }

    url.searchParams.set('select', 'student_id,subject,rating');
    url.searchParams.set('week_end', `eq.${input.week}`);
    url.searchParams.set('rating', 'not.is.null');
    url.searchParams.set('order', 'student_id.asc,subject.asc');
    url.searchParams.set('limit', '100');

    if (input.subject) {
      if (!subjects.includes(input.subject)) {
        return reply({ error: 'المادة غير صالحة.' }, 400);
      }

      url.searchParams.set('subject', `eq.${input.subject}`);
    }

    const rows = [];

    for (let offset = 0; ; offset += 100) {
      url.searchParams.set('offset', String(offset));
      const result = await fetch(url, options);

      if (!result.ok) {
        return reply(
          { error: `تعذّرت قراءة جدول التقييمات (${result.status}).` },
          502,
        );
      }

      const batch = await result.json();
      rows.push(...batch);

      if (batch.length < 100) return reply(rows);
    }
  } catch {
    return reply({ error: 'تعذّر الاتصال بـ Supabase. حاول مرة ثانية.' }, 502);
  }
}

export function GET(request) {
  return handle(request, false);
}

export function POST(request) {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim();

  if (contentType !== 'application/json') {
    return reply({ error: 'صيغة الطلب غير مدعومة.' }, 415);
  }

  return handle(request, true);
}