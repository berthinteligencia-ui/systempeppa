const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('Employee')
    .select('id, name, pagamento')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Data:', data);
    
    // Check columns
    const { data: cols, error: colsErr } = await supabase
      .rpc('get_table_columns', { table_name: 'Employee' });
    
    if (colsErr) {
      // Fallback: try to update and see if it fails
      console.log('RPC get_table_columns failed, trying test update...');
      if (data && data.length > 0) {
        const testId = data[0].id;
        const currentPag = data[0].pagamento;
        const { error: updErr } = await supabase
          .from('Employee')
          .update({ pagamento: currentPag })
          .eq('id', testId);
        
        if (updErr) {
          console.error('Update test failed:', updErr);
        } else {
          console.log('Update test succeeded!');
        }
      }
    } else {
      console.log('Columns:', cols);
    }
  }
}

test();
