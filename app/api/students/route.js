function reply(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function POST(request) {
  const contentType = request.headers
    .get('content-type')
    ?.split(';')[0]
    .trim();

  if (contentType !== 'application/json') {
    return reply({
      error: 'صيغة الطلب غير مدعومة.',
    }, 415);
  }

  const input = await request.json().catch(() => null);

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return reply({
      error: 'بيانات الطالب غير صالحة.',
    }, 400);
  }

  const id = input.id ?? null;

  if (
    id !== null &&
    (!Number.isSafeInteger(id) || id <= 0)
  ) {
    return reply({
      error: 'رقم الطالب غير صالح.',
    }, 400);
  }

  const fields = [
    ['full_name', 160, true],
    ['grade', 80, true],
    ['section', 20, true],
    ['enrollment_status', 60, false],
  ];

  const student = {};

  for (const [field, maxLength, required] of fields) {
    const value = input[field] ?? '';

    if (typeof value !== 'string') {
      return reply({
        error: 'تحقق من بيانات الطالب.',
      }, 400);
    }

    const trimmed = value.trim();

    if (
      (required && !trimmed) ||
      trimmed.length > maxLength
    ) {
      return reply({
        error: 'أكمل اسم الطالب والصف والشعبة، وتحقق من طول البيانات.',
      }, 400);
    }

    student[field] = trimmed;
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!base || !key) {
    return reply({
      error: 'إعدادات Supabase غير مكتملة على الخادم.',
    }, 503);
  }

  try {
    const url = new URL(
      '/rest/v1/rpc/hanan_save_student',
      base
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      redirect: 'error',
      body: JSON.stringify({
        p_id: id,
        p_name: student.full_name,
        p_grade: student.grade,
        p_section: student.section,
        p_status: student.enrollment_status || null,
      }),
    });

    if (!response.ok) {
      return reply({
        error:
          `تعذّر حفظ الطالب في Supabase (${response.status}). ` +
          'تحقق من وجود الدالة hanan_save_student وصلاحية مفتاح الخادم.',
      }, 502);
    }

    return reply({
      saved: true,
      message: id === null
        ? 'تمت إضافة الطالب.'
        : 'تم تعديل بيانات الطالب.',
    });
  } catch {
    return reply({
      error: 'تعذّر الاتصال بـ Supabase. حاول مرة ثانية.',
    }, 502);
  }
}