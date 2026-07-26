// Cache China Mobile business responses without changing the App traffic.
(function () {
  var FEE_CACHE_KEY = 'china_mobile_fee_cache_v1';
  var PLAN_CACHE_KEY = 'china_mobile_plan_cache_v1';

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

  function responseKind(url) {
    if (/realFeeQuery\/getRealFee/i.test(url)) return 'fee';
    if (/newPlanRemainQry\/getNewPlanRemainQry/i.test(url)) return 'plan';
    return '';
  }

  function capture() {
    if (typeof $request === 'undefined' || !$request ||
        typeof $response === 'undefined' || !$response) return;

    var url = String($request.url || '');
    var kind = responseKind(url);
    if (!kind) return;

    var body = $response.body;
    if (body == null || body === '') {
      console.log('⚠️ App业务响应为空，未更新本地缓存');
      return;
    }
    if (typeof body !== 'string') {
      try {
        body = String(body);
      } catch (_) {
        console.log('⚠️ App业务响应无法读取，未更新本地缓存');
        return;
      }
    }

    var headers = $response.headers || {};
    var cache = {
      body: body,
      qen: String(header(headers, 'x-qen') || ''),
      retcode: String(header(headers, 'retcode') || ''),
      status: Number($response.statusCode || $response.status || 0),
      capturedAt: Date.now(),
      url: url
    };
    var key = kind === 'fee' ? FEE_CACHE_KEY : PLAN_CACHE_KEY;
    if (write(key, JSON.stringify(cache))) {
      console.log(kind === 'fee'
        ? '✅ App话费数据缓存成功'
        : '✅ App套餐数据缓存成功');
    } else {
      console.log('⚠️ App业务数据写入缓存失败');
    }
  }

  try {
    capture();
  } catch (error) {
    console.log('⚠️ 缓存异常，已原样放行: ' + String(error && error.message || error));
  } finally {
    $done({});
  }
}());
