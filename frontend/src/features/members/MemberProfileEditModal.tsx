import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, DatePicker, Input, Modal } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiEnvelope } from '../../auth/types';
import { memberApi } from './api';
import type { MemberDetail, MemberProfilePatchInput } from './types';

const vietnamMobile = /^0[35789]\d{8}$/;

const profileSchema = z.object({
  fullName: z.string().refine((value) => value.trim().length <= 150, 'Họ và tên không được vượt quá 150 ký tự.'),
  dateOfBirth: z.string()
    .refine((value) => !value || (dayjs(value).isValid() && dayjs(value).format('YYYY-MM-DD') === value), 'Ngày sinh không hợp lệ.')
    .refine((value) => !value || !dayjs(value).isAfter(dayjs(), 'day'), 'Ngày sinh không được ở tương lai.'),
  phone: z.string().refine((value) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (!/^[0-9.\s-]+$/.test(trimmed)) return false;
    return vietnamMobile.test(trimmed.replace(/[.\s-]/g, ''));
  }, 'Số điện thoại phải là số di động Việt Nam gồm 10 chữ số.'),
  address: z.string().refine((value) => value.trim().length <= 255, 'Địa chỉ không được vượt quá 255 ký tự.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`;
}

function formatPhone(value: string | null): string {
  return value ? formatPhoneInput(value) : '';
}

function toFormValues(member: MemberDetail): ProfileFormValues {
  return {
    fullName: member.fullName ?? '',
    dateOfBirth: member.dateOfBirth ?? '',
    phone: formatPhone(member.phone),
    address: member.address ?? '',
  };
}

function normalizePhone(value: string): string {
  return value.replace(/[.\s-]/g, '');
}

/** Chỉ gửi giá trị đã đổi để ô trống không bị hiểu thành yêu cầu xóa dữ liệu. */
function buildPatch(member: MemberDetail, values: ProfileFormValues): MemberProfilePatchInput {
  const patch: MemberProfilePatchInput = { version: member.version };
  const fullName = values.fullName.trim();
  const address = values.address.trim();
  const phone = normalizePhone(values.phone.trim());

  if (fullName && fullName !== (member.fullName ?? '').trim()) patch.fullName = fullName;
  if (values.dateOfBirth && values.dateOfBirth !== (member.dateOfBirth ?? '')) {
    patch.dateOfBirth = values.dateOfBirth;
  }
  if (phone && phone !== normalizePhone(member.phone ?? '')) patch.phone = phone;
  if (address && address !== (member.address ?? '').trim()) patch.address = address;
  return patch;
}

function responseBody(error: unknown): ApiEnvelope<unknown> | null {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return null;
  return error.response?.data ?? null;
}

export function MemberProfileEditModal({
  member,
  onCancel,
  onSaved,
  onMemberReloaded,
}: {
  member: MemberDetail;
  onCancel: () => void;
  onSaved: () => void;
  onMemberReloaded: (member: MemberDetail) => void;
}) {
  const [editSnapshot, setEditSnapshot] = useState(member);
  const [conflict, setConflict] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const { control, handleSubmit, reset, setError, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: toFormValues(member),
  });

  const reloadLatest = async () => {
    setReloading(true);
    setServerError(null);
    try {
      const latest = await memberApi.getMember(editSnapshot.id);
      setEditSnapshot(latest);
      reset(toFormValues(latest));
      onMemberReloaded(latest);
      setConflict(false);
    } catch {
      setServerError('Không thể tải lại hồ sơ. Các thông tin đang nhập vẫn được giữ nguyên.');
    } finally {
      setReloading(false);
    }
  };

  const confirmReload = () => {
    Modal.confirm({
      title: 'Tải lại dữ liệu thành viên?',
      content: 'Tải dữ liệu mới sẽ bỏ các chỉnh sửa chưa lưu trong biểu mẫu.',
      okText: 'Tải lại và bỏ thay đổi',
      cancelText: 'Tiếp tục chỉnh sửa',
      onOk: reloadLatest,
    });
  };

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    setConflict(false);
    const patch = buildPatch(editSnapshot, values);
    if (Object.keys(patch).length === 1) {
      onCancel();
      return;
    }

    setSaving(true);
    try {
      await memberApi.patchProfile(editSnapshot.id, patch);
      onSaved();
    } catch (error: unknown) {
      const envelope = responseBody(error);
      if (envelope?.code === 'MEMBER_VERSION_CONFLICT') {
        // Giữ nguyên snapshot/version và toàn bộ input để người dùng tự quyết định tải lại.
        setConflict(true);
        return;
      }
      const fieldErrors = envelope?.errors ?? {};
      let hasFieldError = false;
      for (const field of ['fullName', 'dateOfBirth', 'phone', 'address'] as const) {
        const message = fieldErrors[field];
        if (message) {
          setError(field, { type: 'server', message });
          hasFieldError = true;
        }
      }
      if (envelope && !hasFieldError) setServerError(envelope.message);
      else if (!envelope) setServerError('Không thể lưu hồ sơ. Hãy thử lại.');
    } finally {
      setSaving(false);
    }
  });

  return <Modal
    open
    title="Chỉnh sửa hồ sơ thành viên"
    onCancel={onCancel}
    footer={null}
    destroyOnHidden
  >
    <form className="member-profile-form" onSubmit={(event) => { void submit(event); }} noValidate>
      {conflict && <Alert
        type="warning"
        showIcon
        role="alert"
        title="Thông tin thành viên đã được thay đổi bởi quản trị viên khác"
        action={<Button loading={reloading} onClick={confirmReload}>Tải lại dữ liệu</Button>}
      />}
      {serverError && <Alert type="error" showIcon role="alert" title={serverError} />}

      <label htmlFor="member-profile-full-name">Họ và tên</label>
      <Controller
        name="fullName"
        control={control}
        render={({ field }) => <Input
          id="member-profile-full-name"
          maxLength={150}
          value={field.value}
          aria-invalid={Boolean(errors.fullName)}
          onChange={field.onChange}
          onBlur={field.onBlur}
        />}
      />
      {errors.fullName?.message && <span className="member-profile-form__error" role="alert">{errors.fullName.message}</span>}

      <label htmlFor="member-profile-date-of-birth">Ngày sinh</label>
      <Controller
        name="dateOfBirth"
        control={control}
        render={({ field }) => <DatePicker
          id="member-profile-date-of-birth"
          aria-label="Ngày sinh"
          format="YYYY/MM/DD"
          value={field.value ? dayjs(field.value) : null}
          disabledDate={(date) => date.isAfter(dayjs(), 'day')}
          onChange={(date) => field.onChange(date?.format('YYYY-MM-DD') ?? '')}
          onBlur={field.onBlur}
        />}
      />
      {errors.dateOfBirth?.message && <span className="member-profile-form__error" role="alert">{errors.dateOfBirth.message}</span>}

      <label htmlFor="member-profile-phone">Số điện thoại</label>
      <Controller
        name="phone"
        control={control}
        render={({ field }) => <Input
          id="member-profile-phone"
          inputMode="tel"
          maxLength={12}
          value={field.value}
          aria-invalid={Boolean(errors.phone)}
          onChange={(event) => field.onChange(formatPhoneInput(event.target.value))}
          onBlur={field.onBlur}
        />}
      />
      {errors.phone?.message && <span className="member-profile-form__error" role="alert">{errors.phone.message}</span>}

      <label htmlFor="member-profile-address">Địa chỉ</label>
      <Controller
        name="address"
        control={control}
        render={({ field }) => <Input.TextArea
          id="member-profile-address"
          maxLength={255}
          rows={3}
          value={field.value}
          aria-invalid={Boolean(errors.address)}
          onChange={field.onChange}
          onBlur={field.onBlur}
        />}
      />
      {errors.address?.message && <span className="member-profile-form__error" role="alert">{errors.address.message}</span>}

      <div className="member-profile-form__actions">
        <Button onClick={onCancel} disabled={saving}>Hủy</Button>
        <Button type="primary" htmlType="submit" loading={saving}>Lưu thay đổi</Button>
      </div>
    </form>
  </Modal>;
}
