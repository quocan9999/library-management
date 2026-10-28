import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';

import { LibbyColors, LibbyFonts } from '@/constants/theme';

interface LoanQrModalProps {
  visible: boolean;
  onClose: () => void;
  loanCode: string;
  pickupReference?: string;
  bookTitle?: string;
}

export const LoanQrModal: React.FC<LoanQrModalProps> = ({
  visible,
  onClose,
  loanCode,
  pickupReference,
  bookTitle,
}) => {
  if (!visible) return null;

  const qrValue = pickupReference || loanCode || 'LIBBY_DEFAULT';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleBox}>
              <Text style={styles.title}>Mã nhận sách</Text>
              <Text style={styles.subtitle}>Yêu cầu {loanCode}</Text>
            </View>

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

          {/* QR Code Container */}
          <View style={styles.qrWrapper}>
            <View style={styles.qrInner}>
              <QRCode
                value={qrValue}
                size={200}
                color={LibbyColors.ink}
                backgroundColor={LibbyColors.white}
              />
            </View>
            <Text style={styles.referenceCode}>{qrValue}</Text>
          </View>

          {bookTitle && (
            <Text numberOfLines={1} style={styles.bookTitle}>
              {bookTitle}
            </Text>
          )}

          <Text style={styles.instruction}>
            Xuất trình mã này cho thủ thư tại quầy thư viện để hoàn tất thủ tục nhận sách.
          </Text>

          {/* Close Action */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.doneBtnText}>Xong</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 17, 43, 0.6)',
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: LibbyColors.white,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleBox: {
    flex: 1,
  },
  title: {
    fontFamily: LibbyFonts.display,
    fontSize: 22,
    color: LibbyColors.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: LibbyFonts.medium,
    fontSize: 13,
    color: LibbyColors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFEBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrapper: {
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F7F5FF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECE8FF',
  },
  qrInner: {
    padding: 12,
    backgroundColor: LibbyColors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECE8FF',
  },
  referenceCode: {
    fontFamily: LibbyFonts.display,
    fontSize: 18,
    color: LibbyColors.ink,
    letterSpacing: 1,
  },
  bookTitle: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 14,
    color: LibbyColors.ink,
    textAlign: 'center',
  },
  instruction: {
    fontFamily: LibbyFonts.regular,
    fontSize: 13,
    color: LibbyColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  doneBtn: {
    width: '100%',
    height: 48,
    backgroundColor: LibbyColors.ink,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 15,
    color: LibbyColors.white,
  },
});
