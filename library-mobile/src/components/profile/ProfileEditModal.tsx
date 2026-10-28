import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { LibbyButton, LibbyInput } from '@/components/ui';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { profileService, UserProfile } from '@/services/profileService';

interface ProfileEditModalProps {
  visible: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onUpdated: (newProfile: UserProfile) => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  visible,
  profile,
  onClose,
  onUpdated,
}) => {
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState(profile?.address || '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (fullName.trim().length > 150) {
      nextErrors.fullName = 'Họ và tên không được vượt quá 150 ký tự';
    }

    if (phone.trim()) {
      const cleanPhone = phone.trim().replace(/[\s.-]/g, '');
      const vnMobile = /^0[35789][0-9]{8}$/;
      if (!vnMobile.test(cleanPhone)) {
        nextErrors.phone =
          'Số điện thoại phải có 10 chữ số và thuộc đầu số di động VN (03, 05, 07, 08, 09)';
      }
    }

    if (address.trim().length > 255) {
      nextErrors.address = 'Địa chỉ không được vượt quá 255 ký tự';
    }

    if (dateOfBirth.trim()) {
      // Expected YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateOfBirth.trim())) {
        nextErrors.dateOfBirth = 'Định dạng ngày sinh phải là YYYY-MM-DD (VD: 1998-08-15)';
      } else {
        const birthDate = new Date(dateOfBirth.trim());
        const now = new Date();
        let age = now.getFullYear() - birthDate.getFullYear();
        const m = now.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
          age--;
        }
        if (age < 16) {
          nextErrors.dateOfBirth = 'Độc giả phải từ đủ 16 tuổi trở lên';
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!profile || profile.version === null) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const updated = await profileService.updateProfile({
        version: profile.version ?? 0,
        fullName: fullName.trim() || null,
        dateOfBirth: dateOfBirth.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      });
      Alert.alert('Thành công', 'Thông tin cá nhân đã được cập nhật.');
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      Alert.alert('Cập nhật thất bại', err.message || 'Đã có lỗi xảy ra.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.sheetTitle}>Chỉnh sửa hồ sơ</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 6l12 12M18 6L6 18"
                  stroke={LibbyColors.ink}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>

          <ScrollView
            style={styles.formScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.formContent}
          >
            <LibbyInput
              label="Họ và tên"
              placeholder="Nhập họ và tên đầy đủ"
              value={fullName}
              onChangeText={setFullName}
              errorMessage={errors.fullName}
            />

            <LibbyInput
              label="Ngày sinh (YYYY-MM-DD)"
              placeholder="VD: 1998-08-15"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              errorMessage={errors.dateOfBirth}
            />

            <LibbyInput
              label="Số điện thoại"
              placeholder="VD: 0912345678"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              errorMessage={errors.phone}
            />

            <LibbyInput
              label="Địa chỉ cư trú"
              placeholder="Nhập địa chỉ của bạn"
              value={address}
              onChangeText={setAddress}
              errorMessage={errors.address}
            />

            <View style={styles.btnRow}>
              <LibbyButton
                title={saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                variant="primary"
                disabled={saving}
                onPress={handleSave}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 17, 43, 0.45)',
  },
  sheet: {
    backgroundColor: LibbyColors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: LibbyColors.ink,
    maxHeight: '90%',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ECE8FF',
  },
  sheetTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 22,
    color: LibbyColors.ink,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFEBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    flexGrow: 1,
  },
  formContent: {
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },
  btnRow: {
    marginTop: 12,
  },
});
