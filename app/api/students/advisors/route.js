function reply(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function connection() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!base || !key) return null;

  return {
    url: new URL('/rest/v1/hanan_class_advisors', base),
    headers: { apikey: key },
  };
}

export async function GET() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY
  ) {
    return reply({ error: 'إعدادات Supabase غير مكتملة.' }, 503);
  }

  try {
    const { url, headers } = connection();

    url.searchParams.set('select', 'grade,section,advisor_name');
    url.searchParams.set('order', 'grade.asc,section.asc');
    url.searchParams.set('limit', '100');

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
          error: `تعذّرت قراءة أسماء المرشدين (${response.status}).`,
        }, 502);
      }

      const batch = await response.json();

      if (!Array.isArray(batch)) {
        return reply({ error: 'بيانات المرشدين المستلمة غير صالحة.' }, 502);
      }

      rows.push(...batch);

      if (batch.length < 100) break;
    }

    return reply(rows);
  } catch {
    return reply({ error: 'تعذّر الاتصال بقاعدة البيانات.' }, 502);
  }
}

export async function POST(request) {
  if (
    request.headers.get('content-type')?.split(';')[0].trim() !==
    'application/json'
  ) {
    return reply({ error: 'صيغة الطلب غير مدعومة.' }, 415);
  }

  const input = await request.json().catch(() => null);

  if (
    !Array.isArray(input?.entries) ||
    !input.entries.length ||
    input.entries.length > 250
  ) {
    return reply({ error: 'بيانات المرشدين غير صالحة.' }, 400);
  }

  const entries = [];

  for (const row of input.entries) {
    if (
      typeof row?.grade !== 'string' ||
      typeof row.section !== 'string' ||
      typeof row.advisor_name !== 'string'
    ) {
      return reply({ error: 'تحقق من بيانات الصف والمرشد.' }, 400);
    }

    const entry = {
      grade: row.grade.trim(),
      section: row.section.trim(),
      advisor_name: row.advisor_name.trim(),
    };

    if (
      !entry.grade ||
      entry.grade.length > 80 ||
      !entry.section ||
      entry.section.length > 20 ||
      entry.advisor_name.length > 160
    ) {
      return reply({ error: 'تحقق من بيانات الصف وطول اسم المرشد.' }, 400);
    }

    entries.push(entry);
  }

  const keys = entries.map(row =>
    JSON.stringify([row.grade, row.section])
  );

  if (new Set(keys).size !== entries.length) {
    return reply({ error: 'يوجد صف وشعبة مكرران في الطلب.' }, 400);
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY
  ) {
    return reply({ error: 'إعدادات Supabase غير مكتملة.' }, 503);
  }

  try {
    const { url, headers } = connection();

    url.searchParams.set('on_conflict', 'grade,section');
    url.searchParams.set('select', 'grade,section,advisor_name');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      cache: 'no-store',
      redirect: 'error',
      body: JSON.stringify(entries),
    });

    if (!response.ok) {
      return reply({
        error: `تعذّر حفظ أسماء المرشدين (${response.status}).`,
      }, 502);
    }

    const rows = await response.json();

    if (!Array.isArray(rows)) {
      return reply({ error: 'تعذّر التحقق من نتيجة الحفظ.' }, 502);
    }

    return reply({ saved: rows.length, rows });
  } catch {
    return reply({ error: 'تعذّر الاتصال بقاعدة البيانات.' }, 502);
  }
}