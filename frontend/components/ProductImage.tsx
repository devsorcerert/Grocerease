import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  uri?: string;
  size?: number;
  iconSize?: number;
  style?: object;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

/**
 * Renders a product image with automatic fallback to a grocery-bag
 * placeholder icon if the URL is missing or fails to load.
 */
export default function ProductImage({ uri, size, iconSize = 28, style, resizeMode = 'cover' }: Props) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={[styles.placeholder, size ? { width: size, height: size } : undefined, style]}>
        <Ionicons name="bag-outline" size={iconSize} color="#2D8B47" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.image, size ? { width: size, height: size } : undefined, style]}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
