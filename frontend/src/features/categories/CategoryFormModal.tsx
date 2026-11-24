import { Alert, Form, Input, Modal } from 'antd';
import axios from 'axios';
import { useState } from 'react';
import type { ApiEnvelope } from '../../auth/types';
import { categoryApi } from './api';
import type { Category } from './types';

interface CategoryFormValues {
  name: string;
  description: string;
}

function toFormValues(category?: Category): CategoryFormValues {
  return {
    name: category?.name ?? '',
    description: category?.description ?? '',
  };
}

function responseBody(error: unknown): ApiEnvelope<unknown> | null {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return null;
  return error.response?.data ?? null;
}

function errorMessage(error: unknown): string {
  const body = responseBody(error);
  switch (body?.code) {
    case 'CATEGORY_NAME_DUPLICATED': return 'Tên danh mục này đã được sử dụng.';
    case 'CATEGORY_NOT_FOUND': return 'Danh mục không còn tồn tại. Hãy tải lại danh sách.';
    case 'CATEGORY_VERSION_CONFLICT': return 'Danh mục đã được Admin khác cập nhật. Hãy tải lại danh sách.';
    case 'VALIDATION_ERROR': return 'Thông tin chưa hợp lệ. Hãy kiểm tra các trường được đánh dấu.';
    default: return 'Không thể lưu thông tin danh mục lúc này. Hãy thử lại.';
  }
}

/**
 * Biểu mẫu tạo mới và chỉnh sửa danh mục trong một Modal.
 * Cập nhật gửi kèm version đã đọc để backend phát hiện xung đột đồng thời (409).
 */
export function CategoryFormModal({
  category,
  onCancel,
  onSaved,
}: {
  category?: Category;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<CategoryFormValues>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (values: CategoryFormValues) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const input = {
        name: values.name.trim(),
        description: values.description.trim() || null,
      };
      if (category) {
        await categoryApi.updateCategory(category.id, { ...input, version: category.version });
      } else {
        await categoryApi.createCategory(input);
      }
      onCancel();
      onSaved();
    } catch (err: unknown) {
      const body = responseBody(err);
      const fieldErrors = body?.errors ?? {};
      if (fieldErrors.name) {
        form.setFields([{ name: 'name', errors: [fieldErrors.name] }]);
        return;
      }
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form<CategoryFormValues>
      form={form}
      layout="vertical"
      initialValues={toFormValues(category)}
      onFinish={submit}
      requiredMark="optional"
    >
      <Modal
        open
        title={category ? `Chỉnh sửa danh mục · ${category.name}` : 'Thêm danh mục mới'}
        okText={category ? 'Lưu thay đổi' : 'Thêm danh mục'}
        cancelText="Hủy"
        confirmLoading={saving}
        onCancel={() => {
          if (!saving) onCancel();
        }}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        {error && <Alert className="book-alert" type="error" showIcon role="alert" title={error} />}
        <Form.Item
          label="Tên danh mục"
          name="name"
          rules={[
            { required: true, whitespace: true, message: 'Vui lòng nhập tên danh mục.' },
            { max: 100, message: 'Tên danh mục không được vượt quá 100 ký tự.' },
          ]}
        >
          <Input maxLength={100} aria-label="Tên danh mục" />
        </Form.Item>
        <Form.Item
          label="Mô tả"
          name="description"
          rules={[{ max: 500, message: 'Mô tả không được vượt quá 500 ký tự.' }]}
        >
          <Input.TextArea
            maxLength={500}
            rows={3}
            aria-label="Mô tả danh mục"
            placeholder="Mô tả ngắn về danh mục (tùy chọn)"
          />
        </Form.Item>
      </Modal>
    </Form>
  );
}
