const https = require('https');

const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwZmE1MDQ0OS03NTA2LTRmYmYtYjliMS03NjI0YjA2YzI3Y2UiLCJpc3MiOiJuOG4iLCJhdWQiOiJtY3Atc2VydmVyLWFwaSIsImp0aSI6IjRkMWUwNGZhLTA5ZjYtNGI4MS1hMTUyLTJhNjhiMWUyYzg4NiIsImlhdCI6MTc3NDc0ODQzNn0.IYUZOaeuz-sb8p3GWMNuZPvaIf2nXnkgou53G8Pgamo";
const N8N_HOST = "https://teste.berthia.com.br";
const WORKFLOW_ID = "pdmhqgOmfuCGEJOZ";

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

async function inspect() {
  try {
    const detailed = await request(`${N8N_HOST}/api/v1/workflows/${WORKFLOW_ID}`, { 'X-N8N-API-KEY': API_KEY });
    console.log('Workflow Name:', detailed.name);
    
    const nodes = detailed.nodes || [];
    const webhookNode = nodes.find(n => n.type === 'n8n-nodes-base.webhook');
    if (webhookNode) {
      console.log('\nWebhook Node Found:');
      console.log(JSON.stringify(webhookNode, null, 2));
    }

    const supabaseNodes = nodes.filter(n => n.type.includes('supabase'));
    if (supabaseNodes.length > 0) {
      console.log('\nSupabase Nodes Found:');
      supabaseNodes.forEach(n => {
        console.log(`- ${n.name}: ${n.parameters.operation} ${n.parameters.table || ''}`);
        if (n.parameters.table === 'mensagens') {
           console.log('  WARNING: This node is using the wrong table name "mensagens"!');
        }
      });
    }

    const httpRequestNodes = nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest');
    if (httpRequestNodes.length > 0) {
      console.log('\nHTTP Request Nodes Found:');
      httpRequestNodes.forEach(n => {
        console.log(`- ${n.name}: ${n.parameters.url}`);
      });
    }

  } catch (err) {
    console.error('ERROR:', err);
  }
}

inspect();
