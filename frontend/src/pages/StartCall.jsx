import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api, describeError } from '../lib/api.js';
import {
  Card, CardHeader, Field, Input, Textarea, Select, Button, Dialog, Icon, Spinner, TestBadge, useToast,
} from '../components/ui.jsx';

const TEST_SCENARIOS = [
  { value: 'completed', label: 'Successful completion' },
  { value: 'no_answer', label: 'Unanswered' },
  { value: 'failed', label: 'Failed call' },
  { value: 'timeout', label: 'Provider timeout (at dispatch)' },
  { value: 'no_transcript', label: 'Completed, missing transcript' },
  { value: 'no_cost', label: 'Completed, missing cost' },
  { value: 'reject', label: 'Provider rejection (at dispatch)' },
];

// Light client-side check; the server is the source of truth for validation.
function looksLikeIndianMobile(v) {
  const digits = v.replace(/[^\d+]/g, '');
  return /^\+91[6-9]\d{9}$/.test(digits);
}

export default function StartCall() {
  const { status } = useOutletContext();
  const navigate = useNavigate();
  const toast = useToast();
  const isTest = status?.mode === 'test';

  const [phone, setPhone] = useState('+91');
  const [note, setNote] = useState('');
  const [scenario, setScenario] = useState('completed');
  const [consent, setConsent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState(null);

  const openConfirm = () => {
    if (!looksLikeIndianMobile(phone)) {
      setFieldError('Enter a valid Indian mobile in +91XXXXXXXXXX format.');
      return;
    }
    setFieldError(null);
    setConfirmOpen(true);
  };

  const submit = async () => {
    if (busy) return; // guard against double submit
    setBusy(true);
    try {
      const res = await api.createCall({
        phone,
        consent: { confirmed: true, note: note || undefined },
        idempotencyKey: `${phone}-${Date.now()}`,
        ...(isTest ? { testScenario: scenario } : {}),
      });
      setConfirmOpen(false);
      toast.success(isTest ? 'Test call started — simulating lifecycle.' : 'Call initiated.');
      navigate(`/calls/${res.call.id}`);
    } catch (e) {
      setConfirmOpen(false);
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Start a call</h1>
        <p className="text-sm text-slate-400">Place a manual, consent-based outbound call to an Indian mobile.</p>
      </div>

      <Card>
        <CardHeader
          title="Call details"
          subtitle="The recipient must have agreed to receive this demonstration call."
          action={isTest ? <TestBadge /> : null}
        />
        <div className="space-y-5 p-5">
          <Field label="Recipient number (+91)" htmlFor="phone" error={fieldError}
            hint="Indian mobile numbers only, e.g. +91 98765 43210">
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+919876543210" />
          </Field>

          <Field label="Consent note (optional)" htmlFor="note" hint="For your audit trail — e.g. how/when consent was given">
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agreed on WhatsApp at 3:40pm" />
          </Field>

          {isTest && (
            <Field label="Test scenario" htmlFor="scenario" hint="Simulated outcome — does not place a phone call">
              <Select id="scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                {TEST_SCENARIOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
          )}

          <label className="flex items-start gap-3 rounded-lg border border-ink-800 bg-ink-850 p-3 text-sm text-slate-300">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-indigo-500" />
            <span>I confirm this recipient has <strong className="text-slate-100">consented</strong> to receive this AI demonstration call.</span>
          </label>

          <Button className="w-full" disabled={!consent} onClick={openConfirm}>
            <Icon name="phone" className="h-4 w-4" /> Place call
          </Button>
        </div>
      </Card>

      <Dialog open={confirmOpen} title="Confirm outbound call" onClose={() => !busy && setConfirmOpen(false)}>
        <p className="text-sm text-slate-300">
          You are about to initiate an AI voice call to <span className="font-mono text-slate-100">{phone}</span>.
        </p>
        <div className={`mt-3 rounded-lg border p-3 text-sm ${isTest ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
          {isTest
            ? 'TEST MODE — this simulates the call lifecycle. No real call is placed and no charges apply.'
            : 'LIVE MODE — this places a REAL call and may incur provider charges.'}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <><Spinner className="h-4 w-4" /> Placing…</> : 'Confirm & call'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
