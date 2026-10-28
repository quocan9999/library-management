import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { EyeIcon, EyeOffIcon } from '@/components/icons/AuthIcons';
import { LibbyColors, LibbyFonts } from '@/constants/theme';

export interface LibbyInputProps extends TextInputProps {
  label?: string;
  labelRight?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightAccessory?: React.ReactNode;
  isPassword?: boolean;
  error?: boolean;
  errorMessage?: string;
  containerStyle?: ViewStyle;
  inputContainerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const LibbyInput: React.FC<LibbyInputProps> = ({
  label,
  labelRight,
  leftIcon,
  rightAccessory,
  isPassword = false,
  error = false,
  errorMessage,
  containerStyle,
  inputContainerStyle,
  inputStyle,
  onFocus,
  onBlur,
  secureTextEntry,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isEditable = rest.editable !== false;

  let borderColor: string = LibbyColors.ink;
  if (error) {
    borderColor = LibbyColors.errorText;
  } else if (isFocused) {
    borderColor = LibbyColors.primary;
  }

  const isActuallySecure = isPassword ? !showPassword : secureTextEntry;

  // Tách riêng backgroundColor từ inputStyle nếu có truyền vào, để gán cho inputContainer
  // tránh việc thẻ TextInput dạng hình chữ nhật vuông vức đè lên viền bo cong 26px của container.
  const flatInputStyle = StyleSheet.flatten(inputStyle) || {};
  const { backgroundColor: customBgColor, ...cleanInputStyle } = flatInputStyle;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {labelRight}
        </View>
      )}

      <View
        style={[
          styles.inputContainer,
          { borderColor },
          !isEditable && styles.disabledInputContainer,
          customBgColor ? { backgroundColor: customBgColor } : null,
          inputContainerStyle,
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

        <TextInput
          placeholderTextColor={LibbyColors.placeholder}
          secureTextEntry={isActuallySecure}
          style={[
            styles.textInput,
            leftIcon ? styles.paddingLeftWithIcon : styles.paddingLeftNormal,
            (isPassword || rightAccessory) ? styles.paddingRightWithAccessory : styles.paddingRightNormal,
            !isEditable && styles.disabledTextInput,
            cleanInputStyle,
          ]}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          {...rest}
        />

        {isPassword ? (
          <TouchableOpacity
            activeOpacity={0.7}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
          >
            {showPassword ? (
              <EyeOffIcon size={18} color={LibbyColors.ink} strokeWidth={2.2} />
            ) : (
              <EyeIcon size={18} color={LibbyColors.ink} strokeWidth={2.2} />
            )}
          </TouchableOpacity>
        ) : (
          rightAccessory && <View style={styles.rightAccessoryContainer}>{rightAccessory}</View>
        )}
      </View>

      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontFamily: LibbyFonts.semiBold,
    fontSize: 13,
    color: LibbyColors.ink,
  },
  inputContainer: {
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    backgroundColor: LibbyColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  disabledInputContainer: {
    backgroundColor: '#FAF9FF',
    borderColor: LibbyColors.ink,
  },
  leftIconContainer: {
    position: 'absolute',
    left: 18,
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontFamily: LibbyFonts.medium,
    fontSize: 15,
    color: LibbyColors.ink,
    backgroundColor: 'transparent',
  },
  disabledTextInput: {
    color: LibbyColors.ink,
  },
  paddingLeftWithIcon: {
    paddingLeft: 48,
  },
  paddingLeftNormal: {
    paddingLeft: 20,
  },
  paddingRightWithAccessory: {
    paddingRight: 52,
  },
  paddingRightNormal: {
    paddingRight: 20,
  },
  eyeButton: {
    position: 'absolute',
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LibbyColors.lilac,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightAccessoryContainer: {
    position: 'absolute',
    right: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 4,
    fontFamily: LibbyFonts.medium,
    fontSize: 12,
    color: LibbyColors.errorText,
    marginLeft: 14,
  },
});
