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

export async function GET(request) {
  const month = new URL(request.url).searchParams.get('month');

  if (!validMonth(month)) {
    return reply({ error: 'اختر شهراً صحيحاً.' }, 400);
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!base || !key) {
    return reply({ error: 'إعدادات Supabase غير مكتملة.' }, 503);
  }

  try {
    const url = new URL('/rest/v1/hanan_monthly_notes', base);

    url.searchParams.set('select', 'student_id,positive,negative,notes');
    url.searchParams.set('month_start', `eq.${month}-01`);
    url.searchParams.set('order', 'student_id.asc');
    url.searchParams.set('limit', '100');

    const rows = [];

    for (let offset = 0; ; offset += 100) {
      url.searchParams.set('offset', String(offset));

      const response = await fetch(url, {
        headers: { apikey: key },
        cache: 'no-store',
        redirect: 'error',
      });

      if (!response.ok) {
        return reply({
          error: `تعذّرت قراءة السلوك والملاحظات (${response.status}).`,
        }, 502);
      }

      const batch = await response.json();

      if (!Array.isArray(batch)) {
        return reply({ error: 'الرد المستلم غير صالح.' }, 502);
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
      !Array.isArray(input.entries) ||
      !input.entries.length ||
      input.entries.length > 250) {
    return reply({ error: 'بيانات السلوك غير صالحة.' }, 400);
  }

  const limits = { positive: 200, negative: 200, notes: 500 };

  const invalid = input.entries.some(row =>
    !Number.isSafeInteger(row?.id) ||
    row.id <= 0 ||
    Object.entries(limits).some(([field, limit]) =>
      typeof row[field] !== 'string' ||
      row[field].length > limit
    )
  );

  if (invalid ||
      new Set(input.entries.map(row => row.id)).size !== input.entries.length) {
    return reply({ error: 'تحقق من بيانات الطلاب وطول الملاحظات.' }, 400);
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!base || !key) {
    return reply({ error: 'إعدادات Supabase غير مكتملة.' }, 503);
  }

  try {
    const url = new URL('/rest/v1/hanan_monthly_notes', base);

    url.searchParams.set('on_conflict', 'student_id,month_start');
    url.searchParams.set('select', 'student_id,positive,negative,notes');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      cache: 'no-store',
      redirect: 'error',
      body: JSON.stringify(input.entries.map(row => ({
        student_id: row.id,
        month_start: `${input.month}-01`,
        positive: row.positive.trim(),
        negative: row.negative.trim(),
        notes: row.notes.trim(),
      }))),
    });

    if (!response.ok) {
      return reply({
        error: `تعذّر حفظ السلوك والملاحظات (${response.status}).`,
      }, 502);
    }

    const rows = await response.json();

    return reply({ saved: rows.length, rows });
  } catch {
    return reply({ error: 'تعذّر الاتصال بـ Supabase.' }, 502);
  }
}