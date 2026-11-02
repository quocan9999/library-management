import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LibbyBackButton, LibbyButton, LibbyInput } from '@/components/ui';
import { LibbyColors, LibbyFonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { profileService, ProfileUpdateError, UserProfile } from '@/services/profileService';

const PHONE_ERROR =
  'Số điện thoại phải có đúng 10 chữ số và thuộc đầu số di động Việt Nam (03, 05, 07, 08, 09)';

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states for exactly 4 fields
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const populateForm = (data: UserProfile | null) => {
    setFullName(data?.fullName || '');
    setDateOfBirth(data?.dateOfBirth || '');
    setPhone(data?.phone || '');
    setAddress(data?.address || '');
    setErrors({});
  };

  const fetchProfile = useCallback(async () => {
    try {
      const data = await profileService.getProfile();
      setProfile(data);
      populateForm(data);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    profileService
      .getProfile()
      .then((data) => {
        if (isMounted) {
          setProfile(data);
          populateForm(data);
        }
      })
      .catch(() => {
        // Ignored
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleEdit = () => {
    if (isEditing) {
      // Cancel edit: revert to loaded values
      populateForm(profile);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (fullName.trim().length > 150) {
      nextErrors.fullName = 'Họ và tên không được vượt quá 150 ký tự';
    }

    if (phone.trim()) {
      const cleanPhone = phone.trim();
      const vnMobile = /^0[35789][0-9]{8}$/;
      if (!vnMobile.test(cleanPhone)) {
        nextErrors.phone = PHONE_ERROR;
      }
    }

    if (address.trim().length > 255) {
      nextErrors.address = 'Địa chỉ không được vượt quá 255 ký tự';
    }

    if (dateOfBirth.trim()) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateOfBirth.trim())) {
        nextErrors.dateOfBirth = 'Định dạng ngày sinh phải là YYYY-MM-DD (VD: 1998-08-15)';
      } else {
        const birthDate = new Date(dateOfBirth.trim());
        const now = new Date();
        if (isNaN(birthDate.getTime()) || birthDate > now) {
          nextErrors.dateOfBirth = 'Ngày sinh phải hợp lệ và thành viên đủ 16 tuổi';
        } else {
          let age = now.getFullYear() - birthDate.getFullYear();
          const m = now.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age < 16) {
            nextErrors.dateOfBirth = 'Ngày sinh phải hợp lệ và thành viên đủ 16 tuổi';
          }
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

      setProfile(updated);
      populateForm(updated);
      setIsEditing(false);
      await refreshUser();
      Alert.alert('Thành công', 'Thông tin cá nhân đã được cập nhật.');
    } catch (err) {
      if (err instanceof ProfileUpdateError) {
        const code = err.code;

        if (code === 'MEMBER_PHONE_DUPLICATED') {
          setErrors((prev) => ({
            ...prev,
            phone: 'Số điện thoại này đã được sử dụng bởi độc giả khác.',
          }));
          return;
        }

        if (code === 'MEMBER_VERSION_CONFLICT') {
          setIsEditing(false);
          await fetchProfile();
          Alert.alert(
            'Hồ sơ đã thay đổi',
            'Dữ liệu hồ sơ đã được thay đổi từ một phiên làm việc khác. Vui lòng kiểm tra lại thông tin mới nhất.'
          );
          return;
        }

        if (err.fieldErrors) {
          const fieldErrors = Object.fromEntries(
            Object.entries(err.fieldErrors).filter(([, value]) => !!value)
          ) as Record<string, string>;
          if (Object.keys(fieldErrors).length > 0) {
            setErrors((prev) => ({ ...prev, ...fieldErrors }));
            return;
          }
        }

        Alert.alert('Cập nhật thất bại', err.message);
        return;
      }

      const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra.';
      Alert.alert('Cập nhật thất bại', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <LibbyBackButton onPress={() => router.back()} />

        <Text numberOfLines={1} style={styles.headerTitle}>
          Thông tin cá nhân
        </Text>

        {!loading && (
          <Pressable
            onPress={handleToggleEdit}
            style={styles.editToggleBtn}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Hủy chỉnh sửa' : 'Chỉnh sửa thông tin'}
          >
            <Text
              style={[
                styles.editToggleText,
                isEditing && styles.cancelToggleText,
              ]}
            >
              {isEditing ? 'Hủy' : 'Chỉnh sửa'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Main Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={LibbyColors.primary} size="large" />
            </View>
          ) : (
            <View style={styles.formCard}>
              <LibbyInput
                label="Họ và tên"
                placeholder={isEditing ? 'Nhập họ và tên đầy đủ' : 'Chưa cập nhật'}
                value={fullName}
                onChangeText={(val) => {
                  setFullName(val);
                  if (errors.fullName) {
                    setErrors((prev) => ({ ...prev, fullName: '' }));
                  }
                }}
                editable={isEditing}
                errorMessage={errors.fullName}
              />

              <LibbyInput
                label="Ngày sinh (YYYY-MM-DD)"
                placeholder={isEditing ? 'VD: 1998-08-15' : 'Chưa cập nhật'}
                value={dateOfBirth}
                onChangeText={(val) => {
                  setDateOfBirth(val);
                  if (errors.dateOfBirth) {
                    setErrors((prev) => ({ ...prev, dateOfBirth: '' }));
                  }
                }}
                editable={isEditing}
                errorMessage={errors.dateOfBirth}
              />

              <LibbyInput
                label="Số điện thoại"
                placeholder={isEditing ? 'Ví dụ: 0912345678' : 'Chưa cập nhật'}
                value={phone}
                onChangeText={(val) => {
                  const digitsOnly = val.replace(/[^0-9]/g, '').slice(0, 10);
                  setPhone(digitsOnly);
                  if (errors.phone) {
                    setErrors((prev) => ({ ...prev, phone: '' }));
                  }
                }}
                maxLength={10}
                keyboardType="number-pad"
                editable={isEditing}
                errorMessage={errors.phone}
              />

              <LibbyInput
                label="Địa chỉ cư trú"
                placeholder={isEditing ? 'Nhập địa chỉ cư trú của bạn' : 'Chưa cập nhật'}
                value={address}
                onChangeText={(val) => {
                  setAddress(val);
                  if (errors.address) {
                    setErrors((prev) => ({ ...prev, address: '' }));
                  }
                }}
                editable={isEditing}
                errorMessage={errors.address}
              />

              {/* Save Button: only visible when in editing mode */}
              {isEditing && (
                <View style={styles.actionRow}>
                  <LibbyButton
                    title={saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    variant="primary"
                    disabled={saving}
                    onPress={handleSave}
                  />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1FF',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE8FF',
  },
  headerTitle: {
    fontFamily: LibbyFonts.display,
    fontSize: 20,
    color: LibbyColors.ink,
    letterSpacing: -0.3,
  },
  editToggleBtn: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFEBFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  editToggleText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
    color: LibbyColors.accentViolet,
  },
  cancelToggleText: {
    color: LibbyColors.ink,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  formCard: {
    backgroundColor: LibbyColors.white,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    padding: 20,
    gap: 16,
  },
  actionRow: {
    marginTop: 12,
  },
});
