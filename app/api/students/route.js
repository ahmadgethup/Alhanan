function reply(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request) {
  if (process.env.NODE_ENV !== 'development') {
    return reply({ error: 'إدارة الطلاب متاحة في وضع التطوير المحلي.' }, 404);
  }

  const contentType = request.headers.get('content-type')?.split(';')[0].trim();
  if (contentType !== 'application/json') {
    return reply({ error: 'صيغة الطلب غير مدعومة.' }, 415);
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key?.startsWith('sb_secret_')) {
    return reply({ error: 'تحقق من إعدادات Supabase في .env.local.' }, 503);
  }

  const input = await request.json().catch(() => null);
  const fields = ['full_name', 'grade', 'section', 'enrollment_status'];

  if (
    !input ||
    !fields.every(field => typeof input[field] === 'string') ||
    (input.id !== null && (!Number.isSafeInteger(input.id) || input.id < 1))
  ) {
    return reply({ error: 'بيانات الطالب غير صالحة.' }, 400);
  }

  const [name, grade, section, status] = fields.map(field => input[field].trim());

  if (!name || !grade || !section ||
      name.length > 160 || grade.length > 80 ||
      section.length > 20 || status.length > 60) {
    return reply({ error: 'تحقق من الاسم والصف والشعبة والحالة.' }, 400);
  }

  try {
    const response = await fetch(new URL('/rest/v1/rpc/hanan_save_student', base), {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_id: input.id,
        p_name: name,
        p_grade: grade,
        p_section: section,
        p_status: status || null,
      }),
    });

    if (!response.ok) {
      const details = await response.json().catch(() => null);
      if (details?.code === 'P0002') {
        return reply({ error: 'الطالب غير موجود. حدّث القائمة.' }, 404);
      }
      return reply({ error: `تعذّر الحفظ في Supabase (${response.status}).` }, 502);
    }

    return reply({ id: await response.json() });
  } catch {
    return reply({ error: 'تعذّر الاتصال بـ Supabase.' }, 502);
  }
}