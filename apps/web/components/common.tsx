type NoticeProps = { error?: string; message?: string };

export function BrandLockup() {
  return <div className="brand-lockup"><span className="brand-slash">/</span><span>ROX<span className="lime">MATE</span></span><small>YOUR PERFORMANCE. YOUR PEOPLE.</small></div>;
}

export function NoticeStack({ error, message }: NoticeProps) {
  return <>{error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice success" role="status">{message}</div>}</>;
}

export function LoadingPage() {
  return <main className="loading-page"><span className="lime">ROXMATE</span><p>正在读取登录状态…</p></main>;
}
