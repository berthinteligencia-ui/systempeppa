const https = require('https');

const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwZmE1MDQ0OS03NTA2LTRmYmYtYjliMS03NjI0YjA2YzI3Y2UiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0NzQ5ODE0fQ.9SEa7PnYQtAugQYifO6KrD1hFmUFoaQME3AD7JCdHQY";
const N8N_HOST = "https://teste.berthia.com.br";

function request(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Authorization': `Bearer ${API_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ data, status: res.statusCode }));
    }).on('error', reject);
  });
}

async function run() {
  try {
    const res = await request(`${N8N_HOST}/api/v1/workflows`);
    console.log('STATUS:', res.status);
    console.log('DATA:', res.data);
  } catch (err) {
    console.error('ERROR:', err);
  }
}

run();
