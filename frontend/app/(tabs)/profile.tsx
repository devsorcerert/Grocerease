import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../context/LanguageContext';
import api from '../../utils/api';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { t, language, changeLanguage } = useTranslation();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/user/orders');
      setOrders(response.data.orders || response.data || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };ÛÛÝÙ][ÛSÙ\\ØYÙHH

HOÂÛÛÝÜ[H\Ù\Ë[ÛWÜÜ[ÂY
Ü[HL
H]\È\ÙYËÝ[ËX^]Ø\LNÂY
Ü[HLÌ
H]\È\ÙYÝ[ËX^]Ø\LNÂY
Ü[HÌ
H]\È\ÙYKÝ[ËX^]Ø\LNÂ]\È\ÙYÝ[ËX^]Ø\NÂNÂÛÛÝÙ]YX\TÝ]ÈH

HOÂÛÛÝÝ[Ü[H\Ù\ËÝ[ÜÜ[ÂÛÛÝYX\SÙ\ÈHX]ÛÜÝ[Ü[ÈL
NÂ]\ÈÙ\ÎYX\SÙ\ËØ][ÜÎYX\SÙ\È
LNÂNÂÛÛÝ[SÙÛÝ]H

HOÂ[\[\

	ÛÙÛÝ]	ÊK	Ð\H[ÝHÝ\H[ÝHØ[ÈÙÛÝ]ÉËÂÈ^	ÐØ[Ù[	ËÝ[N	ØØ[Ù[	ÈKÈ^
	ÛÙÛÝ]	ÊKÝ[N	Ù\ÝXÝ]IËÛ\ÜÎ\Þ[È

HOÈ]ØZ]ÙÛÝ]

NÈÝ]\\XÙJ	ËÊ]]
KÝÙ[ÛÛYIÊNÈHBJNÂNÂ