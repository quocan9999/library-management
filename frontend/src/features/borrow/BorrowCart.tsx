import { Button, Drawer } from 'antd';
import { formatVnd } from '../books/formatting';
import type { CatalogBook } from './types';

interface BorrowCartProps {
  books: CatalogBook[];
  maximumBooks: number;
  totalFee: number;
  locked: boolean;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onRemove: (book: CatalogBook) => void;
  onSubmit: () => void;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>;
}

export function BorrowCart({
  books,
  maximumBooks,
  totalFee,
  locked,
  drawerOpen,
  onOpenDrawer,
  onCloseDrawer,
  onRemove,
  onSubmit,
}: BorrowCartProps) {
  return <>
    {books.length > 0 && <div className="borrow-cart-bar" role="region" aria-label="Tóm tắt giỏ đặt mượn">
      <div className="borrow-cart-bar__inner">
        <div className="borrow-cart-bar__summary">
          <strong className="borrow-cart-bar__count">{books.length}/{maximumBooks} sách đã chọn</strong>
          <span className="borrow-cart-bar__total">Tổng phí {formatVnd(totalFee)}</span>
        </div>
        <Button className="borrow-cart-bar__button borrow-cart-bar__view" onClick={onOpenDrawer}>
          Xem giỏ
        </Button>
      </div>
    </div>}

    <Drawer
      rootClassName="borrow-cart-drawer"
      open={drawerOpen}
      placement="right"
      size="min(380px, 100vw)"
      title={<h2 className="borrow-cart-drawer__title">Giỏ đặt mượn</h2>}
      closable={false}
      extra={<Button
        className="borrow-cart-icon-button"
        type="text"
        aria-label="Đóng giỏ đặt mượn"
        onClick={onCloseDrawer}
      ><CloseIcon /></Button>}
      keyboard
      mask={{ closable: true }}
      focusable={{ trap: true, focusTriggerAfterClose: true }}
      onClose={onCloseDrawer}
      styles={{
        header: { padding: '20px 20px 0', borderBottom: 0 },
        body: { display: 'flex', minHeight: 0, flexDirection: 'column', padding: '8px 20px 20px' },
        footer: { padding: '16px 20px 20px', borderTop: '1px solid var(--line)' },
      }}
      footer={<div className="borrow-cart-drawer__footer">
        <div className="borrow-cart-drawer__total">
          <strong>Tổng phí mượn</strong>
          <strong>{formatVnd(totalFee)}</strong>
        </div>
        <Button type="primary" block disabled={books.length === 0 || locked} onClick={onSubmit}>
          Đặt mượn
        </Button>
      </div>}
    >
      <p className="borrow-cart-drawer__description">Các sách sẽ được gộp vào một yêu cầu và một mã QR.</p>
      {books.length > 0 ? <ul className="borrow-cart-list">
        {books.map((book) => <li className="borrow-cart-list__item" key={book.id}>
          <div className="borrow-cart-list__cover" aria-hidden="true">
            {book.coverImageUrl
              ? <img src={book.coverImageUrl} alt="" />
              : <span>SÁCH</span>}
          </div>
          <div className="borrow-cart-list__details">
            <strong title={book.title}>{book.title}</strong>
            <span>{formatVnd(book.borrowFee)}</span>
          </div>
          <Button
            className="borrow-cart-icon-button borrow-cart-list__remove"
            type="text"
            aria-label={`Bỏ ${book.title} khỏi giỏ`}
            disabled={locked}
            onClick={() => onRemove(book)}
          ><CloseIcon /></Button>
        </li>)}
      </ul> : <p className="borrow-cart-drawer__empty">Chưa chọn sách nào.</p>}
    </Drawer>
  </>;
}
