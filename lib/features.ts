/**
 * Features that are built but switched off until their paid service is set up.
 *
 * PHONE_OTP — SMS code before a phone number is saved. Needs an SMS provider (Twilio, Vonage…)
 * enabled under Supabase → Authentication → Providers → Phone. To turn it on:
 *   1. set NEXT_PUBLIC_PHONE_OTP_ENABLED=true in .env.local / the hosting environment
 *   2. in Supabase SQL: create or replace function public.phone_otp_required() returns boolean
 *      language sql immutable as $$ select true $$;
 */
export const PHONE_OTP_ENABLED = process.env.NEXT_PUBLIC_PHONE_OTP_ENABLED === "true"
