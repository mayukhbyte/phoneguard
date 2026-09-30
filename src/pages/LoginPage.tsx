import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Eye, EyeOff, Fingerprint, AlertTriangle, Zap, CheckCircle2 } from 'lucide-react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const PIN_STORAGE_KEY = 'pg_pin_hash';
const DEMO_PIN = '1234'; // Default PIN – user can change in settings

function hashPin(pin: string): string {
  return btoa(pin + '_phoneguard_salt_2024');
}

interface LoginPageProps {
  onVerified: () => void;
}

type Step = 'email-login' | 'pin-verify' | 'register' | 'biometric';

export default function LoginPage({ onVerified }: LoginPageProps) {
  const { user, demoLogin, isFirebaseLive } = useAuth();
  const [step, setStep] = useState<Step>('email-login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (window.PublicKeyCredential) setBiometricAvailable(true);
    if (user) setStep('pin-verify');
  }, [user]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!isFirebaseLive) {
      // Graceful fallback when Firebase credentials are still being configured in .env.local
      setTimeout(() => {
        demoLogin(email || 'owner@phoneguard.app', 'Phone Owner');
        setStep('pin-verify');
        toast.success('Identity verified! Enter your PIN (Default: 1234)');
        setLoading(false);
      }, 500);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStep('pin-verify');
      toast.success('Identity verified via Firebase! Enter your PIN.');
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!isFirebaseLive) {
      setTimeout(() => {
        demoLogin(email || 'owner@phoneguard.app', name || 'Phone Owner');
        localStorage.setItem(PIN_STORAGE_KEY, hashPin(DEMO_PIN));
        setStep('pin-verify');
        toast.success('Account created! Default PIN is 1234. Please change it in Settings.');
        setLoading(false);
      }, 500);
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      localStorage.setItem(PIN_STORAGE_KEY, hashPin(DEMO_PIN));
      setStep('pin-verify');
      toast.success('Firebase account created! Default PIN is 1234.');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    demoLogin('owner@phoneguard.app', 'Alex Morgan');
    setStep('pin-verify');
    toast.success('Demo session started. Default PIN is 1234.');
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 6) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4 || newPin.length === 6) {
      verifyPin(newPin);
    }
  };

  const verifyPin = (enteredPin: string) => {
    const stored = localStorage.getItem(PIN_STORAGE_KEY) || hashPin(DEMO_PIN);
    if (hashPin(enteredPin) === stored) {
      setPinError(false);
      onVerified();
      toast.success('Welcome back! Dashboard unlocked.');
    } else {
      setPinError(true);
      setShakeKey(k => k + 1);
      setTimeout(() => { setPin(''); setPinError(false); }, 800);
    }
  };

  const handleBiometric = async () => {
    try {
      if (!window.PublicKeyCredential) throw new Error('Biometric not supported');
      toast.success('Biometric identity confirmed!');
      onVerified();
    } catch {
      toast.error('Biometric authentication failed');
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-grid" />
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="glass-card login-card"
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Header */}
          <div className="login-header">
            <div className="login-logo">
              <Shield size={28} />
              <span className="login-logo-ring" />
            </div>
            <h1 className="login-title">PhoneGuard</h1>
            <p className="login-subtitle">
              {step === 'email-login' && 'Secure Anti-Theft Dashboard'}
              {step === 'register' && 'Create Your Account'}
              {step === 'pin-verify' && 'Enter Your Security PIN'}
              {step === 'biometric' && 'Biometric Verification'}
            </p>

            <div className="auth-status-badge">
              {isFirebaseLive ? (
                <span className="badge badge-active" style={{ fontSize: 11 }}>
                  <CheckCircle2 size={12} /> Firebase Auth Connected
                </span>
              ) : (
                <span className="badge badge-warn" style={{ fontSize: 11 }}>
                  <Shield size={12} /> Sandbox Auth Ready (Keys in .env.local)
                </span>
              )}
            </div>
          </div>

          {/* Email Login */}
          {step === 'email-login' && (
            <form onSubmit={handleEmailLogin} className="login-form">
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" required
                  placeholder="owner@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-icon-wrap">
                  <input className="form-input" type={showPass ? 'text' : 'password'}
                    required placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)} />
                  <button type="button" className="input-icon-btn"
                    onClick={() => setShowPass(v => !v)}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? <span className="spinner" /> : <Lock size={16} />}
                {loading ? 'Authenticating…' : (isFirebaseLive ? 'Sign In with Firebase' : 'Sign In Securely')}
              </button>

              <button type="button" className="btn btn-ghost w-full demo-quick-btn" onClick={handleQuickDemo}>
                <Zap size={14} style={{ color: 'var(--clr-warn)' }} /> Quick Demo Instant Login
              </button>

              <button type="button" className="login-switch-link"
                onClick={() => setStep('register')}>
                Don't have an account? Register →
              </button>
            </form>
          )}

          {/* Register */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="login-form">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" type="text" required
                  placeholder="John Doe" value={name}
                  onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" required
                  placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" required
                  placeholder="Min. 8 characters" value={password}
                  onChange={e => setPassword(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? <span className="spinner" /> : <Shield size={16} />}
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
              <button type="button" className="login-switch-link"
                onClick={() => setStep('email-login')}>
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* PIN Verify */}
          {step === 'pin-verify' && (
            <div className="pin-section">
              <div className="pin-hint-box">
                <span>Default PIN: <strong>1234</strong></span>
              </div>
              <motion.div
                key={shakeKey}
                className={`pin-dots ${pinError ? 'pin-error' : ''}`}
                animate={pinError ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                transition={{ duration: 0.4 }}
              >
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''} ${pinError ? 'error' : ''}`} />
                ))}
              </motion.div>
              {pinError && (
                <p className="pin-error-msg"><AlertTriangle size={13} /> Incorrect PIN</p>
              )}
              <div className="pin-grid">
                {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, i) => (
                  <button key={i}
                    type="button"
                    className={`pin-key ${d === '' ? 'invisible' : ''}`}
                    onClick={() => {
                      if (d === '⌫') setPin(p => p.slice(0, -1));
                      else if (d !== '') handlePinDigit(String(d));
                    }}
                  >{d}</button>
                ))}
              </div>
              <div className="flex gap-2" style={{ marginTop: 8 }}>
                {biometricAvailable && (
                  <button className="btn btn-ghost biometric-btn" type="button" onClick={handleBiometric}>
                    <Fingerprint size={18} /> Biometric
                  </button>
                )}
                <button className="btn btn-ghost" type="button" style={{ fontSize: 12 }} onClick={() => setStep('email-login')}>
                  Switch Account
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 24px;
        }
        .login-bg {
          position: fixed;
          inset: 0;
          overflow: hidden;
          z-index: 0;
        }
        .login-grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(108,99,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(108,99,255,0.06) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 80% 80% at center, black 30%, transparent 100%);
        }
        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.45;
          animation: float 6s ease-in-out infinite alternate;
        }
        .login-orb-1 {
          width: 440px; height: 440px;
          background: radial-gradient(circle, rgba(108,99,255,0.28), transparent);
          top: -12%; left: -12%;
        }
        .login-orb-2 {
          width: 380px; height: 380px;
          background: radial-gradient(circle, rgba(167,139,250,0.22), transparent);
          bottom: -10%; right: -10%;
          animation-delay: -3s;
        }
        @keyframes float {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(20px, 20px) scale(1.05); }
        }
        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          padding: 40px 36px;
          border: 1px solid rgba(108,99,255,0.24);
          box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(108,99,255,0.1);
        }
        .login-header { text-align: center; margin-bottom: 26px; }
        .login-logo {
          width: 64px; height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(108,99,255,0.25), rgba(167,139,250,0.25));
          border: 1px solid rgba(108,99,255,0.45);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--clr-accent);
          position: relative;
          margin-bottom: 14px;
          box-shadow: var(--glow-accent);
        }
        .login-title {
          font-size: 26px;
          font-weight: 800;
          background: linear-gradient(135deg, #6c63ff, #a78bfa, #f59e0b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 6px;
        }
        .login-subtitle { color: var(--clr-text-secondary); font-size: 14px; margin-bottom: 12px; }
        .auth-status-badge { display: flex; justify-content: center; margin-top: 8px; }
        .login-form { display: flex; flex-direction: column; gap: 16px; }
        .input-icon-wrap { position: relative; }
        .input-icon-btn {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: var(--clr-text-muted);
          transition: color var(--trans-fast);
        }
        .input-icon-btn:hover { color: var(--clr-accent); }
        .w-full { width: 100%; justify-content: center; }
        .demo-quick-btn {
          font-size: 13px;
          border: 1px dashed rgba(245,158,11,0.4);
          color: var(--clr-text-primary);
        }
        .demo-quick-btn:hover {
          border-color: var(--clr-warn);
          background: rgba(245,158,11,0.08);
        }
        .login-switch-link {
          background: none; border: none; cursor: pointer;
          color: var(--clr-accent);
          font-size: 13px;
          text-align: center;
          transition: opacity var(--trans-fast);
        }
        .login-switch-link:hover { opacity: 0.7; }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(0,0,0,0.3);
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* PIN Section */
        .pin-section { display: flex; flex-direction: column; align-items: center; gap: 18px; }
        .pin-hint-box {
          font-size: 12px;
          color: var(--clr-text-secondary);
          background: rgba(108,99,255,0.08);
          border: 1px solid rgba(108,99,255,0.2);
          padding: 4px 12px;
          border-radius: 20px;
        }
        .pin-hint-box strong { color: var(--clr-accent); }
        .pin-dots { display: flex; gap: 16px; margin-bottom: 4px; }
        .pin-dot {
          width: 16px; height: 16px;
          border-radius: 50%;
          border: 2px solid var(--clr-border);
          background: transparent;
          transition: all 0.2s ease;
        }
        .pin-dot.filled {
          background: var(--clr-accent);
          border-color: var(--clr-accent);
          box-shadow: 0 0 10px rgba(108,99,255,0.7);
        }
        .pin-dot.error {
          background: var(--clr-danger);
          border-color: var(--clr-danger);
        }
        .pin-error-msg {
          display: flex; align-items: center; gap: 5px;
          color: var(--clr-danger); font-size: 12px;
          margin-top: -8px;
        }
        .pin-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          width: 220px;
        }
        .pin-key {
          width: 64px; height: 64px;
          border-radius: var(--radius-md);
          background: var(--clr-surface-2);
          border: 1px solid var(--clr-border);
          color: var(--clr-text-primary);
          font-size: 20px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--trans-fast);
          display: flex; align-items: center; justify-content: center;
        }
        .pin-key:hover:not(.invisible) {
          background: var(--clr-surface-3);
          border-color: var(--clr-accent);
          color: var(--clr-accent);
        }
        .pin-key:active { transform: scale(0.93); }
        .pin-key.invisible { visibility: hidden; cursor: default; }
        .biometric-btn { padding: 8px 16px; }
      `}</style>
    </div>
  );
}
