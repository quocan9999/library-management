import type { ReactNode } from 'react';
import { BrandMark } from './BrandMark';

interface AuthLayoutProps {
  ariaLabel: string;
  children: ReactNode;
}

export function AuthLayout({ ariaLabel, children }: AuthLayoutProps) {
  return (
    <main className="auth-stage">
      <section className="auth-card" aria-label={ariaLabel}>
        <aside className="auth-rail">
          <BrandMark />
          <div className="bookplate-art" aria-hidden="true">
            <svg viewBox="0 0 420 330" fill="none">
              <path className="art-line art-line--soft" d="M60 252V132c0-67 55-122 122-122h56c67 0 122 55 122 122v120" />
              <path className="art-line" d="M90 252V139c0-50 41-91 91-91h58c50 0 91 41 91 91v113" />
              <path className="art-gold" d="M123 249V146c0-33 27-60 60-60h54c33 0 60 27 60 60v103" />
              <path className="art-gold art-line--thin" d="M210 86v162" />
              <path className="art-page" d="M126 185c28-7 57 1 84 22v42c-27-20-56-27-84-20v-44Z" />
              <path className="art-page art-page--right" d="M294 185c-28-7-57 1-84 22v42c27-20 56-27 84-20v-44Z" />
              <path className="art-line art-line--thin" d="M141 198c18-3 38 2 56 14M141 211c18-3 38 2 56 14M279 198c-18-3-38 2-56 14M279 211c-18-3-38 2-56 14" />
              <path className="art-floor" d="M74 270h272M105 283h210" />
              <circle className="art-star" cx="210" cy="24" r="3" />
              <path className="art-star" d="M210 12v7M210 29v7M198 24h7M215 24h7" />
              <path className="art-dot" d="M75 72v2M342 75v2M329 48v2M94 49v2" />
            </svg>
          </div>
          <div className="rail-copy">
            <p className="eyebrow eyebrow--light">KHÔNG GIAN LƯU GIỮ TRI THỨC</p>
            <h2>Tri thức luôn có nơi để trở về.</h2>
            <span className="gold-rule" aria-hidden="true" />
            <p className="rail-description">Nơi lưu giữ những câu chuyện, ý tưởng và kết nối bạn đọc.</p>
          </div>
          <p className="rail-footnote">PHÒNG ĐỌC DÀNH CHO MỌI THẾ HỆ</p>
        </aside>

        <div className="auth-main">
          <div className="mobile-brand"><BrandMark compact /></div>
          {children}
          <p className="auth-footer">HỆ THỐNG QUẢN LÝ THƯ VIỆN <span aria-hidden="true">·</span> TRI THỨC DÀNH CHO MỌI THẾ HỆ</p>
        </div>
      </section>
    </main>
  );
}
