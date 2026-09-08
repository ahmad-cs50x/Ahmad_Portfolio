#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
// Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valParts] = trimmed.split('=');
      const val = valParts.join('=').trim();
      if (key && val) {
        process.env[key] = val;
      }
    }
  });
}

/**
 * Cleanup script — deletes ALL user data from the database.
 *
 * This includes all tables: profiles, invites, messages, message_attachments,
 * files, notifications, clients, and NextAuth tables (users, accounts, sessions, verification_tokens).
 *
 * It uses the Supabase admin client from lib/db.js, so it must be run inside the project.
 *
 * WARNING: This is irreversible. All data will be permanently deleted.
 */

const { getSupabaseAdmin, isDbConfigured } = require('../lib/db');

async function cleanup() {
  console.log('🔴 Starting full database cleanup...');

  if (!isDbConfigured()) {
    console.error('❌ Database not configured. Check environment variables.');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error('❌ Failed to get Supabase admin client.');
    process.exit(1);
  }

  // List of tables in order of deletion (children first to avoid FK violations)
  const tables = [
    'message_attachments',
    'messages',
    'files',
    'notifications',
    'invites',
    'profiles',
    'clients',
    // NextAuth tables
    'sessions',
    'accounts',
    'verification_tokens',
    'users',
  ];

  for (const table of tables) {
    try {
      console.log(`🗑️  Deleting from ${table}...`);
      const { error } = await sb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
      if (error) {
        // If table doesn't exist, ignore
        if (error.code === '42P01') {
          console.log(`⚠️  Table ${table} does not exist, skipping.`);
        } else {
          console.error(`❌ Error deleting from ${table}:`, error.message);
        }
      } else {
        console.log(`✅ Deleted from ${table}.`);
      }
    } catch (err) {
      console.error(`❌ Unexpected error on ${table}:`, err.message);
    }
  }

  console.log('✅ Cleanup complete.');
}

cleanup().catch(err => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});