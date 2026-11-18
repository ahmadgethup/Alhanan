export async function GET() {
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
    const batchSize = 100;
    const students = [];

    url.searchParams.set(
      'select',
      'id,full_name,grade,section,enrollment_status',
    );
    url.searchParams.set('order', 'source_page.asc,roster_number.asc,id.asc');
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