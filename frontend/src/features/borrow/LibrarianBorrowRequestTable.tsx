import { Button, Pagination, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import type { PageResponse, StaffBorrowRequest } from './types';
import {
  aggregateStatusTagColor,
  formatDeskDate,
  ITEM_STATUS_LABELS,
  LOAN_STATUS_LABELS,
  requestNeedsStaffAction,
} from './staffBorrowPresentation';

interface LibrarianBorrowRequestTableProps {
  result: PageResponse<StaffBorrowRequest> | null;
  loading: boolean;
  page: number;
  sort: string;
  onSortChange: (sort: string) => void;
  emptyTitle: string;
  emptyDescription: string;
  onPageChange: (page: number) => void;
  onOpen: (request: StaffBorrowRequest) => void;
}

export function LibrarianBorrowRequestTable(props: LibrarianBorrowRequestTableProps) {
  const requests = props.result?.content ?? [];
  const sortOrder = (field: string) => props.sort === `${field},asc` ? 'ascend' as const
    : props.sort === `${field},desc` ? 'descend' as const : null;
  const onTableChange: NonNullable<TableProps<StaffBorrowRequest>['onChange']> = (_pagination, _filters, sorter) => {
    const selected = Array.isArray(sorter) ? sorter[0] : sorter;
    const field = String(selected.columnKey ?? '');
    if (['loanCode', 'memberName', 'itemCount', 'createdAt'].includes(field) && selected.order) {
      props.onSortChange(`${field},${selected.order === 'ascend' ? 'asc' : 'desc'}`);
    }
  };

  const columns: TableColumnsType<StaffBorrowRequest> = [
    {
      title: 'Mã yêu cầu',
      dataIndex: 'loanCode',
      key: 'loanCode',
      sorter: true,
      sortOrder: sortOrder('loanCode'),
      width: 150,
      render: (loanCode: string) => <Typography.Text strong className="librarian-borrow-table__code">{loanCode}</Typography.Text>,
    },
    {
      title: 'Thành viên',
      key: 'memberName',
      sorter: true,
      sortOrder: sortOrder('memberName'),
      width: 190,
      render: (_, request) => <span className="librarian-borrow-table__member">
        <Typography.Text ellipsis={{ tooltip: request.member.fullName || 'Chưa cập nhật họ tên' }}>
          {request.member.fullName?.trim() || 'Chưa cập nhật họ tên'}
        </Typography.Text>
      </span>,
    },
    {
      title: 'Số sách',
      key: 'itemCount',
      sorter: true,
      sortOrder: sortOrder('itemCount'),
      width: 100,
      align: 'center',
      render: (_, request) => request.items.length,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 250,
      render: (_, request) => {
        const statuses = [...new Set(request.items.map((item) => item.status))];
        const summary = statuses.map((status) =>
          `${ITEM_STATUS_LABELS[status]}: ${request.items.filter((item) => item.status === status).length}`,
        ).join(' · ');
        return <span className="librarian-borrow-table__status">
          <Tag color={aggregateStatusTagColor(request.status)}>{LOAN_STATUS_LABELS[request.status]}</Tag>
          {summary && <Tooltip title={summary}><Typography.Text type="secondary" ellipsis>{summary}</Typography.Text></Tooltip>}
        </span>;
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      sortOrder: sortOrder('createdAt'),
      width: 170,
      render: (createdAt: string) => <Typography.Text type="secondary">{formatDeskDate(createdAt)}</Typography.Text>,
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, request) => {
        return <Button
          type="link"
          onClick={(event) => {
            event.stopPropagation();
            props.onOpen(request);
          }}
          aria-label={`Xem chi tiết yêu cầu ${request.loanCode}`}
        >Xem chi tiết</Button>;
      },
    },
  ];

  return <>
    <div className="member-table-wrap librarian-borrow-table-wrap" aria-busy={props.loading}>
      <Table<StaffBorrowRequest>
        className="librarian-borrow-table"
        rowKey="loanCode"
        columns={columns}
        dataSource={requests}
        pagination={false}
        onChange={onTableChange}
        sortDirections={['ascend', 'descend', 'ascend']}
        showSorterTooltip={false}
        loading={props.loading ? { indicator: <Spin aria-label="Đang tải danh sách yêu cầu mượn" /> } : false}
        scroll={{ x: 1000 }}
        locale={{ emptyText: <span><strong>{props.emptyTitle}</strong><br />{props.emptyDescription}</span> }}
        onRow={(request) => ({
          tabIndex: 0,
          'aria-label': `Mở chi tiết yêu cầu ${request.loanCode}`,
          className: requestNeedsStaffAction(request) ? 'librarian-borrow-table__row--action' : undefined,
          onClick: () => props.onOpen(request),
          onKeyDown: (event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              props.onOpen(request);
            }
          },
        })}
      />
    </div>
    {props.result && props.result.totalElements > 0 && <div className="member-pagination-row">
      <span role="status">Tổng số {props.result.totalElements} yêu cầu</span>
      <Pagination
        aria-label="Phân trang danh sách yêu cầu mượn"
        current={props.page}
        pageSize={props.result.size}
        total={props.result.totalElements}
        showSizeChanger={false}
        onChange={props.onPageChange}
      />
    </div>}
  </>;
}
