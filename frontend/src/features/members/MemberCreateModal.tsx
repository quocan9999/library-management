import axios from 'axios';
import { Alert, DatePicker, Form, Input, Modal } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { memberApi } from './api';
import type { MemberCreateInput } from './types';

interface MemberCreateModalProps {
  onCancel: () => void;
  onCreated: () => void;
}

interface MemberCreateFormValues {
  email: string;
  password: string;
  fullName?: string;
  dateOfBirth?: Dayjs | null;
  phone?: string;
  address?: string;
}

const PASSWORD_POLICY = /^(?=.{8,20}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\p{P}\p{S}])\S+$/u;
const VIETNAM_MOBILE = /^0[35789]\d{8}$/;

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const code = error.response?.data?.code;
    if (code === 'EMAIL_ALREADY_REGISTERED' || code === 'EMAIL_NOT_VERIFIED_REGISTERED') {
      return 'Email này đã được đăng ký.';
    }
    if (code === 'MEMBER_PHONE_DUPLICATED') return 'Số điện thoại đã được thành viên khác sử dụng.';
    if (code === 'VALIDATION_ERROR' || code === 'MEMBER_CREATE_VALIDATION_ERROR') {
      return 'Thông tin thành viên chưa hợp lệ. Hãy kiểm tra lại các trường đã nhập.';
    }
  }
  return 'Không thể tạo thành viên lúc này. Hãy thử lại.';
}

export function MemberCreateModal({ onCancel, onCreated }: MemberCreateModalProps) {
  const [form] = Form.useForm<MemberCreateFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  /** Bỏ password khỏi state ngay sau khi tạo payload để lỗi API không giữ credential trong form. */
  const submit = async (values: MemberCreateFormValues) => {
    const password = values.password;
    const input: MemberCreateInput = {
      email: values.email.trim(),
      password,
      ...(values.fullName?.trim() ? { fullName: values.fullName.trim() } : {}),
      ...(values.dateOfBirth ? { dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD') } : {}),
      ...(values.phone?.trim() ? { phone: values.phone.trim() } : {}),
      ...(values.address?.trim() ? { address: values.address.trim() } : {}),
    };
    form.setFieldValue('password', undefined);
    setSubmitting(true);
    setRequestError(null);
    try {
      await memberApi.createMember(input);
      form.resetFields();
      onCreated();
      onCancel();
    } catch (error) {
      setRequestError(errorMessage(error));
    } finally {
      form.setFieldValue('password', undefined);
      setSubmitting(false);
    }
  };

  const cancel = () => {
    if (submitting) return;
    form.resetFields();
    setRequestError(null);
    onCancel();
  };

  return (
    <Form<MemberCreateFormValues> form={form} layout="vertical" onFinish={submit}>
      <Modal
        open
        title="Tạo thành viên"
        okText="Tạo thành viên"
        cancelText="Hủy"
        confirmLoading={submitting}
        onCancel={cancel}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <p role="note">Thành viên cần xác minh email trước khi đăng nhập.</p>
        {requestError && <Alert className="member-alert" type="error" showIcon role="alert" title={requestError} />}
        <Form.Item
          name="email"
          label="Email thành viên"
          rules={[
            { required: true, message: 'Nhập email thành viên.' },
            { type: 'email', message: 'Email không hợp lệ.' },
            { max: 255, message: 'Email không được vượt quá 255 ký tự.' },
          ]}
        >
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Mật khẩu ban đầu"
          rules={[
            { required: true, message: 'Nhập mật khẩu ban đầu.' },
            {
              validator: async (_rule, value: string | undefined) => {
                if (value && !PASSWORD_POLICY.test(value)) {
                  throw new Error('Mật khẩu cần 8–20 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.');
                }
              },
            },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="fullName" label="Họ và tên" rules={[{ max: 150, message: 'Họ tên tối đa 150 ký tự.' }]}>
          <Input autoComplete="name" />
        </Form.Item>
        <Form.Item
          name="dateOfBirth"
          label="Ngày sinh"
          getValueFromEvent={(value: Dayjs | null) => value ?? undefined}
          rules={[{
            validator: async (_rule, value: Dayjs | undefined) => {
              if (value && (!value.isValid() || value.isAfter(dayjs().subtract(16, 'year'), 'day'))) {
                throw new Error('Thành viên phải đủ 16 tuổi.');
              }
            },
          }]}
        >
          <DatePicker
            aria-label="Ngày sinh"
            format="DD/MM/YYYY"
            disabledDate={(date) => date.isAfter(dayjs().subtract(16, 'year'), 'day')}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item
          name="phone"
          label="Số điện thoại"
          rules={[
            { max: 20, message: 'Số điện thoại tối đa 20 ký tự.' },
            {
              validator: async (_rule, value: string | undefined) => {
                if (value?.trim() && !VIETNAM_MOBILE.test(value.trim().replace(/[.\s-]/g, ''))) {
                  throw new Error('Nhập số di động Việt Nam hợp lệ.');
                }
              },
            },
          ]}
        >
          <Input autoComplete="tel" />
        </Form.Item>
        <Form.Item name="address" label="Địa chỉ" rules={[{ max: 255, message: 'Địa chỉ tối đa 255 ký tự.' }]}>
          <Input />
        </Form.Item>
      </Modal>
    </Form>
  );
}
