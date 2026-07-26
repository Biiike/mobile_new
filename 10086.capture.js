// Passive Loon request capture helper. Every matched request is passed through unchanged.
(function () {
  var COOKIE_KEY = 'china_mobile_cookie';
  var PARAMS_KEY = 'china_mobile_params';
  var URL_KEY = 'china_mobile_url';
  var QEN_KEY = 'china_mobile_x_qen';

  function read(key) {
    try {
      return $persistentStore.read(key) || '';
    } catch (_) {
      return '';
    }
  }

  function write(key, value) {
    try {
      return $persistentStore.write(String(value), key);
    } catch (_) {
      return false;
    }
  }

  function header(headers, name) {
    if (!headers || typeof headers !== 'object') return '';
    var wanted = name.toLowerCase();
    for (var key in headers) {
      if (key.toLowerCase() === wanted) return headers[key];
    }
    return '';
  }

  function sessionId(request) {
    if (!request) return '';
    var cookie = String(header(request.headers || {}, 'cookie') || '');
    var match = cookie.match(/(?:^|;\s*)JSESSIONID\s*=\s*"?([^;"\s]+)/i);
    if (match && match[1]) return match[1];

    var url = String(request.url || '');
    match = url.match(/[?&#;]JSESSIONID=([^;&#\s]+)/i);
    if (!match || !match[1]) return '';
    try {
      return decodeURIComponent(match[1]);
    } catch (_) {
      return match[1];
    }
  }

  function captureLoginParams(request) {
    if (!request || !/autologin/i.test(String(request.url || ''))) return false;
    var xqen = String(header(request.headers || {}, 'x-qen') || '').trim();
    if (!/^(2|12|14)$/.test(xqen)) {
      console.log('⚠️ 登录参数未保存：不支持的 x-qen=' + (xqen || '空'));
      return true;
    }

    var body = request.body;
    if (body == null || body === '') {
      console.log('⚠️ 登录参数未保存：请求正文为空');
      return true;
    }
    if (typeof body !== 'string') {
      try {
        body = JSON.stringify(body);
      } catch (_) {
        console.log('⚠️ 登录参数未保存：无法读取请求正文');
        return true;
      }
    }

    write(PARAMS_KEY, body);
    write(URL_KEY, request.url);
    write(QEN_KEY, xqen);
    console.log('✅ 登录参数捕获成功，请等待业务Cookie捕获成功');
    return true;
  }

  function captureBusinessCookie(request) {
    var value = sessionId(request);
    if (!value) return;

    // Only the authenticated session is needed. Replacing the old value avoids
    // mixing an anonymous login cookie with the App's working business session.
    var cookie = 'JSESSIONID=' + value;
    if (read(COOKIE_KEY) !== cookie) {
      write(COOKIE_KEY, cookie);
      console.log('✅ 业务Cookie捕获成功（JSESSIONID）');
    }
  }

  try {
    if (typeof $request === 'undefined' || !$request) {
      console.log('⚠️ 捕获脚本未收到请求对象');
    } else if (!captureLoginParams($request)) {
      captureBusinessCookie($request);
    }
  } catch (error) {
    console.log('⚠️ 捕获异常，已原样放行: ' + String(error && error.message || error));
  } finally {
    $done({});
  }
}());
