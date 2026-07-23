// Passive Loon capture helper. It never rewrites the app request or response.
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
      $persistentStore.write(String(value), key);
    } catch (_) {}
  }

  function values(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }

  function header(headers, name) {
    if (!headers || typeof headers !== 'object') return '';
    var wanted = name.toLowerCase();
    for (var key in headers) {
      if (key.toLowerCase() === wanted) return headers[key];
    }
    return '';
  }

  function addCookie(map, part) {
    var match = String(part || '').trim().match(/^([^=;\s]+)\s*=\s*([^;\s]*)/);
    if (!match) return;
    var name = match[1];
    if (/^(path|domain|expires|max-age|secure|httponly|samesite|priority)$/i.test(name)) return;
    map[name] = match[2];
  }

  function parseCookie(value, setCookie) {
    var map = {};
    values(value).forEach(function (item) {
      var text = String(item || '').replace(/[\r\n]+/g, '\n');
      if (setCookie) {
        // Split only at commas that begin another cookie, keeping Expires dates intact.
        text.split(/,(?=\s*[^=;,\s]+\s*=)/).forEach(function (cookie) {
          addCookie(map, cookie);
        });
      } else {
        text.split(/[;\n]/).forEach(function (cookie) {
          addCookie(map, cookie);
        });
      }
    });
    return map;
  }

  function mergeCookie(oldValue, newValue) {
    var map = parseCookie(oldValue, false);
    var fresh = parseCookie(newValue, false);
    Object.keys(fresh).forEach(function (key) {
      map[key] = fresh[key];
    });
    return Object.keys(map).map(function (key) {
      return key + '=' + map[key];
    }).join('; ');
  }

  function responseCookie(response) {
    if (!response) return '';
    var headers = response.headers || {};
    var map = {};
    [header(headers, 'set-cookie'), header(headers, 'set-cookie2')].forEach(function (value) {
      var parsed = parseCookie(value, true);
      Object.keys(parsed).forEach(function (key) { map[key] = parsed[key]; });
    });
    var cookie = header(headers, 'cookie');
    var requestCookies = parseCookie(cookie, false);
    Object.keys(requestCookies).forEach(function (key) {
      if (!(key in map)) map[key] = requestCookies[key];
    });
    var location = header(headers, 'location');
    String(location || '').replace(/[?&#]JSESSIONID=([^;&#,]+)/i, function (_, value) {
      map.JSESSIONID = value;
      return _;
    });
    var body = typeof response.body === 'string' ? response.body : '';
    body.replace(/JSESSIONID(?:%3D|=)([^%;&",\s]+)/ig, function (_, value) {
      map.JSESSIONID = value;
      return _;
    });
    return Object.keys(map).map(function (key) {
      return key + '=' + map[key];
    }).join('; ');
  }

  function requestCookie(request) {
    if (!request) return '';
    var headers = request.headers || {};
    var cookie = header(headers, 'cookie');
    var setCookie = header(headers, 'set-cookie');
    var map = parseCookie(cookie, false);
    var fresh = parseCookie(setCookie, true);
    Object.keys(fresh).forEach(function (key) { map[key] = fresh[key]; });
    return Object.keys(map).map(function (key) {
      return key + '=' + map[key];
    }).join('; ');
  }

  function requestParams(request) {
    if (!request || !request.url) return;
    var xqen = String(header(request.headers || {}, 'x-qen') || '').trim();
    if (!/^(2|12|14)$/.test(xqen)) return;
    if (!/autologin/i.test(request.url)) return;
    var body = request.body;
    if (body == null || body === '') return;
    if (typeof body !== 'string') {
      try { body = JSON.stringify(body); } catch (_) { return; }
    }
    write(PARAMS_KEY, body);
    write(URL_KEY, request.url);
    write(QEN_KEY, xqen);
    console.log('✅ 数据捕获成功');
  }

  try {
    if (typeof $response !== 'undefined' && $response) {
      var responseValue = responseCookie($response);
      if (responseValue) {
        write(COOKIE_KEY, mergeCookie(read(COOKIE_KEY), responseValue));
        console.log('✅ Cookie捕获成功');
      }
    } else if (typeof $request !== 'undefined' && $request) {
      var requestValue = requestCookie($request);
      if (requestValue) {
        write(COOKIE_KEY, mergeCookie(read(COOKIE_KEY), requestValue));
        console.log('✅ Cookie捕获成功');
      }
      requestParams($request);
    }
  } catch (error) {
    console.log('⚠️ 捕获异常，已原样放行: ' + String(error && error.message || error));
  } finally {
    $done();
  }
}());
