// Cache China Mobile online-service responses without touching App traffic.
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

  function responseKind(url) {
    if (/\/i\/(?:gray\/)?v1\/fee\/real\//i.test(url)) return 'fee';
    if (/\/i\/(?:gray\/)?v1\/fee\/planbal\//i.test(url)) return 'plan';
    return '';
  }

  function validBusinessResponse(body, kind) {
    var payload;
    try {
      payload = JSON.parse(body);
    } catch (_) {
      console.log('⚠️ 网上营业厅返回了非JSON数据，未更新缓存');
      return false;
    }

    if (payload && payload.retCode != null && Number(payload.retCode) !== 0) {
      var message = payload.retMsg || payload.message || '未知错误';
      if (String(payload.retCode) === '500003') {
        console.log('⚠️ 网上营业厅尚未登录，请在Safari完成短信登录');
      } else {
        console.log('⚠️ 业务请求失败，未更新缓存: ' + payload.retCode + ' ' + message);
      }
      return false;
    }

    if (!payload || payload.data == null) {
      console.log('⚠️ 网上营业厅响应中没有业务数据，未更新缓存');
      return false;
    }
    if (kind === 'plan' && Array.isArray(payload.data) && payload.data.length === 0) {
      console.log('⚠️ 套餐余量为空，未更新缓存');
      return false;
    }
    return true;
  }

  function capture() {
    if (typeof $request === 'undefined' || !$request ||
        typeof $response === 'undefined' || !$response) return;

    var url = String($request.url || '');
    var kind = responseKind(url);
    if (!kind) return;

    var body = $response.body;
    if (body == null || body === '') {
      console.log('⚠️ 网上营业厅业务响应为空，未更新本地缓存');
      return;
    }
    if (typeof body !== 'string') {
      try {
        body = String(body);
      } catch (_) {
        console.log('⚠️ 网上营业厅业务响应无法读取，未更新本地缓存');
        return;
      }
    }

    var status = Number($response.statusCode || $response.status || 0);
    if (status && (status < 200 || status >= 300)) {
      console.log('⚠️ 网页业务请求失败，未更新本地缓存: HTTP ' + status);
      return;
    }
    if (/^\s*</.test(body)) {
      console.log('⚠️ 网页会话未登录，未更新本地缓存');
      return;
    }
    if (!validBusinessResponse(body, kind)) return;

    var cache = {
      body: body,
      status: status,
      capturedAt: Date.now(),
      url: url,
      source: 'shop'
    };
    var key = kind === 'fee' ? FEE_CACHE_KEY : PLAN_CACHE_KEY;
    if (write(key, JSON.stringify(cache))) {
      console.log(kind === 'fee'
        ? '✅ 网页话费数据缓存成功'
        : '✅ 网页套餐数据缓存成功');
    } else {
      console.log('⚠️ 网页业务数据写入缓存失败');
    }
  }

  try {
    capture();
  } catch (error) {
    console.log('⚠️ 网页缓存异常，已原样放行: ' + String(error && error.message || error));
  } finally {
    $done({});
  }
}());
