# 우리 반 기피 자리 조사

27명이 가장 앉기 싫은 자리부터 1~27순위를 정하고, 모든 응답을 Google Sheets에 저장해 기피 자리 순위를 보여 주는 정적 웹페이지입니다.

## 조사 방법

1. 학생 번호를 고릅니다.
2. 가장 앉기 싫은 자리를 1순위로 시작해 27개 책상을 모두 누릅니다.
3. `Google Sheets에 저장`을 누릅니다.
4. 결과 화면에서 응답 현황과 기피 자리 추천을 확인합니다.

같은 학생 번호로 다시 제출하면 기존 행을 수정합니다. 이름이나 이메일은 수집하지 않습니다.

## Google Sheets / Apps Script

- 응답 시트: `우리 반 앉기 싫은 자리 조사 응답`
- 시트 탭: `응답`, `안내`
- Apps Script 소스: `apps-script/Code.gs`
- 배포 설정: 실행 사용자 `나`, 액세스 사용자 `모든 사용자`
- 배포 뒤 받은 `/exec` 주소를 `config.js`의 `appsScriptUrl`에 넣습니다.

Apps Script 웹 앱은 `ping`, `results`, `submit` 요청을 처리합니다. 학생 번호별로 한 행만 유지하며, 동시에 제출해도 행이 충돌하지 않도록 스크립트 잠금을 사용합니다.

## GitHub Pages

저장소의 `Settings → Pages`에서 `Deploy from a branch`, `main`, `/root`를 선택하면 게시할 수 있습니다.
