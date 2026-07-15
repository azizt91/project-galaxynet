import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://etqsiqogeewgyxvyncje.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cXNpcW9nZWV3Z3l4dnluY2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNjA5NjMsImV4cCI6MjA5OTYzNjk2M30.7e62ALiUwO-xJWh0gj0YQEL8k-y9KgPGxikZ_MPfLeY';

export const supabase = createClient(supabaseUrl, supabaseKey);


