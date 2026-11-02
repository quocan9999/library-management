import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_BOOK_COVER_URL, LibbyColors, LibbyFonts } from '@/constants/theme';

export interface BookCoverMiniProps {
  coverImageUrl?: string | null;
  title?: string;
  color?: string;
  marginLeft?: number;
  index?: number;
  width?: number;
  height?: number;
}

const DEFAULT_THEME_COLORS = [
  { bg: LibbyColors.accentViolet, text: LibbyColors.white },
  { bg: LibbyColors.ink, text: LibbyColors.accentLime },
  { bg: LibbyColors.accentLime, text: LibbyColors.ink },
];

export const BookCoverMini: React.FC<BookCoverMiniProps> = ({
  coverImageUrl,
  title,
  color,
  marginLeft = 0,
  index = 0,
  width = 44,
  height = 60,
}) => {
  const [loadError, setLoadError] = useState(false);

  const theme = DEFAULT_THEME_COLORS[Math.abs(index) % DEFAULT_THEME_COLORS.length];
  const imageUri = coverImageUrl || DEFAULT_BOOK_COVER_URL;
  const showImage = !loadError && !!imageUri;

  return (
    <View
      style={[
        styles.cover,
        {
          width,
          height,
          backgroundColor: color || theme.bg,
          marginLeft,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          contentFit="cover"
          transition={150}
          onError={() => setLoadError(true)}
        />
      ) : (
        <View style={styles.fallbackBox}>
          {title ? (
            <Text
              numberOfLines={2}
              style={[styles.fallbackTitle, { color: theme.text }]}
            >
              {title.slice(0, 8)}
            </Text>
          ) : (
            <Text style={[styles.fallbackTitle, { color: theme.text }]}>LIB</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cover: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: LibbyColors.ink,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackBox: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  fallbackTitle: {
    fontFamily: LibbyFonts.bold,
    fontSize: 9,
    textAlign: 'center',
  },
});
