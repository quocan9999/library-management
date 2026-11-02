import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';

import { LibbyColors, LibbyFonts } from '@/constants/theme';

export interface LoanQrModalProps {
  visible: boolean;
  onClose: () => void;
  loanCode: string;
  pickupReference?: string;
  itemCount?: number;
  items?: Array<{ title: string; bookCode?: string; author?: string }>;
  bookTitle?: string;
  bookSubtitle?: string;
}

export const LoanQrModal: React.FC<LoanQrModalProps> = ({
  visible,
  onClose,
  loanCode,
  pickupReference,
  itemCount,
  items = [],
  bookTitle,
  bookSubtitle,
}) => {
  if (!visible) return null;

  const qrValue = pickupReference || loanCode || 'LIBBY_DEFAULT';
  const totalItems = itemCount ?? (items.length > 0 ? items.length : 1);

  const displayTitle =
    bookTitle ||
    (totalItems > 1 ? `${totalItems} sách trong yêu cầu` : items[0]?.title || 'Sách mượn');

  const displaySubtitle =
    bookSubtitle ||
    (totalItems > 1
      ? items.map((i) => i.title).join(', ')
      : items[0]
      ? [items[0].bookCode, items[0].author].filter(Boolean).join(' · ')
      : undefined);

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
          {/* Header Row */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Mã nhận sách</Text>
              </View>
              <Text style={styles.title}>Yêu cầu {loanCode}</Text>
            </View>

            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Đóng mã QR"
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

          {/* Books Info */}
          {(displayTitle || displaySubtitle) && (
            <View style={styles.booksInfo}>
              {displayTitle ? (
                <Text style={styles.booksCountTitle}>{displayTitle}</Text>
              ) : null}
              {displaySubtitle ? (
                <Text style={styles.booksListSubtitle}>{displaySubtitle}</Text>
              ) : null}
            </View>
          )}

          {/* QR Code Container */}
          <View style={styles.qrWrapper}>
            <View style={styles.qrInner}>
              <QRCode
                value={qrValue}
                size={220}
                color={LibbyColors.ink}
                backgroundColor={LibbyColors.white}
              />
            </View>
          </View>

          {/* Footer instruction text */}
          <Text style={styles.instruction}>
            Đưa mã này cho thủ thư tại quầy để quét và nhận sách.
          </Text>
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
    padding: 20,
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
    borderRadius: 32,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: LibbyColors.accentLime,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: LibbyFonts.bold,
    fontSize: 12,
    color: LibbyColors.ink,
  },
  title: {
    fontFamily: LibbyFonts.display,
    fontSize: 26,
    color: LibbyColors.ink,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFEBFF',
    borderWidth: 2,
    borderColor: LibbyColors.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  booksInfo: {
    gap: 4,
  },
  booksCountTitle: {
    fontFamily: LibbyFonts.bold,
    fontSize: 17,
    color: LibbyColors.ink,
    letterSpacing: -0.2,
  },
  booksListSubtitle: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
    lineHeight: 20,
  },
  qrWrapper: {
    backgroundColor: '#EFEBFF',
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrInner: {
    backgroundColor: LibbyColors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instruction: {
    fontFamily: LibbyFonts.regular,
    fontSize: 14,
    color: LibbyColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
