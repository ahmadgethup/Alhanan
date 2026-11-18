export async function GET() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const schoolApiEnabled = process.env.ENABLE_SCHOOL_API === 'true';

  if (!isDevelopment && !schoolApiEnabled) {
    return Response.json(
      { error: 'عرض قائمة الطلاب غير مفعّل في بيئة النشر.' },
      { status: 404 },
    );
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!base || !key?.startsWith('sb_secret_')) {
    return Response.json(
      { error: 'تحقق من متغيرات بيئة Supabase على الخادم.' },
      { status: 503 },
    );
  }

  try {
    const url = new URL('/rest/v1/hanan_students', base);
    url.searchParams.set('select', 'id,full_name,grade,section,enrollment_status');
    url.searchParams.set('order', 'source_page.asc,roster_number.asc,id.asc');

    const batchSize = 100;
    const students = [];
    url.searchParams.set('limit', String(batchSize));

    for (let offset = 0; ; offset += batchSize) {
      url.searchParams.set('offset', String(offset));

      const response = await fetch(url, {
        headers: { apikey: key },
        cache: 'no-store',
        redirect: 'error',
      });

      if (!response.ok) {
        return Response.json(
          { error: `تعذّرت قراءة الطلاب من Supabase (${response.status}).` },
          { status: 502 },
        );
      }

      const batch = await response.json();
      students.push(...batch);

      if (batch.length < batchSize) break;
    }

    return Response.json(students, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return Response.json(
      { error: 'تعذّر الاتصال بـ Supabase.' },
      { status: 502 },
    );
  }
}