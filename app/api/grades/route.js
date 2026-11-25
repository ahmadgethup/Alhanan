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

function reply(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function validMonth(value) {
  return typeof value === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    Number(value.slice(0, 4)) >= 1900 &&
    Number(value.slice(0, 4)) <= 2200;
}

function connection() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!base || !key) {
    throw new Error('إعدادات Supabase غير مكتملة على الخادم.');
  }

  return {
    url: new URL('/rest/v1/hanan_monthly_grades', base),
    headers: { apikey: key },
  };
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const month = params.get('month');
  const subject = params.get('subject');

  if (!validMonth(month)) {
    return reply({ error: 'اختر شهراً صحيحاً.' }, 400);
  }

  if (subject && !subjects.includes(subject)) {
    return reply({ error: 'المادة غير صحيحة.' }, 400);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SECRET_KEY) {
    return reply({ error: 'إعدادات Supabase غير مكتملة على الخادم.' }, 503);
  }

  try {
    const { url, headers } = connection();

    url.searchParams.set('select', 'student_id,subject,score');
    url.searchParams.set('month_start', `eq.${month}-01`);
    url.searchParams.set('order', 'student_id.asc,subject.asc');
    url.searchParams.set('limit', '100');

    if (subject) url.searchParams.set('subject', `eq.${subject}`);

    const rows = [];

    for (let offset = 0; ; offset += 100) {
      url.searchParams.set('offset', String(offset));

      const response = await fetch(url, {
        headers,
        cache: 'no-store',
        redirect: 'error',
      });

      if (!response.ok) {
        return reply({
          error: `تعذّرت قراءة الدرجات من Supabase (${response.status}).`,
        }, 502);
      }

      const batch = await response.json();

      if (!Array.isArray(batch)) {
        return reply({ error: 'الرد المستلم من قاعدة البيانات غير صالح.' }, 502);
      }

      rows.push(...batch);
      if (batch.length < 100) break;
    }

    return reply(rows);
  } catch {
    return reply({ error: 'تعذّر الاتصال بـ Supabase.' }, 502);
  }
}

export async function POST(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !==
      'application/json') {
    return reply({ error: 'صيغة الطلب غير مدعومة.' }, 415);
  }

  const input = await request.json().catch(() => null);

  if (!input || !validMonth(input.month) ||
      !subjects.includes(input.subject) ||
      !Array.isArray(input.entries) ||
      input.entries.length === 0 ||
      input.entries.length > 250) {
    return reply({ error: 'بيانات الدرجات غير صالحة.' }, 400);
  }

  const invalid = input.entries.some(row =>
    !Number.isSafeInteger(row?.id) ||
    row.id <= 0 ||
    (
      row.score !== null &&
      (
        typeof row.score !== 'number' ||
        !Number.isFinite(row.score) ||
        row.score < 0 ||
        row.score > 100
      )
    )
  );

  if (invalid ||
      new Set(input.entries.map(row => row.id)).size !== input.entries.length) {
    return reply({
      error: 'الدرجات يجب أن تكون بين ٠ و١٠٠، دون تكرار الطالب.',
    }, 400);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SECRET_KEY) {
    return reply({ error: 'إعدادات Supabase غير مكتملة على الخادم.' }, 503);
  }

  try {
    const { url, headers } = connection();

    url.searchParams.set('on_conflict', 'student_id,month_start,subject');
    url.searchParams.set('select', 'student_id,subject,score');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      cache: 'no-store',
      redirect: 'error',
      body: JSON.stringify(input.entries.map(row => ({
        student_id: row.id,
        month_start: `${input.month}-01`,
        subject: input.subject,
        score: row.score,
      }))),
    });

    if (!response.ok) {
      return reply({
        error: `تعذّر حفظ الدرجات في Supabase (${response.status}).`,
      }, 502);
    }

    const rows = await response.json();

    return reply({ saved: rows.length, rows });
  } catch {
    return reply({ error: 'تعذّر الاتصال بـ Supabase.' }, 502);
  }
}