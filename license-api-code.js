// ============================================================
// /api/license 엔드포인트 - worker.js에 추가
// wrangler.toml에 KV binding 필요: [[kv_namespaces]]
//   binding = "LICENSES"
//   id = "28c4aa3717734fd3991bb767c1d4c090"
// ============================================================

// POST /api/license
// body: { action: "activate"|"verify"|"admin-create", key, machineId, appVersion }

async function handleLicense(request, env) {
  const body = await request.json();
  const { action, key, machineId, appVersion } = body;
  
  if (!key) return jsonResp({ success: false, message: "키가 필요합니다" });
  
  // 라이선스 데이터 조회
  const raw = await env.LICENSES.get(`license:${key}`);
  
  if (action === "admin-create") {
    // 관리자: 라이선스 생성
    const adminKey = body.adminKey;
    if (adminKey !== "MIRAE-ADMIN-2026") return jsonResp({ success: false, message: "관리자 인증 실패" });
    
    const license = {
      key,
      status: "unused",
      machineId: null,
      activatedAt: null,
      expiresAt: null,
      trialDays: body.trialDays || 30,
      maxDevices: body.maxDevices || 1,
      memo: body.memo || "",
      createdAt: new Date().toISOString()
    };
    await env.LICENSES.put(`license:${key}`, JSON.stringify(license));
    return jsonResp({ success: true, message: "라이선스 생성 완료", license });
  }
  
  if (!raw) return jsonResp({ success: false, message: "유효하지 않은 라이선스 키입니다" });
  
  const license = JSON.parse(raw);
  
  if (action === "activate") {
    // 이미 활성화된 경우
    if (license.status === "active") {
      // 같은 PC면 OK
      if (license.machineId === machineId) {
        // 만료 체크
        if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
          license.status = "expired";
          await env.LICENSES.put(`license:${key}`, JSON.stringify(license));
          return jsonResp({ success: false, message: `트라이얼이 만료되었습니다 (${license.trialDays}일). 정식 라이선스를 문의하세요. 📞 1600-0251` });
        }
        const remaining = Math.ceil((new Date(license.expiresAt) - new Date()) / (1000*60*60*24));
        return jsonResp({ success: true, message: `인증 완료! 남은 기간: ${remaining}일`, remaining });
      }
      // 다른 PC
      return jsonResp({ success: false, message: `이 키는 이미 다른 PC에 등록되어 있습니다. 1대의 PC에서만 사용 가능합니다.` });
    }
    
    if (license.status === "expired") {
      return jsonResp({ success: false, message: `트라이얼이 만료되었습니다. 정식 라이선스를 문의하세요. 📞 1600-0251` });
    }
    
    // 미사용 → 활성화
    license.status = "active";
    license.machineId = machineId;
    license.activatedAt = new Date().toISOString();
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + (license.trialDays || 30));
    license.expiresAt = expiresDate.toISOString();
    license.appVersion = appVersion;
    
    await env.LICENSES.put(`license:${key}`, JSON.stringify(license));
    return jsonResp({ success: true, message: `인증 완료! ${license.trialDays}일 트라이얼이 시작되었습니다.`, remaining: license.trialDays });
  }
  
  if (action === "verify") {
    if (license.status !== "active") {
      return jsonResp({ success: false, message: "비활성 라이선스입니다", status: license.status });
    }
    if (license.machineId !== machineId) {
      return jsonResp({ success: false, message: "다른 PC에 등록된 키입니다" });
    }
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      license.status = "expired";
      await env.LICENSES.put(`license:${key}`, JSON.stringify(license));
      return jsonResp({ success: false, message: "트라이얼 만료", status: "expired" });
    }
    const remaining = Math.ceil((new Date(license.expiresAt) - new Date()) / (1000*60*60*24));
    return jsonResp({ success: true, remaining, message: `남은 기간: ${remaining}일` });
  }
  
  return jsonResp({ success: false, message: "알 수 없는 action" });
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

// === worker.js의 fetch handler에 추가할 라우트 ===
// if (url.pathname === "/api/license" && request.method === "POST") {
//   return handleLicense(request, env);
// }
