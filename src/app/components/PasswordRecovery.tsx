import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

export default function PasswordRecovery() {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('Đang kiểm tra liên kết…');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        if (!isSupabaseConfigured()) throw new Error('missing configuration');
        // Initialization consumes the recovery fragment before any URL cleanup.
        const { error: initializationError } = await supabase.auth.initialize();
        if (initializationError) throw initializationError;
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw error || new Error('missing session');
        if (active) {
          setEmail(data.user.email || '');
          setReady(true);
          setMessage('Nhập mật khẩu mới cho tài khoản kho Transaction.');
        }
      } catch {
        if (active) setMessage('Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu email khôi phục mới và mở email mới nhất.');
      } finally {
        // Keep a reloadable destination without retaining credentials in the URL.
        if (active) window.history.replaceState(null, '', '/?reset-password=1');
      }
    }
    void verify();
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || saving.current) return;
    if (password.length < 8) { setMessage('Mật khẩu cần ít nhất 8 ký tự.'); return; }
    if (password !== confirmation) { setMessage('Hai mật khẩu chưa trùng nhau.'); return; }
    saving.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setMessage(error.message); return; }
      setPassword('');
      setConfirmation('');
      setDone(true);
      setMessage('Đã lưu mật khẩu mới. Bạn có thể dùng mật khẩu này để đăng nhập kho Transaction.');
    } catch {
      setMessage('Chưa lưu được mật khẩu. Kiểm tra kết nối rồi thử lại.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#f5efed', color: '#413644', fontFamily: 'var(--font-main, sans-serif)' }}>
      <section aria-labelledby="recovery-title" style={{ width: '100%', maxWidth: 440, padding: 28, border: '1px solid #d5c8d0', borderRadius: 20, background: '#fffafa' }}>
        <p style={{ fontSize: 12, letterSpacing: '0.12em', marginBottom: 12 }}>PAYROLL HUB · TRANSACTION</p>
        <h1 id="recovery-title" style={{ fontSize: 26, fontWeight: 600, marginBottom: 12 }}>Đặt mật khẩu kho</h1>
        {email ? <p style={{ marginBottom: 12 }}>{email}</p> : null}
        <p role="status" aria-live="polite" style={{ marginBottom: 20 }}>{message}</p>
        {ready && !done ? (
          <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
            <label htmlFor="new-password">Mật khẩu mới</label>
            <input id="new-password" name="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} style={{ padding: 12, border: '1px solid #b8a5b1', borderRadius: 8 }} />
            <label htmlFor="confirm-password">Nhập lại mật khẩu</label>
            <input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} style={{ padding: 12, border: '1px solid #b8a5b1', borderRadius: 8 }} />
            <button type="submit" disabled={busy} className="active:scale-[0.98]" style={{ padding: 12, borderRadius: 24, background: '#413644', color: 'white', cursor: 'pointer' }}>{busy ? 'Đang lưu…' : 'Lưu mật khẩu'}</button>
          </form>
        ) : null}
        <a href="/" style={{ display: 'inline-block', marginTop: 20, textDecoration: 'underline' }}>Về Payroll Hub</a>
      </section>
    </main>
  );
}
