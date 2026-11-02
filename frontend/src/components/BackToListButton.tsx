import { Link } from 'react-router-dom';

export interface BackToListButtonProps {
  to: string;
  label?: string;
  className?: string;
}

export function BackToListButton({
  to,
  label = 'Quay lại danh sách',
  className = '',
}: BackToListButtonProps) {
  return (
    <Link
      to={to}
      className={`member-back-link back-to-list-link ${className}`.trim()}
    >
      {label}
    </Link>
  );
}
