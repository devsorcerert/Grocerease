import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function Logo({ size = 'medium' }: LogoProps) {
  const dim = size === 'large' ? 200 : size === 'medium' ? 140 : 90;

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/logo.png')}
        style={{ width: dim, height: dim }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
