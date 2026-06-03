/**
 * GrocerEase — AddedToCartToast
 * FIX [3]: Small, auto-disappearing floating toast when item is added to cart.
 * Replaces the large floating window.
 *
 * Usage:
 *   import { useCartToast } from '../components/AddedToCartToast';
 *   const { showToast, ToastComponent } = useCartToast();
 *   // call showToast() when item is added
 *   // render <ToastComponent /> anywhere in your screen JSX
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type ToastProps = { visible: boolean };

function AddedToCartToast({ visible }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 10, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]} pointerEvents="none">
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.text}>Added to cart</Text>
    </Animated.View>
  );
}

/**
 * Hook: call showToast() on add-to-cart press.
 * The toast auto-disappears after 1.8 seconds.
 */
export function useCartToast() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 1800);
  }, []);

  const ToastComponent = useCallback(
    () => <AddedToCartToast visible={visible} />,
    [visible]
  );

  return { showToast, ToastComponent };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 90,           // sits just above the bottom tab bar
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 9999,
  },
  icon: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '800',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
