import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../store/cartStore';

interface QuantitySelectorProps {
  productId: string;
  size?: 'small' | 'medium';
  color?: string;
}

export default function QuantitySelector({ productId, size = 'small', color = '#2D8B47' }: QuantitySelectorProps) {
  const { items, addToCart, updateQuantity } = useCartStore();
  const [loading, setLoading] = useState(false);

  const cartItem = items.find(i => i.product_id === productId);
  const qty = cartItem?.quantity ?? 0;

  const isSmall = size === 'small';
  const btnSize = isSmall ? 26 : 32;
  const iconSize = isSmall ? 14 : 18;
  const fontSize = isSmall ? 13 : 15;

  const handleAdd = async () => {
    setLoading(true);
    try {
      await addToCart(productId, 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleIncrement = async () => {
    setLoading(true);
    try {
      await updateQuantity(productId, qty + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDecrement = async () => {
    setLoading(true);
    try {
      await updateQuantity(productId, qty - 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingBox, { width: btnSize, height: btnSize, borderRadius: btnSize / 2, backgroundColor: color }]}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  if (qty === 0) {
    return (
      <TouchableOpacity
        style={[styles.addBtn, { width: btnSize, height: btnSize, borderRadius: btnSize / 2, backgroundColor: color }]}
        onPress={handleAdd}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={iconSize} color="#fff" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.qtyRow, { borderColor: color }]}>
      <TouchableOpacity
        style={[styles.qtyBtn, { width: btnSize, height: btnSize, backgroundColor: color }]}
        onPress={handleDecrement}
        activeOpacity={0.8}
      >
        <Ionicons name="remove" size={iconSize} color="#fff" />
      </TouchableOpacity>
      <Text style={[styles.qtyText, { fontSize, color }]}>{qty}</Text>
      <TouchableOpacity
        style={[styles.qtyBtn, { width: btnSize, height: btnSize, backgroundColor: color }]}
        onPress={handleIncrement}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={iconSize} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    overflow: 'hidden',
  },
  qtyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontWeight: '700',
    paddingHorizontal: 6,
    minWidth: 22,
    textAlign: 'center',
  },
});
