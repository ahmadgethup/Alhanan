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
  const id = input?.id;

  if (!Number.isSafeInteger(id) || id <= 0) {
    return reply({
      error: 'رقم الطالب غير صالح.',
    }, 400);
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
      '/rest/v1/rpc/hanan_delete_student',
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
      }),
    });

    if (!response.ok) {
      return reply({
        error:
          `تعذّر حذف الطالب (${response.status}). ` +
          'لم يكتمل الحذف. تحقق من وجود الدالة hanan_delete_student.',
      }, 502);
    }

    const deletedId = await response.json();

    if (deletedId === null) {
      return reply({
        error: 'الطالب غير موجود. أعد تحميل قائمة الطلاب.',
      }, 404);
    }

    return reply({
      deleted: true,
      id,
    });
  } catch {
    return reply({
      error:
        'تعذّر التحقق من نتيجة الحذف بسبب الاتصال. ' +
        'أعد تحميل القائمة قبل المحاولة مجدداً.',
    }, 502);
  }
}