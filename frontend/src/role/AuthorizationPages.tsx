import { Alert, Card } from 'antd';
import { Link } from 'react-router-dom';

export function AuthorizationLandingPage() {
  return (
    <main className="role-stage authorization-stage">
      <section className="role-workspace authorization-workspace" aria-labelledby="authorization-title">
        <div className="role-heading">
          <div>
            <p className="role-eyebrow">QUẢN TRỊ HỆ THỐNG</p>
            <h1 id="authorization-title">Quản lý phân quyền</h1>
            <p className="role-intro">Quản lý nhóm quyền và phạm vi truy cập trong thư viện.</p>
          </div>
        </div>
        <div className="authorization-cards">
          <Link className="authorization-card-link" to="/admin/authorization/groups">
            <Card className="authorization-card" hoverable>
              <span className="authorization-card__icon" aria-hidden="true">01</span>
              <span className="authorization-card__copy">
                <strong>Quản lý nhóm quyền</strong>
                <span>Tạo nhóm, cập nhật quyền và trạng thái hoạt động.</span>
              </span>
              <span className="authorization-card__arrow" aria-hidden="true">→</span>
            </Card>
          </Link>
          <Link className="authorization-card-link" to="/admin/authorization/assignments">
            <Card className="authorization-card" hoverable>
              <span className="authorization-card__icon" aria-hidden="true">02</span>
              <span className="authorization-card__copy">
                <strong>Gán nhóm quyền cho tài khoản</strong>
                <span>Tìm tài khoản quản trị và điều chỉnh nhóm được gán.</span>
              </span>
              <span className="authorization-card__arrow" aria-hidden="true">→</span>
            </Card>
          </Link>
        </div>
      </section>
    </main>
  );
}

export function AssignmentPlaceholderPage() {
  return (
    <main className="role-stage authorization-stage">
      <section className="role-workspace authorization-workspace" aria-labelledby="assignment-placeholder-title">
        <div className="role-heading">
          <div>
            <p className="role-eyebrow">QUẢN TRỊ HỆ THỐNG</p>
            <h1 id="assignment-placeholder-title">Gán nhóm quyền cho tài khoản</h1>
            <p className="role-intro">Trang quản lý tài khoản quản trị đang được chuẩn bị.</p>
          </div>
        </div>
        <Alert
          type="info"
          showIcon
          title="Chức năng này sẽ có trong Phase 05"
          description="Trang tìm kiếm, tạo tài khoản quản trị và gán nhóm quyền được triển khai đầy đủ ở Phase 05."
        />
        <Link className="authorization-back-link" to="/admin/authorization">Quay lại quản lý phân quyền</Link>
      </section>
    </main>
  );
}
