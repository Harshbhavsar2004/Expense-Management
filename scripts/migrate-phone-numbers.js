#!/usr/bin/env node

/**
 * Phone Number Migration Script
 *
 * This script runs the phone number normalization and user ID linking migration
 * for applications and expenses submitted via WhatsApp/Cliq.
 *
 * Usage:
 *   npm run migrate:phones
 *   or
 *   node scripts/migrate-phone-numbers.js
 *
 * Environment Variables Required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables (Next.js style)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runMigration() {
  console.log('🚀 Starting Phone Number Migration...\n');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    console.log('\n📋 Manual Migration Instructions:');
    console.log('1. Go to your Supabase Dashboard → SQL Editor');
    console.log('2. Copy and paste the contents of supabase_phone_migration.sql');
    console.log('3. Click "Run" to execute the migration');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    console.log('⚠️  Complex SQL migrations need to be run manually in Supabase SQL Editor.');
    console.log('📋 Please follow these steps:\n');

    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of supabase_phone_migration.sql');
    console.log('4. Click "Run" to execute the migration\n');

    console.log('🔍 After running the migration, you can verify results with:');
    console.log('   npm run verify:migration\n');

    // Try to run a simple test query to verify connection
    console.log('🔗 Testing Supabase connection...');
    const { data, error } = await supabase
      .from('users')
      .select('count(*)')
      .limit(1);

    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
    } else {
      console.log('✅ Supabase connection successful');
    }

  } catch (error) {
    console.error('❌ Migration setup failed:', error.message);
  }
}

// Verification script
async function verifyMigration() {
  console.log('🔍 Verifying Phone Number Migration Results...\n');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Check applications with null user_id
    const { data: apps, error: appsError } = await supabase
      .from('applications')
      .select('id, user_id, user_phone')
      .is('user_id', null);

    if (!appsError) {
      console.log(`📱 Applications with null user_id: ${apps.length}`);
      if (apps.length > 0) {
        console.log('   Sample records:');
        apps.slice(0, 3).forEach(app => {
          console.log(`   - ID: ${app.id}, Phone: ${app.user_phone}`);
        });
      }
    }

    // Check expenses with null user_id
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('id, user_id, user_phone')
      .is('user_id', null);

    if (!expError) {
      console.log(`💰 Expenses with null user_id: ${expenses.length}`);
      if (expenses.length > 0) {
        console.log('   Sample records:');
        expenses.slice(0, 3).forEach(exp => {
          console.log(`   - ID: ${exp.id}, Phone: ${exp.user_phone}`);
        });
      }
    }

    // Show total counts
    const { count: totalApps } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true });

    const { count: totalExpenses } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 Total Records:`);
    console.log(`   Applications: ${totalApps}`);
    console.log(`   Expenses: ${totalExpenses}`);

    if (apps.length === 0 && expenses.length === 0) {
      console.log('\n✅ Migration successful! All records are linked to users.');
    } else {
      console.log(`\n⚠️  Migration incomplete. ${apps.length + expenses.length} records still need user linking.`);
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

// Main execution
if (process.argv[2] === 'verify') {
  verifyMigration();
} else {
  runMigration();
}