
import { createClient } from '@supabase/supabase-js';

// --- CONNECTION CONFIGURATION ---

// Hardcoded Supabase URL and Key as per the request.
const finalUrl = "https://pljofwyhlshlkuanewsv.supabase.co";
const finalKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsam9md3lobHNobGt1YW5ld3N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNTUwODYsImV4cCI6MjA4MDkzMTA4Nn0.TImM5AaZpHi3TgLb34xthcSeonA13aUHM6yK9mi7Qtg";

// Validation helper
export const isSupabaseConfigured = !!(
  finalUrl && 
  finalKey && 
  finalUrl.startsWith('http') && 
  finalKey.length > 20
);

if (!isSupabaseConfigured) {
  // This block will now likely not be hit unless the hardcoded values are invalid.
  if (typeof window !== 'undefined') {
    console.warn("Supabase configuration is invalid. Application may not function correctly.");
  }
} else {
  if (typeof window !== 'undefined') {
    console.log("Supabase connection initialized with hardcoded credentials.");
  }
}

export const supabase = createClient(finalUrl, finalKey);
