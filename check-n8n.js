const https = require('https');

const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwZmE1MDQ0OS03NTA2LTRmYmYtYjliMS03NjI0YjA2YzI3Y2UiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0NzQ5ODE0fQ.9SEa7PnYQtAugQYifO6KrD1hFmUFoaQME3AD7JCdHQY";
const N8N_HOST = "https://teste.berthia.com.br";

function request(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) reject(json);
          else resolve(json);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function listWorkflows() {
  try {
    const response = await request(`${N8N_HOST}/api/v1/workflows`, { 'X-N8N-API-KEY': API_KEY });
    console.log('Workflows:');
    response.data.forEach(wf => {
      console.log(`- [${wf.id}] ${wf.name} (Active: ${wf.active})`);
    });

    const target = response.data.find(wf => wf.name.toLowerCase().includes('folha') && wf.name.toLowerCase().includes('zap'));
    if (target) {
      console.log('\nTarget Workflow Found:', target.id);
      const detailed = await request(`${N8N_HOST}/api/v1/workflows/${target.id}`, { 'X-N8N-API-KEY': API_KEY });
      console.log('\nDetailed Workflow:', JSON.stringify(detailed, null, 2));
    } else {
      console.log('\nTarget Workflow "folhadepagamento zap" not found.');
    }
  } catch (err) {
    console.error('ERROR:', err);
  }
}

listWorkflows();
