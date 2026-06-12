import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function Logo({ size = 'medium', showText = true }: LogoProps) {
  const logoSize = size === 'large' ? 120 : size === 'medium' ? 80 : 60;
  const fontSize = size === 'large' ? 28 : size === 'medium' ? 20 : 16;
  const iconSize = size === 'large' ? 40 : size === 'medium' ? 28 : 20;
  const rupeeSize = size === 'large' ? 24 : size === 'medium' ? 16 : 12;

  return (
    <View style={styles.container}>
      {/* Shopping Cart with Digital Elements */}
      <View style={[styles.logoContainer, { width: logoSize, height: logoSize }]}>
        <Ionicons 
          name="basket" 
          size={iconSize} 
          color="#2D8B47" 
          style={styles.cartIcon}
        />
        
        {/* Rupee Symbol */}
        <View style={styles.rupeeContainer}>
          <Text style={[styles.rupeeSymbol, { fontSize: rupeeSize }]}>₹</Text>
        </View>
        
        {/* Digital/TV Elements */}
        <View style={styles.digitalElements}>
          <View style={[styles.antenna, styles.antennaLeft]} />
          <View style={[styles.antenna, styles.antennaRight]} />
          <View style={[styles.screenElement]} />
        </View>
      </View>
      
      {/* Brand Name */}
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.logoTextGreen, { fontSize }]}>Grocer</Text>
          <Text style={[styles.logoTextOrange, { fontSize }]}>Ease</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cartIcon: {
    position: 'absolute',
  },
  rupeeContainer: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    marginLeft: -6,
    backgroundColor: '#2D8B47',
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  rupeeSymbol: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  digitalElements: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  antenna: {
    width: 2,
    height: 8,
    backgroundColor: '#FF8C42',
    borderRadius: 1,
    position: 'absolute',
  },
  antennaLeft: {
    top: 0,
    left: 0,
    transform: [{ rotate: '-20deg' }],
  },
  antennaRight: {
    top: 0,
    left: 6,
    transform: [{ rotate: '20deg' }],
  },
  screenElement: {
    width: 12,
    height: 8,
    backgroundColor: '#FF8C42',
    borderRadius: 2,
    top: 8,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoTextGreen: {
    fontWeight: 'bold',
    color: '#2D8B47',
    letterSpacing: 0.5,
  },
  logoTextOrange: {
    fontWeight: 'bold',
    color: '#FF8C42',
    letterSpacing: 0.5,
  },
});