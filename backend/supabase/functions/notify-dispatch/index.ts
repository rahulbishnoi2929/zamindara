// Ring the captains who have just been offered a job.
//
// Runs on Deno, deployed with:
//   cd backend && npx supabase functions deploy notify-dispatch
//
// Why a function rather than the app doing it: push tokens are the addresses
// notifications are delivered to, and a leaked set of them is a spam channel
// aimed at every captain in the district. They must never reach a client. So
// the caller only names a job; this verifies he owns it, then reads the
// tokens with the service role.
//
// Expo's push API is free and needs no key for this.
//
// ⚠️ Not covered by CI — it needs a deploy and a real device to prove. The
// token table and its policies are tested in 05_push_tokens; everything from
// here to the handset is verified by two phones in a yard, not by a suite.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

interface Body {
  jobId?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, 405);
  }

  const auth = req.headers.get('Authorization');
  if (auth === null) return json({ error: 'not authenticated' }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad body' }, 400);
  }

  const jobId = body.jobId;
  if (typeof jobId !== 'string' || jobId.length === 0) {
    return json({ error: 'jobId required' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (url === '' || serviceKey === '') {
    return json({ error: 'function not configured' }, 500);
  }

  // As the caller: row-level security decides whether he can see this job at
  // all. A stranger naming a job id gets nothing back, so he cannot use this
  // to make someone else's phone ring.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
  });

  const { data: job, error: jobError } = await asCaller
    .from('jobs')
    .select('id, farmer_id, area_sqm, service_id')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError !== null || job === null) {
    return json({ error: 'no such job' }, 404);
  }

  const { data: me } = await asCaller.auth.getUser();
  if (me.user === null || me.user.id !== job.farmer_id) {
    // Only the farmer who posted it may trigger its ping. Otherwise any
    // signed-in user could ring captains at will.
    return json({ error: 'not your job' }, 403);
  }

  // As the service: read the tokens of captains with a pending offer. This is
  // the only place they are ever read, and they do not leave this function.
  const asService = createClient(url, serviceKey);

  const { data: dispatches } = await asService
    .from('job_dispatch')
    .select('captain_id')
    .eq('job_id', jobId)
    .eq('response', 'pending');

  const captainIds = (dispatches ?? []).map((d) => d.captain_id as string);
  if (captainIds.length === 0) return json({ sent: 0, reason: 'nobody pending' });

  const { data: tokens } = await asService
    .from('push_tokens')
    .select('token')
    .in('profile_id', captainIds);

  const to = (tokens ?? []).map((t) => t.token as string);
  if (to.length === 0) return json({ sent: 0, reason: 'no registered devices' });

  const { data: service } = await asService
    .from('services')
    .select('name_pa, name_hi, name_en')
    .eq('id', job.service_id)
    .maybeSingle();

  // Punjabi, because Fazilka is Punjabi-speaking and this is the one message
  // he reads in a hurry. The body stays short: a glance from a tractor seat.
  const title = (service?.name_pa as string | undefined) ?? 'ਨਵਾਂ ਕੰਮ';
  const killa = Number(job.area_sqm) / 4046.8564224;

  const messages = to.map((token) => ({
    to: token,
    title,
    body: `${killa.toFixed(1)} ਕਿੱਲਾ`,
    data: { jobId },
    // Must match the channel the app creates, or Android silently downgrades
    // it to a quiet notification and the whole point is lost.
    channelId: 'zamindara-job-ping',
    categoryId: 'zamindara-job',
    priority: 'high',
    sound: 'default',
    // It has to behave like a call, not a message: stay until answered.
    sticky: true,
    ttl: 600,
  }));

  const sent = await fetch(EXPO_PUSH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!sent.ok) {
    return json({ error: 'expo rejected the push', status: sent.status }, 502);
  }

  return json({ sent: messages.length });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
