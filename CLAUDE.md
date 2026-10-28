# 우리 반 오르골 — 작업 안내 (짧게 유지)

유리돔 3D 오르골(사진 1장 교체, 파헬벨 캐논 등 저작권 걱정 없는 곡, 테마, 확대 레일). 정적 파일 `index.html`+`app.js`+`lib/three.min.js`(r128). 빌드 도구 없음.
`CODEX_PROMPT.md`는 앨범(사진 여러 장) 확장을 다른 AI에게 맡기는 프롬프트. 사용법은 `README.md`.

## 규칙
- **학생 사진은 저장소에 올리지 않는다**(`.gitignore`가 막음). 사진은 브라우저(IndexedDB)에만 저장된다.
- 한 파일로 내보낼 때: `python3 scripts/build_single.py` → `dist/우리반오르골.html`. 맨 위 `<!DOCTYPE html>`과 `<head>` 앞쪽 `<meta charset="UTF-8">`가 없으면 스크립트가 멈춘다.
  - 이유(2026-10): charset 없는 html을 캔바에 올리면 CP949로 읽혀 한글이 깨졌다. Claude 아티팩트 형식(doctype·head 없음)을 독립 파일로 주지 않는다.
- 사용자(교사)가 복사할 파일은 전체를 첨부로 주고, 클라우드 경로(`/home/user/...`)는 PC에 없음을 말해 준다.
- 커밋 메시지는 한국어, 한 줄에 «·»로 변경점을 잇는다.
- 티처플립(`angelboy30313-source/teacher-filp`)에 예시로 올릴 때는 위 단일 파일을 쓴다.
