/* Public configuration. These keys are designed to be public:
   - Supabase publishable key: only grants what Row Level Security allows.
   - Clerk publishable key: identifies the Fight Hub sign-in; it cannot act as anyone.
   NEVER put a secret key (Clerk secret, Stripe secret, Supabase service role,
   ElevenLabs) in this file: those live in Vercel's environment variables. */
window.FIGHTHUB_CONFIG = {
  supabaseUrl: 'https://ewfuhrlgdivwtdremkdv.supabase.co',
  // Public half of the notification key (the private half is in Vercel only)
  vapidPublicKey: 'BEkxGGoDTa0zdT57y19JIO3oC4QwSITWiMARadiyWeujrLPelOKc5dt9LZJz8Bf4pLOZrJ3HbJ4nCOlJK39oPWI',
  supabaseAnonKey: 'sb_publishable_j9JDQxPwdCHhrw93Wn3j-Q_BKVpTCk1',
  // Live sign-in on fighthub.world; the test sign-in everywhere else (preview
  // versions and local testing), which matches the keys Vercel gives those versions
  clerkPublishableKey: /(^|\.)fighthub\.world$/.test(location.hostname)
    ? 'pk_live_Y2xlcmsuZmlnaHRodWIud29ybGQk'
    : 'pk_test_YW11c2VkLWFuY2hvdnktMjcyMC5jbGVyay5hY2NvdW50cy5kZXYk'
};
