import { NextResponse } from 'next/server';

const cookieName = 'hanan_computer_session';
const sessionSeconds = 4 * 60 * 60;
const encoder = new TextEncoder();

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const bytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
  );

  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function equal(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;

  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

function loginPage(failed = false) {
  return new NextResponse(`<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>دخول قسم الحاسبات</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        padding: 20px; background: #f3f7f4; color: #172820;
        font: 16px/1.65 Tahoma, Arial, sans-serif;
      }
      main {
        width: min(100%, 410px); padding: 28px; background: #fff;
        border: 1px solid #dce7df; border-radius: 18px;
        box-shadow: 0 12px 36px #17282012;
      }
      h1 { margin: 10px 0; font-size: 25px; }
      label { display: block; margin-top: 18px; }
      input, button {
        width: 100%; min-height: 44px; margin-top: 8px; padding: 8px 12px;
        border: 1px solid #cad9cf; border-radius: 9px; font: inherit;
      }
      button { background: #205e46; color: #fff; cursor: pointer; }
      a { display: inline-block; margin-top: 14px; color: #205e46; }
      [role="alert"] { color: #914717; }
    </style>
  </head>
  <body>
    <main>
      <img src="/hanan-logo.png" width="58" height="47" alt="مدرسة حنان الأهلية">
      <h1>دخول قسم الحاسبات</h1>
      ${failed ? '<p role="alert">كلمة المرور غير صحيحة.</p>' : ''}
      <form action="/computer" method="post">
        <label for="password">كلمة المرور</label>
        <input id="password" name="password" type="password"
          autocomplete="current-password" maxlength="256" required autofocus>
        <button type="submit">دخول</button>
      </form>
      <a href="/">العودة إلى حنان</a>
    </main>
  </body>
</html>`, {
    status: failed ? 401 : 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function middleware(request) {
  const password = process.env.COMPUTER_PASSWORD;
  const secret = process.env.COMPUTER_SESSION_SECRET;
  const { pathname, protocol } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const now = Math.floor(Date.now() / 1000);

  if (!password || !secret || secret.length < 32) {
    return new NextResponse('إعدادات دخول قسم الحاسبات ناقصة في .env.local.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (pathname === '/computer' && request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const supplied = form?.get('password');

    if (
      typeof supplied !== 'string' ||
      supplied.length > 256 ||
      !equal(await sign(supplied, secret), await sign(password, secret))
    ) {
      return loginPage(true);
    }

    const expires = String(now + sessionSeconds);
    const signature = await sign(`session:${expires}:${password}`, secret);
    const response = NextResponse.redirect(new URL('/computer', request.url), 303);

    response.cookies.set(cookieName, `${expires}.${signature}`, {
      httpOnly: true,
      sameSite: 'strict',
      secure: protocol === 'https:',
      path: '/',
      maxAge: sessionSeconds,
    });

    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
   if (pathname === '/computer/logout' && request.method === 'POST') {
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.delete(cookieName);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

if (
  pathname === '/computer' &&
  request.method === 'GET' &&
  request.nextUrl.searchParams.get('unlock') === '1'
) {
  const response = loginPage();
  response.cookies.delete(cookieName);
  return response;
}
  const token = request.cookies.get(cookieName)?.value ?? '';
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(token);

  if (
    match &&
    Number(match[1]) > now &&
    equal(match[2], await sign(`session:${match[1]}:${password}`, secret))
  ) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }

  if (isApi) {
    return NextResponse.json(
      { error: 'سجّل الدخول إلى قسم الحاسبات أولاً.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return loginPage();
}

export const config = {
  matcher: ['/computer/:path*', '/api/students/:path*'],
};